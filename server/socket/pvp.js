import prisma from '../lib/prisma.js';
import { computeStatsFromEquipment } from '../../shared/stats.js';
import { storeCombatLog } from './chat.js';

// Matchmaking queue: Map<socketId, { socket, userId, username, stats }>
const queue = new Map();

// Active matches: Map<matchId, MatchState>
const matches = new Map();

const TURN_TIMEOUT = 15000; // 15s per turn
const K_FACTOR = 32; // Elo K-factor

export function registerPvpHandlers(io, socket) {
    socket.on('pvp:queue', async () => {
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

        socket.emit('pvp:queued', {});
        tryMatch(io);
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

// Elo range starts at 100 and widens by 50 every 5 seconds of waiting
const BASE_ELO_RANGE = 100;
const ELO_RANGE_EXPANSION = 50;
const ELO_RANGE_INTERVAL = 5000; // ms

function tryMatch(io) {
    if (queue.size < 2) return;

    const entries = Array.from(queue.values());
    const now = Date.now();

    // Find the best Elo-compatible pair
    let bestPair = null;
    let bestDiff = Infinity;

    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const a = entries[i];
            const b = entries[j];
            const diff = Math.abs(a.stats.rating - b.stats.rating);

            // Calculate allowed range based on how long each player has been waiting
            const waitA = now - (a.queuedAt || now);
            const waitB = now - (b.queuedAt || now);
            const maxWait = Math.max(waitA, waitB);
            const allowedRange = BASE_ELO_RANGE + Math.floor(maxWait / ELO_RANGE_INTERVAL) * ELO_RANGE_EXPANSION;

            if (diff <= allowedRange && diff < bestDiff) {
                bestDiff = diff;
                bestPair = [a, b];
            }
        }
    }

    if (!bestPair) return; // No compatible pair yet, range will widen over time

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
        opponent: { username: p2.username, maxHP: p2.stats.maxHP, damage: p2.stats.damage, rating: p2.stats.rating },
    });
    p2.socket.emit('pvp:matched', {
        matchId,
        opponent: { username: p1.username, maxHP: p1.stats.maxHP, damage: p1.stats.damage, rating: p1.stats.rating },
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

async function endMatch(io, match, winnerId, reason) {
    if (match.turnTimer) clearTimeout(match.turnTimer);

    const p1 = match.player1;
    const p2 = match.player2;

    // Calculate Elo changes
    let p1Change = 0;
    let p2Change = 0;

    if (winnerId) {
        const expected1 = 1 / (1 + Math.pow(10, (p2.rating - p1.rating) / 400));
        const expected2 = 1 - expected1;
        const s1 = winnerId === p1.userId ? 1 : 0;
        const s2 = winnerId === p2.userId ? 1 : 0;

        p1Change = Math.round(K_FACTOR * (s1 - expected1));
        p2Change = Math.round(K_FACTOR * (s2 - expected2));
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
        player1: { userId: p1.userId, username: p1.username, ratingChange: p1Change },
        player2: { userId: p2.userId, username: p2.username, ratingChange: p2Change },
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
            select: { pvpRating: true, profilePicture: true, gameState: true }
        });
        if (!user || !user.gameState) return null;

        const equipment = user.gameState.equipment || {};
        const { maxHP, damage, critChance, critMultiplier } = computeStatsFromEquipment(equipment);

        return {
            maxHP: Math.max(100, maxHP),
            damage: Math.max(10, damage),
            critChance,
            critMultiplier,
            rating: user.pvpRating,
            profilePicture: user.profilePicture,
        };
    } catch (err) {
        console.error('getPlayerStats error:', err);
        return null;
    }
}

// computeStatsFromEquipment is now imported from shared/stats.js
