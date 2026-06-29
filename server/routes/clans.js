import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import { gearPowerFromEquipment } from '../../shared/stats.js';
import { clanLevelFromXp, clanPerks, clanLevelProgress } from '../../shared/clan-config.js';
import { can, nextRankUp, nextRankDown } from '../../shared/clan-ranks.js';
import {
    EXPEDITIONS, expeditionDef, expeditionOutcome, maxActiveExpeditions,
    expeditionSlots, expeditionPlan,
    MISSIONS, missionDef, MISSION_PROGRESS_MAX_PER_REPORT,
} from '../../shared/clan-activities.js';

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

/** Serialize a clan (with members) into the client shape. Level comes from XP. */
function serializeClan(clan, { withMembers = false } = {}) {
    const level = clanLevelFromXp(clan.xp);
    const members = (clan.members || []).map((m) => {
        const gs = m.user?.gameState;
        const player = (gs && typeof gs.player === 'object' && gs.player) || {};
        return {
            userId: m.userId,
            username: m.user?.username || '???',
            avatar: m.user?.profilePicture || 'wizard',
            // Equipped profile frame (purely cosmetic) — surfaced so the roster can
            // render each member's frame around their avatar.
            frame: typeof player.frame === 'string' ? player.frame : 'none',
            role: m.role,
            contributed: m.contributed,
            xpContributed: m.xpContributed,
            power: memberPower(gs),
            // Equipped gear, surfaced so the public-profile modal can show & preview it.
            equipment: (gs && typeof gs.equipment === 'object' && gs.equipment) || {},
            level: Number.isFinite(player.level) ? player.level : 1,
            rating: m.user?.pvpRating ?? 1000,
            wins: m.user?.pvpWins ?? 0,
            losses: m.user?.pvpLosses ?? 0,
            // "Member since" and a best-effort "last seen" (the game-state save timestamp).
            joinedAt: m.joinedAt,
            lastSeen: gs?.updatedAt ?? null,
        };
    });
    const totalPower = members.reduce((s, m) => s + m.power, 0);
    const out = {
        id: clan.id,
        name: clan.name,
        tag: clan.tag,
        emblem: clan.emblem,
        description: clan.description,
        treasury: clan.treasury,
        xp: clan.xp,
        level,
        xpProgress: clanLevelProgress(clan.xp),
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
        include: {
            user: {
                select: {
                    username: true, profilePicture: true, pvpRating: true, pvpWins: true, pvpLosses: true,
                    gameState: { select: { equipment: true, player: true, updatedAt: true } },
                },
            },
        },
    },
};

const FULL_CLAN_INCLUDE = { ...MEMBER_INCLUDE, _count: { select: { members: true } } };

/** Load the requesting user's membership (or null). */
function getMembership(userId) {
    return prisma.clanMember.findUnique({ where: { userId } });
}

/** Reload + serialize a clan for the response. */
async function freshClan(id) {
    const clan = await prisma.clan.findUnique({ where: { id }, include: FULL_CLAN_INCLUDE });
    return clan ? serializeClan(clan, { withMembers: true }) : null;
}

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

// ── Activity serialization ──────────────────────────────────────────────────
function serializeExpedition(exp, now = Date.now()) {
    const members = (exp.members || []).map((m) => ({
        userId: m.userId, username: m.user?.username || '???', power: m.power,
    }));
    return {
        id: exp.id,
        defKey: exp.defKey,
        name: expeditionDef(exp.defKey)?.name || exp.defKey,
        difficulty: exp.difficulty,
        slots: exp.slots,
        filled: members.length,
        members,
        totalPower: members.reduce((s, m) => s + m.power, 0),
        powerReq: exp.powerReq,
        rewardXp: exp.rewardXp,
        rewardGold: exp.rewardGold, // total pot; per-head share = pot / participants
        startedBy: exp.startedBy,
        status: exp.status,
        success: exp.success,
        endsAt: exp.endsAt,
        msLeft: Math.max(0, new Date(exp.endsAt).getTime() - now),
    };
}

function serializeMission(m) {
    const top = (m.contributions || [])
        .slice()
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3)
        .map((c) => ({ userId: c.userId, username: c.user?.username || '???', amount: c.amount }));
    const def = missionDef(m.defKey);
    return {
        id: m.id,
        defKey: m.defKey,
        name: def?.name || m.defKey,
        desc: def?.desc || '',
        type: m.type,
        target: m.target,
        progress: m.progress,
        rewardXp: m.rewardXp,
        status: m.status,
        topContributors: top,
    };
}

