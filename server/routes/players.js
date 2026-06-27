import { Router } from 'express';
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js';
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

// ─── PUBLIC: GET /api/players/templates ──────────────────────────
// Returns all player skin templates with sprite info for the game client.
router.get('/templates', async (req, res) => {
    try {
        const players = await prisma.playerTemplate.findMany({
            include: {
                sprite: true,
                spriteSheet: true,
            },
            orderBy: { id: 'asc' },
        });

        // Build a format the client can use directly
        const spriteSheet = players.length > 0 && players[0].spriteSheet
            ? { file: players[0].spriteSheet.file, width: players[0].spriteSheet.width, height: players[0].spriteSheet.height }
            : null;

        const templates = players.map(p => ({
            slug: p.slug,
            name: p.name,
            isDefault: p.isDefault,
            sprite: p.sprite
                ? { x: p.sprite.spriteX, y: p.sprite.spriteY, w: p.sprite.spriteW, h: p.sprite.spriteH }
                : null,
        }));

        res.set('Cache-Control', 'public, max-age=3600');
        res.json({ spriteSheet, templates });
    } catch (err) {
        console.error('Player templates error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN ROUTES — require auth + admin role
// ══════════════════════════════════════════════════════════════════

// ─── GET /api/players/admin/list ─────────────────────────────────
router.get('/admin/list', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const players = await prisma.playerTemplate.findMany({
            include: {
                sprite: { include: { spriteSheet: true } },
                spriteSheet: true,
            },
            orderBy: { id: 'asc' },
        });
        res.json({ players });
    } catch (err) {
        console.error('Admin list players error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/players/admin ─────────────────────────────────────
router.post('/admin', requireAuth, requireRole('admin'), async (req, res) => {
    const { slug, name, isDefault, spriteId } = req.body;

    if (!slug || !name) {
        return res.status(400).json({ error: 'slug and name are required' });
    }

    try {
        const data = {
            slug: slug.trim(),
            name: name.trim(),
            isDefault: isDefault === true,
        };

        if (spriteId) {
            const sprite = await prisma.sprite.findUnique({ where: { id: parseInt(spriteId) } });
            if (!sprite) return res.status(400).json({ error: 'Sprite not found' });
            data.spriteId = sprite.id;
            data.spriteSheetId = sprite.spriteSheetId;
        }

        const player = await prisma.playerTemplate.create({
            data,
            include: { sprite: true, spriteSheet: true },
        });

        await logAudit(req.user.userId, 'create_player_template', null, { playerId: player.id, slug });

        res.status(201).json({ player });
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(409).json({ error: `A player template with slug "${slug}" already exists` });
        }
        console.error('Admin create player template error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PUT /api/players/admin/:id ──────────────────────────────────
router.put('/admin/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid player template ID' });

    const { slug, name, isDefault, spriteId } = req.body;

    const data = {};
    if (slug !== undefined) data.slug = slug.trim();
    if (name !== undefined) data.name = name.trim();
    if (isDefault !== undefined) data.isDefault = isDefault === true;
    if (spriteId !== undefined) {
        const sprite = await prisma.sprite.findUnique({ where: { id: parseInt(spriteId) } });
        if (!sprite) return res.status(400).json({ error: 'Sprite not found' });
        data.spriteId = sprite.id;
        data.spriteSheetId = sprite.spriteSheetId;
    }

    try {
        const player = await prisma.playerTemplate.update({
            where: { id },
            data,
            include: { sprite: true, spriteSheet: true },
        });

        await logAudit(req.user.userId, 'update_player_template', null, { playerId: id, changes: Object.keys(data) });

        res.json({ player });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Player template not found' });
        if (err.code === 'P2002') return res.status(409).json({ error: `A player template with that slug already exists` });
        console.error('Admin update player template error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── DELETE /api/players/admin/:id ───────────────────────────────
router.delete('/admin/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid player template ID' });

    try {
        const player = await prisma.playerTemplate.findUnique({ where: { id } });
        if (!player) return res.status(404).json({ error: 'Player template not found' });

        await prisma.playerTemplate.delete({ where: { id } });
        await logAudit(req.user.userId, 'delete_player_template', null, { playerId: id, slug: player.slug });

        res.json({ message: 'Player template deleted', id });
    } catch (err) {
        console.error('Admin delete player template error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
