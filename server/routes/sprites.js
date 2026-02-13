import { Router } from 'express';
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const router = Router();

// ─── PUBLIC: GET /api/sprites ────────────────────────────────────
// Returns all sprites with their sprite sheet info.
router.get('/', async (req, res) => {
    try {
        const sprites = await prisma.sprite.findMany({
            include: { spriteSheet: true },
            orderBy: [{ spriteSheet: { type: 'asc' } }, { name: 'asc' }],
        });
        res.json({ sprites });
    } catch (err) {
        console.error('Sprites list error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN ROUTES — require auth + admin role
// ══════════════════════════════════════════════════════════════════

// ─── GET /api/sprites/admin/list ─────────────────────────────────
// List all sprites with sprite sheet info (admin view)
router.get('/admin/list', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const sprites = await prisma.sprite.findMany({
            include: {
                spriteSheet: true,
                _count: { select: { items: true } },
            },
            orderBy: [{ spriteSheet: { type: 'asc' } }, { name: 'asc' }],
        });
        res.json({ sprites });
    } catch (err) {
        console.error('Admin list sprites error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/sprites/admin ────────────────────────────────────
// Create a new sprite
router.post('/admin', requireAuth, requireRole('admin'), async (req, res) => {
    const { name, spriteX, spriteY, spriteW, spriteH, spriteSheetId } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'name is required' });
    }
    if (spriteX == null || spriteY == null || spriteW == null || spriteH == null) {
        return res.status(400).json({ error: 'Sprite coordinates (spriteX, spriteY, spriteW, spriteH) are required' });
    }
    if (!spriteSheetId) {
        return res.status(400).json({ error: 'spriteSheetId is required' });
    }

    try {
        const sheet = await prisma.spriteSheet.findUnique({ where: { id: parseInt(spriteSheetId) } });
        if (!sheet) {
            return res.status(400).json({ error: 'Sprite sheet not found' });
        }

        const sprite = await prisma.sprite.create({
            data: {
                name: name.trim(),
                spriteX: parseInt(spriteX),
                spriteY: parseInt(spriteY),
                spriteW: parseInt(spriteW),
                spriteH: parseInt(spriteH),
                spriteSheetId: sheet.id,
            },
            include: { spriteSheet: true },
        });

        await logAudit(req.user.userId, 'create_sprite', null, { spriteId: sprite.id, name });

        res.status(201).json({ sprite });
    } catch (err) {
        console.error('Admin create sprite error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PUT /api/sprites/admin/:id ─────────────────────────────────
// Update a sprite
router.put('/admin/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid sprite ID' });

    const { name, spriteX, spriteY, spriteW, spriteH, spriteSheetId } = req.body;

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (spriteX !== undefined) data.spriteX = parseInt(spriteX);
    if (spriteY !== undefined) data.spriteY = parseInt(spriteY);
    if (spriteW !== undefined) data.spriteW = parseInt(spriteW);
    if (spriteH !== undefined) data.spriteH = parseInt(spriteH);
    if (spriteSheetId !== undefined) {
        const sheet = await prisma.spriteSheet.findUnique({ where: { id: parseInt(spriteSheetId) } });
        if (!sheet) {
            return res.status(400).json({ error: 'Sprite sheet not found' });
        }
        data.spriteSheetId = sheet.id;
    }

    try {
        const sprite = await prisma.sprite.update({
            where: { id },
            data,
            include: { spriteSheet: true },
        });

        await logAudit(req.user.userId, 'update_sprite', null, { spriteId: id, changes: Object.keys(data) });

        res.json({ sprite });
    } catch (err) {
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Sprite not found' });
        }
        console.error('Admin update sprite error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── DELETE /api/sprites/admin/:id ──────────────────────────────
// Delete a sprite (only if not used by any ItemTemplate)
router.delete('/admin/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid sprite ID' });

    try {
        const sprite = await prisma.sprite.findUnique({
            where: { id },
            include: { _count: { select: { items: true } } },
        });
        if (!sprite) return res.status(404).json({ error: 'Sprite not found' });

        if (sprite._count.items > 0) {
            return res.status(409).json({
                error: `Ce sprite est utilise par ${sprite._count.items} equipement(s). Dissociez-les avant de supprimer.`,
            });
        }

        await prisma.sprite.delete({ where: { id } });
        await logAudit(req.user.userId, 'delete_sprite', null, { spriteId: id, name: sprite.name });

        res.json({ message: 'Sprite supprime', id });
    } catch (err) {
        console.error('Admin delete sprite error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