/**
 * Resolve an expedition whose timer has elapsed: roll outcome, pay XP + gold.
 * Idempotent — the in-transaction `status` re-check means concurrent readers
 * never double-pay. Returns the gold credited to `forUserId` (0 if they weren't
 * aboard or the run was already resolved) so the triggering client can reconcile
 * its locally-authoritative gold without clobbering the reward on its next save.
 */
async function resolveExpedition(expId, forUserId = null) {
    return prisma.$transaction(async (tx) => {
        const exp = await tx.expedition.findUnique({ where: { id: expId }, include: { members: true } });
        if (!exp || exp.status !== 'active') return 0;
        const totalPower = exp.members.reduce((s, m) => s + m.power, 0);
        const filledSlots = exp.members.length;
        // `exp` carries the stored powerReq + slots, so outcome reflects this run's party size.
        const outcome = expeditionOutcome(exp, { totalPower, filledSlots }, Math.random());
        const xpGain = Math.round(exp.rewardXp * outcome.rewardMult);
        // rewardGold is the total pot — split it evenly across everyone who joined.
        const goldPot = Math.round(exp.rewardGold * outcome.rewardMult);
        const goldEach = filledSlots > 0 ? Math.round(goldPot / filledSlots) : 0;

        await tx.expedition.update({
            where: { id: exp.id },
            data: { status: 'resolved', success: outcome.success, resolvedAt: new Date() },
        });
        if (xpGain > 0) await tx.clan.update({ where: { id: exp.clanId }, data: { xp: { increment: xpGain } } });
        const xpEach = filledSlots > 0 ? Math.round(xpGain / filledSlots) : 0;
        let goldForUser = 0;
        for (const m of exp.members) {
            if (goldEach > 0) await tx.gameState.updateMany({ where: { userId: m.userId }, data: { gold: { increment: goldEach } } });
            if (xpEach > 0) await tx.clanMember.updateMany({ where: { userId: m.userId, clanId: exp.clanId }, data: { xpContributed: { increment: xpEach } } });
            if (goldEach > 0 && m.userId === forUserId) goldForUser = goldEach;
        }
        return goldForUser;
    });
}

/** Complete a mission whose progress reached target: grant clan XP once. */
async function completeMission(missionId) {
    await prisma.$transaction(async (tx) => {
        const m = await tx.mission.findUnique({ where: { id: missionId } });
        if (!m || m.status !== 'active' || m.progress < m.target) return;
        await tx.mission.update({ where: { id: m.id }, data: { status: 'completed' } });
        await tx.clan.update({ where: { id: m.clanId }, data: { xp: { increment: m.rewardXp } } });
    });
}

// ── Listing / detail ────────────────────────────────────────────────────────

// GET /api/clans — top clans by XP, optional ?q= search
router.get('/', requireAuth, async (req, res) => {
    try {
        const q = (req.query.q || '').toString().trim();
        const where = q
            ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { tag: { contains: q, mode: 'insensitive' } }] }
            : {};
        const clans = await prisma.clan.findMany({
            where,
            orderBy: { xp: 'desc' },
            take: 25,
            include: FULL_CLAN_INCLUDE,
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
        const membership = await getMembership(req.user.userId);
        if (!membership) return res.json({ clan: null });
        const clan = await prisma.clan.findUnique({ where: { id: membership.clanId }, include: FULL_CLAN_INCLUDE });
        res.json({ clan: clan ? serializeClan(clan, { withMembers: true }) : null });
    } catch (err) {
        console.error('Get my clan error:', err);
        res.status(500).json({ error: 'Failed to load clan' });
    }
});

// ── Expeditions ──────────────────────────────────────────────────────────────
// (Declared before GET '/:id' so the literal paths aren't captured as an id.)

