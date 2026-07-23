import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { MAX_FORGE_LEVEL } from '../../shared/stats.js';
import {
    isValidEquipment,
    isValidCombat,
    isValidForgeUpgrade,
    isValidPlayer,
    isValidResearch,
    isValidForgeHighestLevel,
    isValidSkills,
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
                    combat: { currentWave: 1, currentSubWave: 1, highestWave: 1, highestSubWave: 1 },
                }
            });
        }

        res.json({
            equipment: state.equipment,
            gold: state.gold,
            diamonds: state.diamonds,
            forgeLevel: state.forgeLevel,
            forgeUpgrade: state.forgeUpgrade,
            combat: state.combat,
            essence: state.essence,
            player: state.player,
            research: state.research,
            forgeHighestLevel: state.forgeHighestLevel,
            skills: state.skills,
        });
    } catch (err) {
        console.error('Load state error:', err);
        res.status(500).json({ error: 'Failed to load game state' });
    }
});

// PUT /api/game/state — save player's game state
router.put('/state', requireAuth, async (req, res) => {
    const { equipment, forgeUpgrade, combat, player, research, forgeHighestLevel, skills } = req.body;
    // gold, diamonds, essence, forgeLevel are handled separately below (anti-cheat)

    try {
        const data = {};
        if (equipment !== undefined) {
            if (!isValidEquipment(equipment)) {
                return res.status(400).json({ error: 'Invalid equipment structure' });
            }
            data.equipment = equipment;
        }
        // Currency & forge level: accept from client only if it decreased (spending).
        // The client can spend gold (forge upgrades, cosmetics) but never inflate it.
        // Server-side grants (payments, expeditions, admin) use atomic increments.
        if (req.body.gold !== undefined || req.body.diamonds !== undefined ||
            req.body.essence !== undefined || req.body.forgeLevel !== undefined) {
            const current = await prisma.gameState.findUnique({
                where: { userId: req.user.userId },
                select: { gold: true, diamonds: true, essence: true, forgeLevel: true },
            });
            if (current) {
                const g = Math.floor(Number(req.body.gold));
                if (Number.isFinite(g) && g >= 0 && g <= current.gold) data.gold = g;
                const d = Math.floor(Number(req.body.diamonds));
                if (Number.isFinite(d) && d >= 0 && d <= current.diamonds) data.diamonds = d;
                const e = Math.floor(Number(req.body.essence));
                if (Number.isFinite(e) && e >= 0 && e <= current.essence) data.essence = e;
                const fl = Math.floor(Number(req.body.forgeLevel));
                if (Number.isFinite(fl) && fl >= 1 && fl >= current.forgeLevel && fl <= MAX_FORGE_LEVEL) {
                    data.forgeLevel = fl;
                }
            }
        }
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
        if (skills !== undefined) {
            if (!isValidSkills(skills)) {
                return res.status(400).json({ error: 'Invalid skills structure' });
            }
            data.skills = skills;
        }

        const state = await prisma.gameState.upsert({
            where: { userId: req.user.userId },
            update: data,
            create: {
                userId: req.user.userId,
                equipment: equipment || {},
                gold: 100, // STARTING_GOLD — server-authoritative
                forgeLevel: 1,
                forgeUpgrade: forgeUpgrade || null,
                combat: combat || { currentWave: 1, currentSubWave: 1, highestWave: 1, highestSubWave: 1 },
                player: player || { level: 1, xp: 0, profilePicture: 'wizard' },
                research: research || { completed: {}, active: null, queue: [] },
                forgeHighestLevel: forgeHighestLevel || {},
                skills: skills || { unlocked: {}, equipped: [] },
            }
        });

        res.json({ message: 'Saved', updatedAt: state.updatedAt });
    } catch (err) {
        console.error('Save state error:', err);
        res.status(500).json({ error: 'Failed to save game state' });
    }
});

export default router;
