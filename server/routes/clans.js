import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { gearPowerFromEquipment } from '../../shared/stats.js';
import { clanLevelFromTreasury, clanPerks } from '../../shared/clan-config.js';

const router = Router();

/**
 * Power score for a single member from their saved equipment. Uses the
 * tamper-resistant calculation (recomputed from each item's slot/level/tier,
 * ignoring any client-supplied raw `stats`) so a modified save can't inflate a
 * member's standing on the clan leaderboard.
 */
function memberPower(gameState) {
    if (!gameState || !gameState.equipment) return 0;
    return gearPowerFromEquipment(gameState.equipment);
}

/** Serialize a clan (with members) into the client shape. */
function serializeClan(clan, { withMembers = false } = {}) {
    const level = clanLevelFromTreasury(clan.treasury);
    const members = (clan.members || []).map((m) => ({
        userId: m.userId,
        username: m.user?.username || '???',
        avatar: m.user?.profilePicture || 'wizard',
        role: m.role,
        contributed: m.contributed,
        power: memberPower(m.user?.gameState),
        rating: m.user?.pvpRating ?? 1000,
    }));
    const totalPower = members.reduce((s, m) => s + m.power, 0);
    const out = {
        id: clan.id,
        name: clan.name,
        tag: clan.tag,
        emblem: clan.emblem,
        description: clan.description,
        treasury: clan.treasury,
        level,
        perks: clanPerks(level),
        ownerId: clan.ownerId,
        memberCount: clan._count?.members ?? members.length,
        totalPower,
    };
    if (withMembers) {
        out.members = members.sort((a, b) => b.power - a.power);
    }
    return out;
}

const MEMBER_INCLUDE = {
    members: {
        include: { user: { select: { username: true, profilePicture: true, pvpRating: true, gameState: { select: { equipment: true } } } } },
    },
};

function validClanFields({ name, tag, emblem, description }) {
    if (typeof name !== 'string' || name.trim().length < 3 || name.trim().length > 30) {
        return 'Clan name must be 3–30 characters';
    }
    if (typeof tag !== 'string' || !/^[A-Za-z0-9]{2,5}$/.test(tag.trim())) {
        return 'Tag must be 2–5 letters or numbers';
    }
    if (emblem !== undefined && (typeof emblem !== 'string' || emblem.length > 10)) {
        return 'Invalid emblem';
    }
    if (description !== undefined && (typeof description !== 'string' || description.length > 200)) {
        return 'Description too long (200 max)';
    }
    return null;
}

// GET /api/clans — top clans by treasury, optional ?q= search
router.get('/', requireAuth, async (req, res) => {
    try {
        const q = (req.query.q || '').toString().trim();
        const where = q
            ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { tag: { contains: q, mode: 'insensitive' } }] }
            : {};
        const clans = await prisma.clan.findMany({
            where,
            orderBy: { treasury: 'desc' },
            take: 25,
            include: { ...MEMBER_INCLUDE, _count: { select: { members: true } } },
        });
        res.json(clans.map((c) => serializeClan(c)));
    } catch (err) {
        console.error('List clans error:', err);
        res.status(500).json({ error: 'Failed to list clans' });
    }
});

// GET /api/clans/mine — the requesting user's clan (or null)
router.get('/mine', requireAuth, async (req, res) => {
    try {
        const membership = await prisma.clanMember.findUnique({ where: { userId: req.user.userId } });
        if (!membership) return res.json({ clan: null });
        const clan = await prisma.clan.findUnique({
            where: { id: membership.clanId },
            include: { ...MEMBER_INCLUDE, _count: { select: { members: true } } },
        });
        res.json({ clan: clan ? serializeClan(clan, { withMembers: true }) : null });
    } catch (err) {
        console.error('Get my clan error:', err);
        res.status(500).json({ error: 'Failed to load clan' });
    }
});

// GET /api/clans/:id — clan detail with members
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid clan id' });
        const clan = await prisma.clan.findUnique({
            where: { id },
            include: { ...MEMBER_INCLUDE, _count: { select: { members: true } } },
        });
        if (!clan) return res.status(404).json({ error: 'Clan not found' });
        res.json(serializeClan(clan, { withMembers: true }));
    } catch (err) {
        console.error('Get clan error:', err);
        res.status(500).json({ error: 'Failed to load clan' });
    }
});

