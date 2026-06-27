import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { playerPowerScore } from '../../shared/stats.js';
import { clanPerks, clanLevelFromXp } from '../../shared/clan-config.js';

const router = Router();

// ─── GET /api/players/:id/profile ────────────────────────────────
// Public profile for any player: headline stats + equipped gear, so the client
// can render the shared profile modal (and offer a friendly duel) from anywhere
// — the PvP leaderboard, not just the clan roster. Power is recomputed
// server-side from each item's slot/level/tier (tamper-resistant).
router.get('/:id/profile', requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid player id' });
    try {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true, username: true, profilePicture: true,
                pvpRating: true, pvpWins: true, pvpLosses: true,
                gameState: { select: { equipment: true, player: true } },
                clanMembership: { select: { clan: { select: { xp: true } } } },
            },
        });
        if (!user) return res.status(404).json({ error: 'Player not found' });

        const gs = user.gameState;
        const player = (gs && typeof gs.player === 'object' && gs.player) || {};
        const equipment = (gs && typeof gs.equipment === 'object' && gs.equipment) || {};
        const level = Number.isFinite(player.level) ? player.level : 1;
        const clanXp = user.clanMembership?.clan?.xp;
        const statBonusPct = typeof clanXp === 'number' ? (clanPerks(clanLevelFromXp(clanXp)).statBonusPct || 0) : 0;

        res.json({
            userId: user.id,
            username: user.username,
            avatar: user.profilePicture || 'wizard',
            frame: typeof player.frame === 'string' ? player.frame : 'none',
            level,
            power: playerPowerScore(equipment, level, statBonusPct),
            rating: user.pvpRating ?? 1000,
            wins: user.pvpWins ?? 0,
            losses: user.pvpLosses ?? 0,
            equipment,
        });
    } catch (err) {
        console.error('Player profile error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
