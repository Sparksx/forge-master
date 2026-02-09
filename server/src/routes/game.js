import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/game/state - Load full game state
router.get('/state', async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.playerId },
      include: {
        equipment: true,
        forgeUpgrade: true,
      },
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Build equipment map (slot -> item)
    const equipment = {};
    for (const eq of player.equipment) {
      equipment[eq.slot] = {
        type: eq.slot,
        level: eq.level,
        tier: eq.tier,
        stats: eq.stats,
        statType: eq.statType,
        bonuses: eq.bonuses,
      };
    }

    // Build forge upgrade state
    let forgeUpgrade = null;
    if (player.forgeUpgrade) {
      forgeUpgrade = {
        targetLevel: player.forgeUpgrade.targetLevel,
        startedAt: Number(player.forgeUpgrade.startedAt),
        duration: player.forgeUpgrade.duration,
      };
    }

    res.json({
      gold: player.gold,
      forgeLevel: player.forgeLevel,
      equipment,
      forgeUpgrade,
    });
  } catch (error) {
    console.error('Load state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/game/save - Save full game state
router.post('/save', async (req, res) => {
  try {
    const { gold, forgeLevel, equipment, forgeUpgrade } = req.body;

    // Update player stats
    await prisma.player.update({
      where: { id: req.playerId },
      data: {
        gold: Math.max(0, Math.floor(gold || 0)),
        forgeLevel: Math.max(1, Math.floor(forgeLevel || 1)),
      },
    });

    // Upsert equipment
    if (equipment && typeof equipment === 'object') {
      for (const [slot, item] of Object.entries(equipment)) {
        if (!item) {
          // Remove equipment in this slot
          await prisma.equipment.deleteMany({
            where: { playerId: req.playerId, slot },
          });
          continue;
        }

        await prisma.equipment.upsert({
          where: {
            playerId_slot: { playerId: req.playerId, slot },
          },
          create: {
            playerId: req.playerId,
            slot,
            level: item.level,
            tier: item.tier || 1,
            stats: item.stats,
            statType: item.statType,
            bonuses: item.bonuses || [],
          },
          update: {
            level: item.level,
            tier: item.tier || 1,
            stats: item.stats,
            statType: item.statType,
            bonuses: item.bonuses || [],
          },
        });
      }
    }

    // Upsert forge upgrade
    if (forgeUpgrade) {
      await prisma.forgeUpgrade.upsert({
        where: { playerId: req.playerId },
        create: {
          playerId: req.playerId,
          targetLevel: forgeUpgrade.targetLevel,
          startedAt: BigInt(forgeUpgrade.startedAt),
          duration: forgeUpgrade.duration,
        },
        update: {
          targetLevel: forgeUpgrade.targetLevel,
          startedAt: BigInt(forgeUpgrade.startedAt),
          duration: forgeUpgrade.duration,
        },
      });
    } else {
      await prisma.forgeUpgrade.deleteMany({
        where: { playerId: req.playerId },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Save state error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/game/leaderboard - Top players by power score
router.get('/leaderboard', async (req, res) => {
  try {
    const players = await prisma.player.findMany({
      select: {
        id: true,
        username: true,
        gold: true,
        forgeLevel: true,
        equipment: true,
      },
      orderBy: { forgeLevel: 'desc' },
      take: 50,
    });

    const leaderboard = players.map(p => ({
      id: p.id,
      username: p.username,
      forgeLevel: p.forgeLevel,
      equipmentCount: p.equipment.length,
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
