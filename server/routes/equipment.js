import { Router } from 'express';
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const router = Router();

// ─── PUBLIC: GET /api/equipment/templates ─────────────────────────
// Returns all item templates + sprite sheets for the game client.
// No auth required — game needs this data to render equipment.
router.get('/templates', async (req, res) => {
    try {
        const [spriteSheets, items] = await Promise.all([
            prisma.spriteSheet.findMany(),
            prisma.itemTemplate.findMany({
                include: { sprite: true },
                orderBy: [{ type: 'asc' }, { tier: 'asc' }, { name: 'asc' }],
            }),
        ]);

        // Build SPRITE_SHEETS format: { type: { file, width, height } }
        const sheets = {};
        for (const s of spriteSheets) {
            sheets[s.type] = { file: s.file, width: s.width, height: s.height };
        }

        // Build EQUIPMENT_TEMPLATES format: { type: { tier: [{ skin, name, sprite }] } }
        const templates = {};
        for (const item of items) {
            if (!templates[item.type]) templates[item.type] = {};
            if (!templates[item.type][item.tier]) templates[item.type][item.tier] = [];
            const spriteData = item.sprite
                ? { x: item.sprite.spriteX, y: item.sprite.spriteY, w: item.sprite.spriteW, h: item.sprite.spriteH }
                : { x: 0, y: 0, w: 0, h: 0 };
            templates[item.type][item.tier].push({
                skin: item.skin,
                name: item.name,
                sprite: spriteData,
            });
        }

        res.json({ spriteSheets: sheets, templates });
    } catch (err) {
        console.error('Equipment templates error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN ROUTES — require auth + admin role
// ══════════════════════════════════════════════════════════════════

// ─── GET /api/equipment/admin/items ───────────────────────────────
// List all item templates (with sprite sheet and sprite info)
router.get('/admin/items', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const items = await prisma.itemTemplate.findMany({
            include: { spriteSheet: true, sprite: { include: { spriteSheet: true } } },
            orderBy: [{ type: 'asc' }, { tier: 'asc' }, { name: 'asc' }],
        });
        res.json({ items });
    } catch (err) {
        console.error('Admin list items error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/equipment/admin/sprite-sheets ───────────────────────
// List all sprite sheets
router.get('/admin/sprite-sheets', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const sheets = await prisma.spriteSheet.findMany({
            orderBy: { type: 'asc' },
        });
        res.json({ sheets });
    } catch (err) {
        console.error('Admin list sheets error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/equipment/admin/items ──────────────────────────────
// Create a new item template
router.post('/admin/items', requireAuth, requireRole('admin'), async (req, res) => {
    const { type, tier, skin, name, spriteId } = req.body;

    if (!type || !skin || !name) {
        return res.status(400).json({ error: 'type, skin and name are required' });
    }
    if (!tier || tier < 1 || tier > 7) {
        return res.status(400).json({ error: 'tier must be between 1 and 7' });
    }
    if (!spriteId) {
        return res.status(400).json({ error: 'spriteId is required' });
    }

    try {
        // Find sprite sheet for this type
        const sheet = await prisma.spriteSheet.findUnique({ where: { type } });
        if (!sheet) {
            return res.status(400).json({ error: `No sprite sheet found for type "${type}"` });
        }

        // Verify sprite exists
        const sprite = await prisma.sprite.findUnique({ where: { id: parseInt(spriteId) } });
        if (!sprite) {
            return res.status(400).json({ error: 'Sprite not found' });
        }

        const item = await prisma.itemTemplate.create({
            data: {
                type,
                tier: parseInt(tier),
                skin: skin.trim(),
                name: name.trim(),
                spriteId: sprite.id,
                spriteSheetId: sheet.id,
            },
            include: { spriteSheet: true, sprite: { include: { spriteSheet: true } } },
        });

        await logAudit(req.user.userId, 'create_item', null, { itemId: item.id, skin, type, tier });

        res.status(201).json({ item });
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(409).json({ error: `An item with skin "${skin}" already exists` });
        }
        console.error('Admin create item error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PUT /api/equipment/admin/items/:id ───────────────────────────
// Update an item template
router.put('/admin/items/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid item ID' });

    const { type, tier, skin, name, spriteId } = req.body;

    const data = {};
    if (type !== undefined) data.type = type;
    if (tier !== undefined) {
        if (tier < 1 || tier > 7) return res.status(400).json({ error: 'tier must be between 1 and 7' });
        data.tier = parseInt(tier);
    }
    if (skin !== undefined) data.skin = skin.trim();
    if (name !== undefined) data.name = name.trim();
    if (spriteId !== undefined) {
        const sprite = await prisma.sprite.findUnique({ where: { id: parseInt(spriteId) } });
        if (!sprite) {
            return res.status(400).json({ error: 'Sprite not found' });
        }
        data.spriteId = sprite.id;
    }

    // If type changed, update sprite sheet reference
    if (type !== undefined) {
        const sheet = await prisma.spriteSheet.findUnique({ where: { type } });
        if (!sheet) {
            return res.status(400).json({ error: `No sprite sheet found for type "${type}"` });
        }
        data.spriteSheetId = sheet.id;
    }

    try {
        const item = await prisma.itemTemplate.update({
            where: { id },
            data,
            include: { spriteSheet: true, sprite: { include: { spriteSheet: true } } },
        });

        await logAudit(req.user.userId, 'update_item', null, { itemId: id, changes: Object.keys(data) });

        res.json({ item });
    } catch (err) {
        if (err.code === 'P2025') {
            return res.status(404).json({ error: 'Item not found' });
        }
        if (err.code === 'P2002') {
            return res.status(409).json({ error: `An item with skin "${skin}" already exists` });
        }
        console.error('Admin update item error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── DELETE /api/equipment/admin/items/:id ────────────────────────
// Delete an item template
router.delete('/admin/items/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid item ID' });

    try {
        const item = await prisma.itemTemplate.findUnique({ where: { id } });
        if (!item) return res.status(404).json({ error: 'Item not found' });

        await prisma.itemTemplate.delete({ where: { id } });
        await logAudit(req.user.userId, 'delete_item', null, { itemId: id, skin: item.skin, type: item.type });

        res.json({ message: 'Item deleted', id });
    } catch (err) {
        console.error('Admin delete item error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