// GET /api/clans/expeditions — my clan's expeditions + the catalog of launchables
router.get('/expeditions', requireAuth, async (req, res) => {
    try {
        const membership = await getMembership(req.user.userId);
        if (!membership) return res.status(400).json({ error: 'You are not in a clan' });

        // Lazily resolve any expedition whose timer has elapsed. The reward gold the
        // caller earns is summed so the client can credit its local save (server-granted
        // gold is otherwise clobbered by the client's next state save).
        const due = await prisma.expedition.findMany({
            where: { clanId: membership.clanId, status: 'active', endsAt: { lte: new Date() } },
            select: { id: true },
        });
        let goldGained = 0;
        for (const e of due) goldGained += await resolveExpedition(e.id, req.user.userId);

        const list = await prisma.expedition.findMany({
            where: { clanId: membership.clanId, OR: [{ status: 'active' }, { resolvedAt: { not: null } }] },
            orderBy: { id: 'desc' },
            take: 20,
            include: { members: { include: { user: { select: { username: true } } } } },
        });
        res.json({
            expeditions: list.map((e) => serializeExpedition(e)),
            catalog: EXPEDITIONS,
            myUserId: req.user.userId,
            myRole: membership.role,
            goldGained,
        });
    } catch (err) {
        console.error('List expeditions error:', err);
        res.status(500).json({ error: 'Failed to load expeditions' });
    }
});

// POST /api/clans/expeditions { defKey, durationHours } — launch (officer+). Free to
// launch: gated by clan level (harder runs unlock as the clan grows) and a cap on how
// many can run at once — never by gold, to keep clans non-pay-to-win. Slots scale with
// clan size and the reward scales with the chosen duration.
router.post('/expeditions', requireAuth, async (req, res) => {
    try {
        const membership = await getMembership(req.user.userId);
        if (!membership) return res.status(400).json({ error: 'You are not in a clan' });
        if (!can(membership.role, 'startActivity')) return res.status(403).json({ error: 'You lack permission to start expeditions' });

        const def = expeditionDef((req.body?.defKey || '').toString());
        if (!def) return res.status(400).json({ error: 'Unknown expedition' });

        await prisma.$transaction(async (tx) => {
            const clan = await tx.clan.findUnique({
                where: { id: membership.clanId },
                select: { xp: true, _count: { select: { members: true } } },
            });
            if (!clan) throw Object.assign(new Error('Clan not found'), { status: 404 });
            const level = clanLevelFromXp(clan.xp);
            if (level < def.minClanLevel) {
                throw Object.assign(new Error(`Reach clan level ${def.minClanLevel} to launch this expedition`), { status: 403 });
            }
            // Only count runs still in progress; expired-but-unresolved ones don't block.
            const activeCount = await tx.expedition.count({
                where: { clanId: membership.clanId, status: 'active', endsAt: { gt: new Date() } },
            });
            const cap = maxActiveExpeditions(level);
            if (activeCount >= cap) {
                throw Object.assign(new Error(`Your clan can only run ${cap} expedition${cap === 1 ? '' : 's'} at once`), { status: 409 });
            }

            const slots = expeditionSlots(clan._count.members);
            const plan = expeditionPlan(def, req.body?.durationHours, slots);
            await tx.expedition.create({
                data: {
                    clanId: membership.clanId,
                    defKey: def.key,
                    difficulty: def.difficulty,
                    slots: plan.slots,
                    rewardXp: plan.rewardXp,
                    rewardGold: plan.rewardGold,
                    powerReq: plan.powerReq,
                    startedBy: req.user.userId,
                    endsAt: new Date(Date.now() + plan.durationMs),
                },
            });
        });
        res.status(201).json(await freshClan(membership.clanId));
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Start expedition error:', err);
        res.status(500).json({ error: 'Failed to start expedition' });
    }
});

// POST /api/clans/expeditions/:id/join — register into a free slot
router.post('/expeditions/:id/join', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid expedition id' });
        const membership = await getMembership(req.user.userId);
        if (!membership) return res.status(400).json({ error: 'You are not in a clan' });

        await prisma.$transaction(async (tx) => {
            const exp = await tx.expedition.findUnique({ where: { id } });
            if (!exp || exp.clanId !== membership.clanId) throw Object.assign(new Error('Expedition not found'), { status: 404 });
            if (exp.status !== 'active' || new Date(exp.endsAt).getTime() <= Date.now()) throw Object.assign(new Error('This expedition is no longer recruiting'), { status: 409 });
            // Count inside transaction to prevent race conditions on slot limit
            const memberCount = await tx.expeditionMember.count({ where: { expeditionId: id } });
            if (memberCount >= exp.slots) throw Object.assign(new Error('All slots are taken'), { status: 409 });
            const already = await tx.expeditionMember.findUnique({ where: { expeditionId_userId: { expeditionId: id, userId: req.user.userId } } });
            if (already) throw Object.assign(new Error('You already joined this expedition'), { status: 409 });

            const gs = await tx.gameState.findUnique({ where: { userId: req.user.userId }, select: { equipment: true } });
            const power = gs ? gearPowerFromEquipment(gs.equipment) : 0;
            await tx.expeditionMember.create({ data: { expeditionId: id, userId: req.user.userId, power } });
        });
        res.json({ ok: true });
    } catch (err) {
        if (err.code === 'P2002') return res.status(409).json({ error: 'You already joined this expedition' });
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Join expedition error:', err);
        res.status(500).json({ error: 'Failed to join expedition' });
    }
});

