import { Router } from 'express';
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const router = Router();

// ─── PUBLIC: GET /api/monsters/templates ─────────────────────────
// Returns all monster templates with sprite info for the game client.
router.get('/templates', async (req, res) => {
    try {
        const monsters = await prisma.monsterTemplate.findMany({
            include: {
                sprite: true,
                spriteSheet: true,
            },
            orderBy: { wave: 'asc' },
        });

        // Build a format the client can use directly
        const spriteSheet = monsters.length > 0 && monsters[0].spriteSheet
            ? { file: monsters[0].spriteSheet.file, width: monsters[0].spriteSheet.width, height: monsters[0].spriteSheet.height }
            : null;

        const templates = monsters.map(m => ({
            slug: m.slug,
            name: m.name,
            emoji: m.emoji,
            color: m.color,
            wave: m.wave,
            hpMultiplier: m.hpMultiplier,
            dmgMultiplier: m.dmgMultiplier,
            speedModifier: m.speedModifier,
            sprite: m.sprite
                ? { x: m.sprite.spriteX, y: m.sprite.spriteY, w: m.sprite.spriteW, h: m.sprite.spriteH }
                : null,
        }));

        res.json({ spriteSheet, templates });
    } catch (err) {
        console.error('Monster templates error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN ROUTES — require auth + admin role
// ══════════════════════════════════════════════════════════════════

// ─── GET /api/monsters/admin/list ────────────────────────────────
router.get('/admin/list', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const monsters = await prisma.monsterTemplate.findMany({
            include: {
                sprite: { include: { spriteSheet: true } },
                spriteSheet: true,
            },
            orderBy: { wave: 'asc' },
        });
        res.json({ monsters });
    } catch (err) {
        console.error('Admin list monsters error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/monsters/admin ────────────────────────────────────
router.post('/admin', requireAuth, requireRole('admin'), async (req, res) => {
    const { slug, name, emoji, color, wave, hpMultiplier, dmgMultiplier, speedModifier, spriteId } = req.body;

    if (!slug || !name || !emoji || !color || wave == null) {
        return res.status(400).json({ error: 'slug, name, emoji, color and wave are required' });
    }

    try {
        const data = {
            slug: slug.trim(),
            name: name.trim(),
            emoji,
            color,
            wave: parseInt(wave),
            hpMultiplier: hpMultiplier != null ? parseFloat(hpMultiplier) : 1.0,
            dmgMultiplier: dmgMultiplier != null ? parseFloat(dmgMultiplier) : 1.0,
            speedModifier: speedModifier != null ? parseInt(speedModifier) : 0,
        };

        if (spriteId) {
            const sprite = await prisma.sprite.findUnique({ where: { id: parseInt(spriteId) } });
            if (!sprite) return res.status(400).json({ error: 'Sprite not found' });
            data.spriteId = sprite.id;
            data.spriteSheetId = sprite.spriteSheetId;
        }

        const monster = await prisma.monsterTemplate.create({
            data,
            include: { sprite: true, spriteSheet: true },
        });

        await logAudit(req.user.userId, 'create_monster', null, { monsterId: monster.id, slug });

        res.status(201).json({ monster });
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(409).json({ error: `A monster with slug "${slug}" already exists` });
        }
        console.error('Admin create monster error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PUT /api/monsters/admin/:id ─────────────────────────────────
router.put('/admin/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid monster ID' });

    const { slug, name, emoji, color, wave, hpMultiplier, dmgMultiplier, speedModifier, spriteId } = req.body;

    const data = {};
    if (slug !== undefined) data.slug = slug.trim();
    if (name !== undefined) data.name = name.trim();
    if (emoji !== undefined) data.emoji = emoji;
    if (color !== undefined) data.color = color;
    if (wave !== undefined) data.wave = parseInt(wave);
    if (hpMultiplier !== undefined) data.hpMultiplier = parseFloat(hpMultiplier);
    if (dmgMultiplier !== undefined) data.dmgMultiplier = parseFloat(dmgMultiplier);
    if (speedModifier !== undefined) data.speedModifier = parseInt(speedModifier);
    if (spriteId !== undefined) {
        const sprite = await prisma.sprite.findUnique({ where: { id: parseInt(spriteId) } });
        if (!sprite) return res.status(400).json({ error: 'Sprite not found' });
        data.spriteId = sprite.id;
        data.spriteSheetId = sprite.spriteSheetId;
    }

    try {
        const monster = await prisma.monsterTemplate.update({
            where: { id },
            data,
            include: { sprite: true, spriteSheet: true },
        });

        await logAudit(req.user.userId, 'update_monster', null, { monsterId: id, changes: Object.keys(data) });

        res.json({ monster });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ error: 'Monster not found' });
        if (err.code === 'P2002') return res.status(409).json({ error: `A monster with that slug already exists` });
        console.error('Admin update monster error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── DELETE /api/monsters/admin/:id ──────────────────────────────
router.delete('/admin/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid monster ID' });

    try {
        const monster = await prisma.monsterTemplate.findUnique({ where: { id } });
        if (!monster) return res.status(404).json({ error: 'Monster not found' });

        await prisma.monsterTemplate.delete({ where: { id } });
        await logAudit(req.user.userId, 'delete_monster', null, { monsterId: id, slug: monster.slug });

        res.json({ message: 'Monster deleted', id });
    } catch (err) {
        console.error('Admin delete monster error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
