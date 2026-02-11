import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const router = Router();

const VALID_SLOTS = ['hat', 'armor', 'belt', 'boots', 'gloves', 'necklace', 'ring', 'weapon'];

function isValidItem(item) {
    if (item === null) return true;
    if (typeof item !== 'object' || Array.isArray(item)) return false;
    if (typeof item.level !== 'number' || item.level < 1) return false;
    if (typeof item.tier !== 'number' || item.tier < 1 || item.tier > 6) return false;
    if (typeof item.type !== 'string' || !VALID_SLOTS.includes(item.type)) return false;
    if (item.bonuses !== undefined) {
        if (!Array.isArray(item.bonuses)) return false;
        for (const b of item.bonuses) {
            if (typeof b !== 'object' || !b.type || typeof b.value !== 'number') return false;
        }
    }
    return true;
}

function isValidEquipment(equipment) {
    if (typeof equipment !== 'object' || Array.isArray(equipment) || equipment === null) return false;
    for (const [slot, item] of Object.entries(equipment)) {
        if (!VALID_SLOTS.includes(slot)) return false;
        if (!isValidItem(item)) return false;
    }
    return true;
}

function isValidCombat(combat) {
    if (typeof combat !== 'object' || Array.isArray(combat) || combat === null) return false;
    const { currentWave, currentSubWave, highestWave, highestSubWave } = combat;
    if (typeof currentWave !== 'number' || currentWave < 1) return false;
    if (typeof currentSubWave !== 'number' || currentSubWave < 1) return false;
    if (typeof highestWave !== 'number' || highestWave < 1) return false;
    if (typeof highestSubWave !== 'number' || highestSubWave < 1) return false;
    return true;
}

function isValidForgeUpgrade(forgeUpgrade) {
    if (forgeUpgrade === null) return true;
    if (typeof forgeUpgrade !== 'object' || Array.isArray(forgeUpgrade)) return false;
    if (typeof forgeUpgrade.targetLevel !== 'number' || forgeUpgrade.targetLevel < 2) return false;
    if (typeof forgeUpgrade.startedAt !== 'number' && typeof forgeUpgrade.startedAt !== 'string') return false;
    return true;
}

function isValidPlayer(player) {
    if (typeof player !== 'object' || Array.isArray(player) || player === null) return false;
    if (typeof player.level !== 'number' || player.level < 1 || player.level > 100) return false;
    if (typeof player.xp !== 'number' || player.xp < 0) return false;
    return true;
}

function isValidResearch(research) {
    if (typeof research !== 'object' || Array.isArray(research) || research === null) return false;
    if (research.completed && typeof research.completed !== 'object') return false;
    if (research.active !== null && research.active !== undefined) {
        if (typeof research.active !== 'object') return false;
    }
    if (research.queue !== undefined && !Array.isArray(research.queue)) return false;
    return true;
}

function isValidForgeHighestLevel(forgeHighestLevel) {
    if (typeof forgeHighestLevel !== 'object' || Array.isArray(forgeHighestLevel) || forgeHighestLevel === null) return false;
    return true;
}

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
            essence: state.essence,
            player: state.player,
            research: state.research,
            forgeHighestLevel: state.forgeHighestLevel,
        });
    } catch (err) {
        console.error('Load state error:', err);
        res.status(500).json({ error: 'Failed to load game state' });
    }
});

// PUT /api/game/state — save player's game state
router.put('/state', requireAuth, async (req, res) => {
    const { equipment, gold, forgeLevel, forgeUpgrade, combat, essence, player, research, forgeHighestLevel } = req.body;

    try {
        const data = {};
        if (equipment !== undefined) {
            if (!isValidEquipment(equipment)) {
                return res.status(400).json({ error: 'Invalid equipment structure' });
            }
            data.equipment = equipment;
        }
        if (typeof gold === 'number' && gold >= 0) data.gold = Math.floor(gold);
        if (typeof forgeLevel === 'number' && forgeLevel >= 1) data.forgeLevel = Math.floor(forgeLevel);
        if (forgeUpgrade !== undefined) {
            if (!isValidForgeUpgrade(forgeUpgrade)) {
                return res.status(400).json({ error: 'Invalid forgeUpgrade structure' });
            }
            data.forgeUpgrade = forgeUpgrade;
        }
        if (combat !== undefined) {
            if (!isValidCombat(combat)) {
                return res.status(400).json({ error: 'Invalid combat structure' });
            }
            data.combat = combat;
        }
        if (typeof essence === 'number' && essence >= 0) data.essence = Math.floor(essence);
        if (player !== undefined) {
            if (!isValidPlayer(player)) {
                return res.status(400).json({ error: 'Invalid player structure' });
            }
            data.player = player;
        }
        if (research !== undefined) {
            if (!isValidResearch(research)) {
                return res.status(400).json({ error: 'Invalid research structure' });
            }
            data.research = research;
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
                gold: gold || 0,
                forgeLevel: forgeLevel || 1,
                forgeUpgrade: forgeUpgrade || null,
                combat: combat || { currentWave: 1, currentSubWave: 1, highestWave: 1, highestSubWave: 1 },
                essence: typeof essence === 'number' ? Math.floor(essence) : 0,
                player: player || { level: 1, xp: 0, profilePicture: 'wizard' },
                research: research || { completed: {}, active: null, queue: [] },
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
