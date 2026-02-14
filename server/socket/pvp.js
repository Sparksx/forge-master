import prisma from '../lib/prisma.js';
import { computeStatsFromEquipment, calculatePowerScore, calculateStats } from '../../shared/stats.js';
import { PVP_BASE_POWER_RANGE, PVP_POWER_RANGE_EXPANSION, PVP_RANGE_INTERVAL, PVP_TURN_TIMEOUT } from '../../shared/pvp-config.js';
import { storeCombatLog } from './chat.js';

// Matchmaking queue: Map<socketId, { socket, userId, username, stats }>
const queue = new Map();

// Active matches: Map<matchId, MatchState>
const matches = new Map();

const TURN_TIMEOUT = PVP_TURN_TIMEOUT;
const MAX_TURNS = 50; // max turns before forced end
const K_FACTOR = 32; // Elo K-factor base

// Leaderboard cache (avoid recalculating power for every request)
let leaderboardCache = null;
let leaderboardCacheTime = 0;
const LEADERBOARD_CACHE_TTL = 60000; // 60 seconds

// Matchmaking: power-based primary, elo secondary (from shared config)
const BASE_POWER_RANGE = PVP_BASE_POWER_RANGE;
const POWER_RANGE_EXPANSION = PVP_POWER_RANGE_EXPANSION;
const BASE_ELO_RANGE = 200;
const ELO_RANGE_EXPANSION = 100;
const RANGE_INTERVAL = PVP_RANGE_INTERVAL;

export function registerPvpHandlers(io, socket) {
    socket.on('pvp:queue', async () => {
        try {
            // Don't queue if already in queue or in a match
            if (queue.has(socket.id)) return;
            if (socket.matchId) return;

            const stats = await getPlayerStats(socket.user.userId);
            if (!stats) {
                socket.emit('pvp:error', { message: 'Could not load your stats' });
                return;
            }

            queue.set(socket.id, {
                socket,
                userId: socket.user.userId,
                username: socket.user.username,
                stats,
                queuedAt: Date.now(),
            });

            socket.emit('pvp:queued', { power: stats.power });
            tryMatch(io);
        } catch (err) {
            console.error('pvp:queue error:', err);
            socket.emit('pvp:error', { message: 'Failed to join queue' });
        }
    });

    socket.on('pvp:cancel', () => {
        queue.delete(socket.id);
        socket.emit('pvp:cancelled', {});
    });

    socket.on('pvp:action', (data) => {
        const match = matches.get(socket.matchId);
        if (!match) return;

        const { type } = data || {};
        if (!['attack', 'defend', 'special'].includes(type)) return;

        handleAction(io, match, socket.user.userId, type);
    });

    socket.on('pvp:leaderboard', async () => {
        try {
            const leaderboard = await getLeaderboard();
            socket.emit('pvp:leaderboard', leaderboard);
        } catch (err) {
            console.error('pvp:leaderboard error:', err);
            socket.emit('pvp:leaderboard', []);
        }
    });

    socket.on('disconnect', () => {
        queue.delete(socket.id);

        // Forfeit active match
        const match = matches.get(socket.matchId);
        if (match) {
            const opponent = match.player1.userId === socket.user.userId ? match.player2 : match.player1;
            endMatch(io, match, opponent.userId, 'forfeit');
        }
    });
}