// POST /api/clans/expeditions/:id/cancel — call off a running expedition. Allowed for
// the launcher (its author) or clan leadership (Leader / Co-Leader). No refund: launching
// is free. Cancelled runs leave the roster and free up a concurrency slot.
router.post('/expeditions/:id/cancel', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid expedition id' });
        const membership = await getMembership(req.user.userId);
        if (!membership) return res.status(400).json({ error: 'You are not in a clan' });

        await prisma.$transaction(async (tx) => {
            const exp = await tx.expedition.findUnique({ where: { id } });
            if (!exp || exp.clanId !== membership.clanId) throw Object.assign(new Error('Expedition not found'), { status: 404 });
            if (exp.status !== 'active') throw Object.assign(new Error('This expedition is no longer running'), { status: 409 });
            const isAuthor = exp.startedBy === req.user.userId;
            if (!isAuthor && !can(membership.role, 'cancelActivity')) {
                throw Object.assign(new Error('Only the launcher or clan leadership can cancel this'), { status: 403 });
            }
            await tx.expedition.update({ where: { id }, data: { status: 'cancelled' } });
        });
        res.json({ ok: true });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Cancel expedition error:', err);
        res.status(500).json({ error: 'Failed to cancel expedition' });
    }
});

// ── Missions ─────────────────────────────────────────────────────────────────

// GET /api/clans/missions — my clan's missions + the catalog
router.get('/missions', requireAuth, async (req, res) => {
    try {
        const membership = await getMembership(req.user.userId);
        if (!membership) return res.status(400).json({ error: 'You are not in a clan' });

        // Lazily complete any mission that already reached its target.
        const reached = await prisma.mission.findMany({
            where: { clanId: membership.clanId, status: 'active' },
            select: { id: true, progress: true, target: true },
        });
        for (const m of reached) if (m.progress >= m.target) await completeMission(m.id);

        const list = await prisma.mission.findMany({
            where: { clanId: membership.clanId },
            orderBy: { id: 'desc' },
            take: 20,
            include: { contributions: { include: { user: { select: { username: true } } } } },
        });
        res.json({
            missions: list.map(serializeMission),
            catalog: MISSIONS,
            myRole: membership.role,
        });
    } catch (err) {
        console.error('List missions error:', err);
        res.status(500).json({ error: 'Failed to load missions' });
    }
});

// POST /api/clans/missions { defKey } — start a mission (officer+)
router.post('/missions', requireAuth, async (req, res) => {
    try {
        const membership = await getMembership(req.user.userId);
        if (!membership) return res.status(400).json({ error: 'You are not in a clan' });
        if (!can(membership.role, 'startActivity')) return res.status(403).json({ error: 'You lack permission to start missions' });

        const def = missionDef((req.body?.defKey || '').toString());
        if (!def) return res.status(400).json({ error: 'Unknown mission' });

        const existing = await prisma.mission.findFirst({ where: { clanId: membership.clanId, defKey: def.key, status: 'active' } });
        if (existing) return res.status(409).json({ error: 'That mission is already active' });

        await prisma.mission.create({
            data: { clanId: membership.clanId, defKey: def.key, type: def.type, target: def.target, rewardXp: def.rewardXp },
        });
        res.status(201).json({ ok: true });
    } catch (err) {
        console.error('Start mission error:', err);
        res.status(500).json({ error: 'Failed to start mission' });
    }
});