// POST /api/clans — create a clan (creator becomes owner)
router.post('/', requireAuth, async (req, res) => {
    const fieldError = validClanFields(req.body || {});
    if (fieldError) return res.status(400).json({ error: fieldError });

    const name = req.body.name.trim();
    const tag = req.body.tag.trim().toUpperCase();
    const emblem = (req.body.emblem || '⚔️').toString();
    const description = (req.body.description || '').toString();

    try {
        const existing = await prisma.clanMember.findUnique({ where: { userId: req.user.userId } });
        if (existing) return res.status(409).json({ error: 'You are already in a clan' });

        const clan = await prisma.clan.create({
            data: {
                name, tag, emblem, description,
                ownerId: req.user.userId,
                members: { create: { userId: req.user.userId, role: 'owner' } },
            },
            include: { ...MEMBER_INCLUDE, _count: { select: { members: true } } },
        });
        res.status(201).json(serializeClan(clan, { withMembers: true }));
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(409).json({ error: 'A clan with that name or tag already exists' });
        }
        console.error('Create clan error:', err);
        res.status(500).json({ error: 'Failed to create clan' });
    }
});

// POST /api/clans/:id/join
router.post('/:id/join', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid clan id' });

        // Use interactive transaction to prevent race conditions
        await prisma.$transaction(async (tx) => {
            const existing = await tx.clanMember.findUnique({ where: { userId: req.user.userId } });
            if (existing) throw Object.assign(new Error('You are already in a clan'), { status: 409 });

            const clan = await tx.clan.findUnique({ where: { id }, include: { _count: { select: { members: true } } } });
            if (!clan) throw Object.assign(new Error('Clan not found'), { status: 404 });

            const { maxMembers } = clanPerks(clanLevelFromTreasury(clan.treasury));
            if (clan._count.members >= maxMembers) {
                throw Object.assign(new Error('This clan is full'), { status: 409 });
            }

            await tx.clanMember.create({ data: { clanId: id, userId: req.user.userId, role: 'member' } });
        });

        const full = await prisma.clan.findUnique({
            where: { id },
            include: { ...MEMBER_INCLUDE, _count: { select: { members: true } } },
        });
        res.json(serializeClan(full, { withMembers: true }));
    } catch (err) {
        if (err.code === 'P2002') return res.status(409).json({ error: 'You are already in a clan' });
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Join clan error:', err);
        res.status(500).json({ error: 'Failed to join clan' });
    }
});

// POST /api/clans/leave — leave the current clan (owner transfers or disbands)
router.post('/leave', requireAuth, async (req, res) => {
    try {
        const membership = await prisma.clanMember.findUnique({ where: { userId: req.user.userId } });
        if (!membership) return res.status(400).json({ error: 'You are not in a clan' });

        const clanId = membership.clanId;
        await prisma.clanMember.delete({ where: { userId: req.user.userId } });

        // If the owner left, transfer ownership to the next-oldest member, or disband if empty.
        const clan = await prisma.clan.findUnique({ where: { id: clanId } });
        if (clan && clan.ownerId === req.user.userId) {
            const next = await prisma.clanMember.findFirst({
                where: { clanId },
                orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
            });
            if (next) {
                await prisma.$transaction([
                    prisma.clan.update({ where: { id: clanId }, data: { ownerId: next.userId } }),
                    prisma.clanMember.update({ where: { id: next.id }, data: { role: 'owner' } }),
                ]);
            } else {
                await prisma.clan.delete({ where: { id: clanId } });
            }
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('Leave clan error:', err);
        res.status(500).json({ error: 'Failed to leave clan' });
    }
});

// POST /api/clans/contribute — add gold to the clan treasury
router.post('/contribute', requireAuth, async (req, res) => {
    try {
        const amount = Math.floor(Number(req.body?.amount));
        if (!Number.isInteger(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }
        const membership = await prisma.clanMember.findUnique({ where: { userId: req.user.userId } });
        if (!membership) return res.status(400).json({ error: 'You are not in a clan' });

        // Verify the player actually has enough gold (server-side check)
        const gameState = await prisma.gameState.findUnique({ where: { userId: req.user.userId }, select: { gold: true } });
        if (!gameState || gameState.gold < amount) {
            return res.status(400).json({ error: 'Insufficient gold' });
        }

        // Atomically deduct gold from player AND credit the clan treasury
        await prisma.$transaction([
            prisma.gameState.update({ where: { userId: req.user.userId }, data: { gold: { decrement: amount } } }),
            prisma.clanMember.update({ where: { userId: req.user.userId }, data: { contributed: { increment: amount } } }),
            prisma.clan.update({ where: { id: membership.clanId }, data: { treasury: { increment: amount } } }),
        ]);

        const full = await prisma.clan.findUnique({
            where: { id: membership.clanId },
            include: { ...MEMBER_INCLUDE, _count: { select: { members: true } } },
        });
        res.json({ ...serializeClan(full, { withMembers: true }), gold: gameState.gold - amount });
    } catch (err) {
        console.error('Contribute error:', err);
        res.status(500).json({ error: 'Failed to contribute' });
    }
});

export default router;