function tryMatch(io) {
    if (queue.size < 2) return;

    // Sort by power for O(n log n) neighbor search instead of O(n²)
    const entries = Array.from(queue.values()).sort((a, b) => a.stats.power - b.stats.power);
    const now = Date.now();

    // Find the best compatible adjacent pair
    let bestPair = null;
    let bestScore = Infinity;

    for (let i = 0; i < entries.length - 1; i++) {
        const a = entries[i];
        // Only check nearby neighbors (sorted by power, so close indices = close power)
        const searchLimit = Math.min(entries.length, i + 10);
        for (let j = i + 1; j < searchLimit; j++) {
            const b = entries[j];

            const avgPower = (a.stats.power + b.stats.power) / 2 || 1;
            const powerDiffPct = Math.abs(a.stats.power - b.stats.power) / avgPower;

            // Early exit: if power diff already exceeds max possible range, skip further neighbors
            if (powerDiffPct > BASE_POWER_RANGE + 10 * POWER_RANGE_EXPANSION) break;

            const eloDiff = Math.abs(a.stats.rating - b.stats.rating);

            const waitA = now - (a.queuedAt || now);
            const waitB = now - (b.queuedAt || now);
            const maxWait = Math.max(waitA, waitB);
            const expansions = Math.floor(maxWait / RANGE_INTERVAL);

            const allowedPowerRange = BASE_POWER_RANGE + expansions * POWER_RANGE_EXPANSION;
            const allowedEloRange = BASE_ELO_RANGE + expansions * ELO_RANGE_EXPANSION;

            if (powerDiffPct <= allowedPowerRange && eloDiff <= allowedEloRange) {
                const score = powerDiffPct * 200 + eloDiff;
                if (score < bestScore) {
                    bestScore = score;
                    bestPair = [a, b];
                }
            }
        }
    }

    if (!bestPair) return; // No compatible pair yet, ranges will widen over time

    const [p1, p2] = bestPair;
    queue.delete(p1.socket.id);
    queue.delete(p2.socket.id);

    const matchId = `match_${Date.now()}_${p1.userId}_${p2.userId}`;

    const match = {
        id: matchId,
        player1: {
            socket: p1.socket,
            userId: p1.userId,
            username: p1.username,
            profilePicture: p1.stats.profilePicture,
            maxHP: p1.stats.maxHP,
            currentHP: p1.stats.maxHP,
            damage: p1.stats.damage,
            critChance: p1.stats.critChance,
            critMultiplier: p1.stats.critMultiplier,
            rating: p1.stats.rating,
            power: p1.stats.power,
            action: null,
        },
        player2: {
            socket: p2.socket,
            userId: p2.userId,
            username: p2.username,
            profilePicture: p2.stats.profilePicture,
            maxHP: p2.stats.maxHP,
            currentHP: p2.stats.maxHP,
            damage: p2.stats.damage,
            critChance: p2.stats.critChance,
            critMultiplier: p2.stats.critMultiplier,
            rating: p2.stats.rating,
            power: p2.stats.power,
            action: null,
        },
        turn: 1,
        turnTimer: null,
        turnLog: [],
    };

    matches.set(matchId, match);
    p1.socket.matchId = matchId;
    p2.socket.matchId = matchId;

    // Notify both players
    p1.socket.emit('pvp:matched', {
        matchId,
        opponent: { username: p2.username, maxHP: p2.stats.maxHP, damage: p2.stats.damage, rating: p2.stats.rating, power: p2.stats.power },
        you: { power: p1.stats.power, rating: p1.stats.rating },
    });
    p2.socket.emit('pvp:matched', {
        matchId,
        opponent: { username: p1.username, maxHP: p1.stats.maxHP, damage: p1.stats.damage, rating: p1.stats.rating, power: p1.stats.power },
        you: { power: p2.stats.power, rating: p2.stats.rating },
    });

    // Start turn timer
    startTurnTimer(io, match);
}

function startTurnTimer(io, match) {
    if (match.turnTimer) clearTimeout(match.turnTimer);

    match.player1.action = null;
    match.player2.action = null;

    match.player1.socket.emit('pvp:turn', { turn: match.turn, timeLimit: TURN_TIMEOUT });
    match.player2.socket.emit('pvp:turn', { turn: match.turn, timeLimit: TURN_TIMEOUT });

    match.turnTimer = setTimeout(() => {
        // Auto-attack for players who didn't act
        if (!match.player1.action) match.player1.action = 'attack';
        if (!match.player2.action) match.player2.action = 'attack';
        resolveTurn(io, match);
    }, TURN_TIMEOUT);
}

function handleAction(io, match, userId, action) {
    const player = match.player1.userId === userId ? match.player1 : match.player2;
    if (player.action) return; // Already acted this turn

    player.action = action;

    // If both players have acted, resolve immediately
    if (match.player1.action && match.player2.action) {
        if (match.turnTimer) clearTimeout(match.turnTimer);
        resolveTurn(io, match);
    }
}

