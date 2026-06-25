// Async PvP — fight a STORED snapshot of another player's gear, resolved
// server-side with the shared deterministic combat engine (anti-cheat) and
// replayed identically on the client. No live opponent, no real-time timers.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { computeStatsFromEquipment, playerPowerScore } from '../../shared/stats.js';
import { simulateBattle } from '../../shared/combat.js';
import { clanPerks, clanLevelFromXp } from '../../shared/clan-config.js';
import { pickOpponent, attackerEloChange } from '../lib/pvp-match.js';

const router = Router();

const CANDIDATE_POOL = 100; // recent players considered as opponents per fight

const USER_SELECT = {
    id: true, username: true, profilePicture: true, pvpRating: true,
    gameState: { select: { equipment: true, player: true } },
    clanMembership: { select: { clan: { select: { xp: true } } } },
};

// Clan stat perk (HP/damage %) so clan bonuses count in PvP exactly as in PvE.
function clanStatBonusPct(membership) {
    const xp = membership?.clan?.xp;
    if (typeof xp !== 'number') return 0;
    return clanPerks(clanLevelFromXp(xp)).statBonusPct || 0;
}

// Build a combat-ready fighter (full stats + power) from a user's saved snapshot.
function fighterFromUser(user) {
    const equipment = user.gameState?.equipment || {};
    const level = user.gameState?.player?.level || 1;
    const statBonusPct = clanStatBonusPct(user.clanMembership);
    const stats = computeStatsFromEquipment(equipment, level, statBonusPct);
    const power = playerPowerScore(equipment, level, statBonusPct);
    return {
        id: user.id,
        username: user.username,
        avatar: user.profilePicture || 'wizard',
        rating: user.pvpRating ?? 1000,
        maxHP: Math.max(100, stats.maxHP),
        damage: Math.max(10, stats.damage),
        critChance: stats.critChance,
        critMultiplier: stats.critMultiplier,
        healthRegen: stats.healthRegen,
        lifeSteal: stats.lifeSteal,
        attackSpeed: stats.attackSpeed,
        ranged: stats.ranged,
        power: Math.max(1, power),
    };
}

// The fields the client needs to render + replay the fight.
function publicFighter(f) {
    return {
        userId: f.id ?? null,
        username: f.username,
        avatar: f.avatar,
        rating: f.rating,
        power: f.power,
        maxHP: f.maxHP,
        damage: f.damage,
        critChance: f.critChance,
        critMultiplier: f.critMultiplier,
        healthRegen: f.healthRegen,
        lifeSteal: f.lifeSteal,
        attackSpeed: f.attackSpeed,
        ranged: f.ranged,
        isBot: !!f.isBot,
    };
}

// Synthesize a sparring opponent when no other eligible players exist (new/small
// server). Mirrors the attacker so the fight is fair; grants no rating (anti-farm).
function mirrorBot(attacker) {
    return { ...attacker, id: null, isBot: true, username: 'Sparring Dummy', avatar: 'robot' };
}

// POST /api/pvp/fight — resolve one async fight and (for real opponents) apply Elo.
router.post('/fight', requireAuth, async (req, res) => {
    try {
        const me = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { ...USER_SELECT, pvpWins: true, pvpLosses: true },
        });
        if (!me || !me.gameState) return res.status(400).json({ error: 'No game state to fight with' });
        const attacker = fighterFromUser(me);

        const others = await prisma.user.findMany({
            where: { id: { not: me.id }, gameState: { isNot: null } },
            select: USER_SELECT,
            orderBy: { updatedAt: 'desc' },
            take: CANDIDATE_POOL,
        });
        const opponent = pickOpponent(others.map(fighterFromUser), attacker.power) || mirrorBot(attacker);

        // Deterministic, replayable fight: same seed + stats => identical timeline.
        const seed = (Math.floor(Math.random() * 0xffffffff)) >>> 0;
        const result = simulateBattle(
            [{ ...attacker, id: 'player' }],
            [{ ...opponent, id: 'opp' }],
            seed,
        );
        const win = result.win;

        let ratingChange = 0;
        let newRating = attacker.rating;
        if (!opponent.isBot) {
            ratingChange = attackerEloChange(attacker.rating, opponent.rating, win, attacker.power, opponent.power);
            newRating = Math.max(0, attacker.rating + ratingChange);
            await prisma.user.update({
                where: { id: me.id },
                data: {
                    pvpRating: newRating,
                    ...(win ? { pvpWins: { increment: 1 } } : { pvpLosses: { increment: 1 } }),
                },
            });
        }

        res.json({
            seed,
            win,
            winner: win ? 'you' : 'opponent',
            ratingChange,
            newRating,
            events: result.events,
            you: publicFighter(attacker),
            opponent: publicFighter(opponent),
        });
    } catch (err) {
        console.error('PvP fight error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/pvp/leaderboard — top players by Elo, with recomputed power.
router.get('/leaderboard', requireAuth, async (req, res) => {
    try {
        const players = await prisma.user.findMany({
            where: { pvpWins: { gt: 0 } },
            orderBy: { pvpRating: 'desc' },
            take: 10,
            select: { ...USER_SELECT, pvpWins: true, pvpLosses: true },
        });
        const result = players.map((p) => ({
            id: p.id,
            username: p.username,
            rating: p.pvpRating,
            wins: p.pvpWins,
            losses: p.pvpLosses,
            power: fighterFromUser(p).power,
        }));
        res.json(result);
    } catch (err) {
        console.error('PvP leaderboard error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