// POST /api/clans/missions/progress { type, amount } — report play progress
router.post('/missions/progress', requireAuth, async (req, res) => {
    try {
        const membership = await getMembership(req.user.userId);
        if (!membership) return res.status(400).json({ error: 'You are not in a clan' });

        const type = (req.body?.type || '').toString();
        let amount = Math.floor(Number(req.body?.amount));
        if (!Number.isInteger(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
        amount = Math.min(amount, MISSION_PROGRESS_MAX_PER_REPORT); // clamp (basic anti-cheat)

        const missions = await prisma.mission.findMany({ where: { clanId: membership.clanId, type, status: 'active' } });
        const completed = [];
        for (const m of missions) {
            const remaining = Math.max(0, m.target - m.progress);
            const applied = Math.min(amount, remaining);
            if (applied <= 0) continue;
            await prisma.$transaction([
                prisma.mission.update({ where: { id: m.id }, data: { progress: { increment: applied } } }),
                prisma.clanMember.update({ where: { userId: req.user.userId }, data: { xpContributed: { increment: applied } } }),
                prisma.missionContribution.upsert({
                    where: { missionId_userId: { missionId: m.id, userId: req.user.userId } },
                    create: { missionId: m.id, userId: req.user.userId, amount: applied },
                    update: { amount: { increment: applied } },
                }),
            ]);
            if (m.progress + applied >= m.target) { await completeMission(m.id); completed.push(m.defKey); }
        }
        res.json({ ok: true, completed });
    } catch (err) {
        console.error('Mission progress error:', err);
        res.status(500).json({ error: 'Failed to report progress' });
    }
});

// GET /api/clans/:id — clan detail with members
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid clan id' });
        const clan = await prisma.clan.findUnique({ where: { id }, include: FULL_CLAN_INCLUDE });
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
        const existing = await getMembership(req.user.userId);
        if (existing) return res.status(409).json({ error: 'You are already in a clan' });

        const clan = await prisma.clan.create({
            data: {
                name, tag, emblem, description,
                ownerId: req.user.userId,
                members: { create: { userId: req.user.userId, role: 'owner' } },
            },
            include: FULL_CLAN_INCLUDE,
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

            const { maxMembers } = clanPerks(clanLevelFromXp(clan.xp));
            if (clan._count.members >= maxMembers) {
                throw Object.assign(new Error('This clan is full'), { status: 409 });
            }

            await tx.clanMember.create({ data: { clanId: id, userId: req.user.userId, role: 'member' } });
        });

        res.json(await freshClan(id));
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
        const membership = await getMembership(req.user.userId);
        if (!membership) return res.status(400).json({ error: 'You are not in a clan' });

        const clanId = membership.clanId;

        await prisma.$transaction(async (tx) => {
            await tx.clanMember.delete({ where: { userId: req.user.userId } });

            const clan = await tx.clan.findUnique({ where: { id: clanId } });
            if (clan && clan.ownerId === req.user.userId) {
                const next = await tx.clanMember.findFirst({
                    where: { clanId },
                    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
                });
                if (next) {
                    await tx.clan.update({ where: { id: clanId }, data: { ownerId: next.userId } });
                    await tx.clanMember.update({ where: { id: next.id }, data: { role: 'owner' } });
                } else {
                    await tx.clan.delete({ where: { id: clanId } });
                }
            }
        });
        res.json({ ok: true });
    } catch (err) {
        console.error('Leave clan error:', err);
        res.status(500).json({ error: 'Failed to leave clan' });
    }
});