function resolveTurn(io, match) {
    const p1 = match.player1;
    const p2 = match.player2;

    const result1 = calculateDamage(p1, p2, p1.action, p2.action);
    const result2 = calculateDamage(p2, p1, p2.action, p1.action);

    p2.currentHP = Math.max(0, p2.currentHP - result1.damage);
    p1.currentHP = Math.max(0, p1.currentHP - result2.damage);

    const turnResult = {
        turn: match.turn,
        player1: {
            action: p1.action,
            damage: result1.damage,
            isCrit: result1.isCrit,
            currentHP: p1.currentHP,
            maxHP: p1.maxHP,
        },
        player2: {
            action: p2.action,
            damage: result2.damage,
            isCrit: result2.isCrit,
            currentHP: p2.currentHP,
            maxHP: p2.maxHP,
        },
    };

    // Record turn for combat log
    match.turnLog.push(turnResult);

    // Send perspective-aware results
    p1.socket.emit('pvp:turn-result', {
        ...turnResult,
        you: turnResult.player1,
        opponent: turnResult.player2,
    });
    p2.socket.emit('pvp:turn-result', {
        ...turnResult,
        you: turnResult.player2,
        opponent: turnResult.player1,
    });

    // Check for end conditions
    if (p1.currentHP <= 0 && p2.currentHP <= 0) {
        // Draw — higher remaining HP wins, or true draw
        endMatch(io, match, null, 'draw');
    } else if (p2.currentHP <= 0) {
        endMatch(io, match, p1.userId, 'ko');
    } else if (p1.currentHP <= 0) {
        endMatch(io, match, p2.userId, 'ko');
    } else if (match.turn >= MAX_TURNS) {
        // Stalemate: player with higher HP% wins
        const p1Pct = p1.currentHP / p1.maxHP;
        const p2Pct = p2.currentHP / p2.maxHP;
        if (p1Pct > p2Pct) {
            endMatch(io, match, p1.userId, 'timeout');
        } else if (p2Pct > p1Pct) {
            endMatch(io, match, p2.userId, 'timeout');
        } else {
            endMatch(io, match, null, 'draw');
        }
    } else {
        match.turn++;
        startTurnTimer(io, match);
    }
}

function calculateDamage(attacker, defender, attackerAction, defenderAction) {
    let damage = 0;
    let isCrit = false;

    switch (attackerAction) {
        case 'attack': {
            damage = attacker.damage;
            // Crit check
            if (attacker.critChance > 0 && Math.random() * 100 < attacker.critChance) {
                damage = Math.floor(damage * (1 + attacker.critMultiplier / 100));
                isCrit = true;
            }
            // Variance ±10%
            damage = Math.max(1, Math.floor(damage * (0.9 + Math.random() * 0.2)));
            // Reduced if defender is defending
            if (defenderAction === 'defend') {
                damage = Math.floor(damage * 0.4);
            }
            break;
        }
        case 'defend': {
            // Defending does no damage
            damage = 0;
            break;
        }
        case 'special': {
            // High risk/reward: 1.8x damage but takes 30% more damage next turn
            damage = Math.floor(attacker.damage * 1.8);
            if (attacker.critChance > 0 && Math.random() * 100 < attacker.critChance) {
                damage = Math.floor(damage * (1 + attacker.critMultiplier / 100));
                isCrit = true;
            }
            damage = Math.max(1, Math.floor(damage * (0.9 + Math.random() * 0.2)));
            if (defenderAction === 'defend') {
                damage = Math.floor(damage * 0.5);
            }
            break;
        }
    }

    return { damage, isCrit };
}

/**
 * Power-weighted Elo calculation.
 * The K-factor is modulated by the power ratio between players:
 * - Beating a weaker opponent (lower power) yields less Elo
 * - Beating a stronger opponent (higher power) yields more Elo
 * - At equal power, standard Elo applies
 */
function computeEloChanges(winnerRating, loserRating, winnerPower, loserPower) {
    const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
    const expectedLoser = 1 - expectedWinner;

    // Power ratio modifier: dampened with ^0.5 to avoid extreme swings
    const winnerPowerRatio = Math.max(0.25, Math.min(4, loserPower / winnerPower));
    const loserPowerRatio = Math.max(0.25, Math.min(4, winnerPower / loserPower));

    const winnerK = K_FACTOR * Math.pow(winnerPowerRatio, 0.5);
    const loserK = K_FACTOR / Math.pow(loserPowerRatio, 0.5);

    const winnerChange = Math.max(1, Math.round(winnerK * (1 - expectedWinner)));
    const loserChange = Math.min(-1, Math.round(loserK * (0 - expectedLoser)));

    return { winnerChange, loserChange };
}

