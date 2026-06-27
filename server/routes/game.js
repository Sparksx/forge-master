import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { MAX_FORGE_LEVEL } from '../../shared/stats.js';
import {
    isFiniteNumber,
    isNonNegativeNumber,
    isValidEquipment,
    isValidPlayer,
    isValidForgeHighestLevel,
} from '../lib/state-validation.js';

const router = Router();

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
                    gold: 100, // fresh players start with a small purse (STARTING_GOLD)
                    forgeLevel: 1,
                }
            });
        }

        res.json({
            equipment: state.equipment,
            gold: state.gold,
            forgeLevel: state.forgeLevel,
            player: state.player,
            forgeHighestLevel: state.forgeHighestLevel,
        });
    } catch (err) {
        console.error('Load state error:', err);
        res.status(500).json({ error: 'Failed to load game state' });
    }
});

// PUT /api/game/state — save player's game state
router.put('/state', requireAuth, async (req, res) => {
    const { equipment, gold, forgeLevel, player, forgeHighestLevel } = req.body;

    try {
        const data = {};
        if (equipment !== undefined) {
            if (!isValidEquipment(equipment)) {
                return res.status(400).json({ error: 'Invalid equipment structure' });
            }
            data.equipment = equipment;
        }
        if (gold !== undefined) {
            if (!isNonNegativeNumber(gold)) {
                return res.status(400).json({ error: 'Gold must be a non-negative number' });
            }
            data.gold = Math.floor(gold);
        }
        if (forgeLevel !== undefined) {
            if (!isFiniteNumber(forgeLevel) || forgeLevel < 1 || forgeLevel > MAX_FORGE_LEVEL) {
                return res.status(400).json({ error: 'Invalid forge level' });
            }
            data.forgeLevel = Math.floor(forgeLevel);
        }
        if (player !== undefined) {
            if (!isValidPlayer(player)) {
                return res.status(400).json({ error: 'Invalid player structure' });
            }
            data.player = player;
        }
        if (forgeHighestLevel !== undefined) {
            if (!isValidForgeHighestLevel(forgeHighestLevel)) {
                return res.status(400).json({ error: 'Invalid forgeHighestLevel structure' });
            }
            data.forgeHighestLevel = forgeHighestLevel;
        }

        const state = await prisma.gameState.upsert({
            where: { userId: req.user.userId },
            update: data,
            create: {
                userId: req.user.userId,
                equipment: equipment || {},
                gold: typeof gold === 'number' ? Math.floor(gold) : 100, // STARTING_GOLD
                forgeLevel: forgeLevel || 1,
                player: player || { level: 1, xp: 0, profilePicture: 'wizard' },
                forgeHighestLevel: forgeHighestLevel || {},
            }
        });

        res.json({ message: 'Saved', updatedAt: state.updatedAt });
    } catch (err) {
        console.error('Save state error:', err);
        res.status(500).json({ error: 'Failed to save game state' });
    }
});

export default router;