// POST /api/clans/contribute — add gold to the clan bank (treasury; non-power)
router.post('/contribute', requireAuth, async (req, res) => {
    try {
        const amount = Math.floor(Number(req.body?.amount));
        if (!Number.isInteger(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }
        const membership = await getMembership(req.user.userId);
        if (!membership) return res.status(400).json({ error: 'You are not in a clan' });

        // Gold check + deduction inside one interactive transaction to prevent race conditions
        const remainingGold = await prisma.$transaction(async (tx) => {
            const gameState = await tx.gameState.findUnique({ where: { userId: req.user.userId }, select: { gold: true } });
            if (!gameState || gameState.gold < amount) {
                throw Object.assign(new Error('Insufficient gold'), { status: 400 });
            }
            await tx.gameState.update({ where: { userId: req.user.userId }, data: { gold: { decrement: amount } } });
            await tx.clanMember.update({ where: { userId: req.user.userId }, data: { contributed: { increment: amount } } });
            await tx.clan.update({ where: { id: membership.clanId }, data: { treasury: { increment: amount } } });
            return gameState.gold - amount;
        });

        res.json({ ...(await freshClan(membership.clanId)), gold: remainingGold });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('Contribute error:', err);
        res.status(500).json({ error: 'Failed to contribute' });
    }
});

// ── Rank management ──────────────────────────────────────────────────────────

/** Load the actor's membership and a target member in the same clan. */
async function loadActorAndTarget(actorUserId, targetUserId) {
    const actor = await prisma.clanMember.findUnique({ where: { userId: actorUserId } });
    if (!actor) return { error: { status: 400, message: 'You are not in a clan' } };
    const target = await prisma.clanMember.findUnique({ where: { userId: targetUserId } });
    if (!target || target.clanId !== actor.clanId) return { error: { status: 404, message: 'Member not found in your clan' } };
    if (target.userId === actor.userId) return { error: { status: 400, message: "You can't do that to yourself" } };
    return { actor, target };
}

// POST /api/clans/members/:userId/promote
router.post('/members/:userId/promote', requireAuth, async (req, res) => {
    try {
        const targetUserId = Number(req.params.userId);
        if (!Number.isInteger(targetUserId)) return res.status(400).json({ error: 'Invalid member id' });
        const { actor, target, error } = await loadActorAndTarget(req.user.userId, targetUserId);
        if (error) return res.status(error.status).json({ error: error.message });
        if (!can(actor.role, 'promote', target.role)) return res.status(403).json({ error: 'You lack permission to promote this member' });

        const newRole = nextRankUp(target.role);
        if (!newRole) return res.status(400).json({ error: 'That member is already at the top assignable rank' });
        // Never let a promotion reach or exceed the actor's own rank.
        if (!can(actor.role, 'promote', newRole)) return res.status(403).json({ error: 'You can only promote below your own rank' });

        await prisma.clanMember.update({ where: { userId: targetUserId }, data: { role: newRole } });
        res.json(await freshClan(actor.clanId));
    } catch (err) {
        console.error('Promote error:', err);
        res.status(500).json({ error: 'Failed to promote member' });
    }
});

// POST /api/clans/members/:userId/demote
router.post('/members/:userId/demote', requireAuth, async (req, res) => {
    try {
        const targetUserId = Number(req.params.userId);
        if (!Number.isInteger(targetUserId)) return res.status(400).json({ error: 'Invalid member id' });
        const { actor, target, error } = await loadActorAndTarget(req.user.userId, targetUserId);
        if (error) return res.status(error.status).json({ error: error.message });
        if (!can(actor.role, 'demote', target.role)) return res.status(403).json({ error: 'You lack permission to demote this member' });

        const newRole = nextRankDown(target.role);
        if (!newRole) return res.status(400).json({ error: 'That member is already at the lowest rank' });

        await prisma.clanMember.update({ where: { userId: targetUserId }, data: { role: newRole } });
        res.json(await freshClan(actor.clanId));
    } catch (err) {
        console.error('Demote error:', err);
        res.status(500).json({ error: 'Failed to demote member' });
    }
});

// POST /api/clans/members/:userId/kick
router.post('/members/:userId/kick', requireAuth, async (req, res) => {
    try {
        const targetUserId = Number(req.params.userId);
        if (!Number.isInteger(targetUserId)) return res.status(400).json({ error: 'Invalid member id' });
        const { actor, target, error } = await loadActorAndTarget(req.user.userId, targetUserId);
        if (error) return res.status(error.status).json({ error: error.message });
        if (!can(actor.role, 'kick', target.role)) return res.status(403).json({ error: 'You lack permission to kick this member' });

        await prisma.clanMember.delete({ where: { userId: targetUserId } });
        res.json(await freshClan(actor.clanId));
    } catch (err) {
        console.error('Kick error:', err);
        res.status(500).json({ error: 'Failed to kick member' });
    }
});

// POST /api/clans/transfer { userId } — hand leadership to another member (owner only)
router.post('/transfer', requireAuth, async (req, res) => {
    try {
        const targetUserId = Number(req.body?.userId);
        if (!Number.isInteger(targetUserId)) return res.status(400).json({ error: 'Invalid member id' });
        const { actor, error } = await loadActorAndTarget(req.user.userId, targetUserId);
        if (error) return res.status(error.status).json({ error: error.message });
        if (!can(actor.role, 'transfer')) return res.status(403).json({ error: 'Only the Leader can transfer leadership' });

        await prisma.$transaction([
            prisma.clan.update({ where: { id: actor.clanId }, data: { ownerId: targetUserId } }),
            prisma.clanMember.update({ where: { userId: targetUserId }, data: { role: 'owner' } }),
            prisma.clanMember.update({ where: { userId: actor.userId }, data: { role: 'coleader' } }),
        ]);
        res.json(await freshClan(actor.clanId));
    } catch (err) {
        console.error('Transfer error:', err);
        res.status(500).json({ error: 'Failed to transfer leadership' });
    }
});

export default router;
