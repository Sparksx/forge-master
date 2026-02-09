import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/game/state — load player's game state
router.get('/state', requireAuth, async (req, res) => {
    try {
        let state = await prisma.gameState.findUnique({
            where: { userId: req.user.userId }
        });

        if (!state) {
            // Create default state if none exists
            state = await prisma.gameState.create({
                data: {
                    userId: req.user.userId,
                    equipment: {},
                    gold: 0,
                    forgeLevel: 1,
                    combat: { currentWave: 1, currentSubWave: 1, highestWave: 1, highestSubWave: 1 },
                }
            });
        }

        res.json({
            equipment: state.equipment,
            gold: state.gold,
            forgeLevel: state.forgeLevel,
            forgeUpgrade: state.forgeUpgrade,
            combat: state.combat,
        });
    } catch (err) {
        console.error('Load state error:', err);
        res.status(500).json({ error: 'Failed to load game state' });
    }
});

// PUT /api/game/state — save player's game state
router.put('/state', requireAuth, async (req, res) => {
    const { equipment, gold, forgeLevel, forgeUpgrade, combat } = req.body;

    try {
        const data = {};
        if (equipment !== undefined) data.equipment = equipment;
        if (typeof gold === 'number' && gold >= 0) data.gold = Math.floor(gold);
        if (typeof forgeLevel === 'number' && forgeLevel >= 1) data.forgeLevel = Math.floor(forgeLevel);
        if (forgeUpgrade !== undefined) data.forgeUpgrade = forgeUpgrade;
        if (combat !== undefined) data.combat = combat;

        const state = await prisma.gameState.upsert({
            where: { userId: req.user.userId },
            update: data,
            create: {
                userId: req.user.userId,
                equipment: equipment || {},
                gold: gold || 0,
                forgeLevel: forgeLevel || 1,
                forgeUpgrade: forgeUpgrade || null,
                combat: combat || { currentWave: 1, currentSubWave: 1, highestWave: 1, highestSubWave: 1 },
            }
        });

        res.json({ message: 'Saved', updatedAt: state.updatedAt });
    } catch (err) {
        console.error('Save state error:', err);
        res.status(500).json({ error: 'Failed to save game state' });
    }
});

export default router;