async function endMatch(io, match, winnerId, reason) {
    if (match.turnTimer) clearTimeout(match.turnTimer);

    const p1 = match.player1;
    const p2 = match.player2;

    // Calculate Elo changes with power weighting
    let p1Change = 0;
    let p2Change = 0;

    if (winnerId) {
        const isP1Winner = winnerId === p1.userId;
        const winner = isP1Winner ? p1 : p2;
        const loser = isP1Winner ? p2 : p1;

        const { winnerChange, loserChange } = computeEloChanges(
            winner.rating, loser.rating,
            winner.power, loser.power,
        );

        p1Change = isP1Winner ? winnerChange : loserChange;
        p2Change = isP1Winner ? loserChange : winnerChange;
    }

    // Update database
    try {
        const updates = [];
        if (winnerId === p1.userId) {
            updates.push(prisma.user.update({ where: { id: p1.userId }, data: { pvpRating: { increment: p1Change }, pvpWins: { increment: 1 } } }));
            updates.push(prisma.user.update({ where: { id: p2.userId }, data: { pvpRating: { increment: p2Change }, pvpLosses: { increment: 1 } } }));
        } else if (winnerId === p2.userId) {
            updates.push(prisma.user.update({ where: { id: p1.userId }, data: { pvpRating: { increment: p1Change }, pvpLosses: { increment: 1 } } }));
            updates.push(prisma.user.update({ where: { id: p2.userId }, data: { pvpRating: { increment: p2Change }, pvpWins: { increment: 1 } } }));
        }
        await Promise.all(updates);
        // Invalidate leaderboard cache since ratings changed
        leaderboardCache = null;
    } catch (err) {
        console.error('PvP rating update error:', err);
    }

    // Store combat log for sharing in chat
    const combatId = match.id;
    storeCombatLog(combatId, {
        player1: {
            userId: p1.userId,
            username: p1.username,
            avatar: p1.profilePicture || 'wizard',
            maxHP: p1.maxHP,
            damage: p1.damage,
        },
        player2: {
            userId: p2.userId,
            username: p2.username,
            avatar: p2.profilePicture || 'wizard',
            maxHP: p2.maxHP,
            damage: p2.damage,
        },
        winnerId,
        reason,
        turns: match.turnLog,
    });

    const endData = {
        combatId,
        winnerId,
        reason,
        player1: { userId: p1.userId, username: p1.username, ratingChange: p1Change, power: p1.power },
        player2: { userId: p2.userId, username: p2.username, ratingChange: p2Change, power: p2.power },
    };

    p1.socket.emit('pvp:end', { ...endData, you: endData.player1, opponent: endData.player2 });
    p2.socket.emit('pvp:end', { ...endData, you: endData.player2, opponent: endData.player1 });

    // Cleanup
    delete p1.socket.matchId;
    delete p2.socket.matchId;
    matches.delete(match.id);
}

async function getPlayerStats(userId) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { pvpRating: true, pvpWins: true, pvpLosses: true, profilePicture: true, gameState: true }
        });
        if (!user || !user.gameState) return null;

        const equipment = user.gameState.equipment || {};
        const { maxHP, damage, critChance, critMultiplier } = computeStatsFromEquipment(equipment);
        const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);
        const power = calculatePowerScore(totalHealth, totalDamage, bonuses);

        return {
            maxHP: Math.max(100, maxHP),
            damage: Math.max(10, damage),
            critChance,
            critMultiplier,
            rating: user.pvpRating,
            wins: user.pvpWins,
            losses: user.pvpLosses,
            power: Math.max(1, power),
            profilePicture: user.profilePicture,
        };
    } catch (err) {
        console.error('getPlayerStats error:', err);
        return null;
    }
}

async function getLeaderboard() {
    // Return cached leaderboard if still fresh
    if (leaderboardCache && (Date.now() - leaderboardCacheTime) < LEADERBOARD_CACHE_TTL) {
        return leaderboardCache;
    }
    try {
        const players = await prisma.user.findMany({
            where: { pvpWins: { gt: 0 } },
            orderBy: { pvpRating: 'desc' },
            take: 10,
            select: {
                id: true,
                username: true,
                pvpRating: true,
                pvpWins: true,
                pvpLosses: true,
                gameState: { select: { equipment: true } },
            },
        });

        const result = players.map(p => {
            let power = 0;
            if (p.gameState) {
                const { totalHealth, totalDamage, bonuses } = calculateStats(p.gameState.equipment || {});
                power = calculatePowerScore(totalHealth, totalDamage, bonuses);
            }
            return {
                id: p.id,
                username: p.username,
                rating: p.pvpRating,
                wins: p.pvpWins,
                losses: p.pvpLosses,
                power,
            };
        });

        leaderboardCache = result;
        leaderboardCacheTime = Date.now();
        return result;
    } catch (err) {
        console.error('Leaderboard error:', err);
        return [];
    }
}
