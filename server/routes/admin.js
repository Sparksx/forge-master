import { Router } from 'express';
import { requireAuth, requireRole, logAudit } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const router = Router();

// All admin routes require auth
router.use(requireAuth);

// ─── Helper: duration string to milliseconds ──────────────────────
function parseDuration(duration) {
    const match = duration?.match(/^(\d+)(m|h|d)$/);
    if (!match) return null;
    const val = parseInt(match[1]);
    switch (match[2]) {
        case 'm': return val * 60 * 1000;
        case 'h': return val * 60 * 60 * 1000;
        case 'd': return val * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

// ─── GET /api/admin/users/search?q= ──────────────────────────────
// Admin + Moderator: search users by username
router.get('/users/search', requireRole('admin', 'moderator'), async (req, res) => {
    const q = req.query.q?.trim();
    if (!q || q.length < 1) {
        return res.status(400).json({ error: 'Search query required' });
    }

    try {
        const users = await prisma.user.findMany({
            where: { username: { contains: q, mode: 'insensitive' } },
            select: {
                id: true, username: true, role: true, profilePicture: true,
                isGuest: true, createdAt: true,
                pvpRating: true, pvpWins: true, pvpLosses: true,
            },
            take: 20,
            orderBy: { username: 'asc' },
        });
        res.json({ users });
    } catch (err) {
        console.error('User search error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/admin/users/:id/profile ────────────────────────────
// Admin + Moderator: get detailed player profile with warnings, bans, mutes
router.get('/users/:id/profile', requireRole('admin', 'moderator'), async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true, username: true, role: true, profilePicture: true,
                isGuest: true, createdAt: true,
                pvpRating: true, pvpWins: true, pvpLosses: true,
                gameState: {
                    select: { gold: true, diamonds: true, essence: true, forgeLevel: true, equipment: true, player: true },
                },
            },
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        const [warnings, bans, mutes] = await Promise.all([
            prisma.warning.findMany({
                where: { userId },
                include: { issuer: { select: { username: true } } },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
            prisma.ban.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),
            prisma.mute.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),
        ]);

        res.json({ user, warnings, bans, mutes });
    } catch (err) {
        console.error('Admin profile error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/users/:id/warn ──────────────────────────────
// Admin + Moderator: issue a warning
router.post('/users/:id/warn', requireRole('admin', 'moderator'), async (req, res) => {
    const userId = parseInt(req.params.id);
    const { reason } = req.body;
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
    if (!reason || typeof reason !== 'string' || reason.trim().length < 1) {
        return res.status(400).json({ error: 'Reason required' });
    }

    try {
        const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (!target) return res.status(404).json({ error: 'User not found' });

        const warning = await prisma.warning.create({
            data: {
                userId,
                reason: reason.trim().slice(0, 500),
                issuedBy: req.user.userId,
            },
        });

        await logAudit(req.user.userId, 'warn', userId, { reason: reason.trim().slice(0, 500) });

        // Count total warnings for auto-escalation info
        const totalWarnings = await prisma.warning.count({ where: { userId } });

        res.json({ warning, totalWarnings });
    } catch (err) {
        console.error('Warn error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/users/:id/mute ──────────────────────────────
// Admin + Moderator: mute a user in chat
router.post('/users/:id/mute', requireRole('admin', 'moderator'), async (req, res) => {
    const userId = parseInt(req.params.id);
    const { reason, duration } = req.body;
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
    if (!reason || typeof reason !== 'string') {
        return res.status(400).json({ error: 'Reason required' });
    }
    if (!duration) return res.status(400).json({ error: 'Duration required (e.g. 30m, 1h, 24h)' });

    const durationMs = parseDuration(duration);
    if (!durationMs) return res.status(400).json({ error: 'Invalid duration format (e.g. 30m, 1h, 24h, 7d)' });

    // Moderators can mute max 24h
    if (req.user.role === 'moderator' && durationMs > 24 * 60 * 60 * 1000) {
        return res.status(403).json({ error: 'Moderators can mute for max 24 hours' });
    }

    try {
        const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
        if (!target) return res.status(404).json({ error: 'User not found' });
        if (target.role === 'admin') return res.status(403).json({ error: 'Cannot mute an admin' });
        if (target.role === 'moderator' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can mute moderators' });
        }

        // Deactivate existing mutes
        await prisma.mute.updateMany({
            where: { userId, active: true },
            data: { active: false },
        });

        const mute = await prisma.mute.create({
            data: {
                userId,
                reason: reason.trim().slice(0, 500),
                issuedBy: req.user.userId,
                expiresAt: new Date(Date.now() + durationMs),
            },
        });

        await logAudit(req.user.userId, 'mute', userId, { reason: reason.trim(), duration });

        res.json({ mute });
    } catch (err) {
        console.error('Mute error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/users/:id/unmute ─────────────────────────────
router.post('/users/:id/unmute', requireRole('admin', 'moderator'), async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    try {
        await prisma.mute.updateMany({
            where: { userId, active: true },
            data: { active: false },
        });
        await logAudit(req.user.userId, 'unmute', userId);
        res.json({ message: 'User unmuted' });
    } catch (err) {
        console.error('Unmute error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/users/:id/ban ───────────────────────────────
// Admin + Moderator: ban a user (moderators: temp only, max 7 days)
router.post('/users/:id/ban', requireRole('admin', 'moderator'), async (req, res) => {
    const userId = parseInt(req.params.id);
    const { reason, duration } = req.body; // duration optional for admin (permanent)
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
    if (!reason || typeof reason !== 'string') {
        return res.status(400).json({ error: 'Reason required' });
    }

    let expiresAt = null;
    if (duration) {
        const durationMs = parseDuration(duration);
        if (!durationMs) return res.status(400).json({ error: 'Invalid duration format' });
        // Moderators max 7 days
        if (req.user.role === 'moderator' && durationMs > 7 * 24 * 60 * 60 * 1000) {
            return res.status(403).json({ error: 'Moderators can ban for max 7 days' });
        }
        expiresAt = new Date(Date.now() + durationMs);
    } else {
        // No duration = permanent, admin only
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can issue permanent bans' });
        }
    }

    try {
        const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
        if (!target) return res.status(404).json({ error: 'User not found' });
        if (target.role === 'admin') return res.status(403).json({ error: 'Cannot ban an admin' });
        if (target.role === 'moderator' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can ban moderators' });
        }

        // Deactivate existing bans
        await prisma.ban.updateMany({
            where: { userId, active: true },
            data: { active: false },
        });

        const ban = await prisma.ban.create({
            data: {
                userId,
                reason: reason.trim().slice(0, 500),
                issuedBy: req.user.userId,
                expiresAt,
            },
        });

        await logAudit(req.user.userId, 'ban', userId, { reason: reason.trim(), duration: duration || 'permanent' });

        res.json({ ban });
    } catch (err) {
        console.error('Ban error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/users/:id/unban ──────────────────────────────
router.post('/users/:id/unban', requireRole('admin', 'moderator'), async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    try {
        await prisma.ban.updateMany({
            where: { userId, active: true },
            data: { active: false },
        });
        await logAudit(req.user.userId, 'unban', userId);
        res.json({ message: 'User unbanned' });
    } catch (err) {
        console.error('Unban error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/users/:id/kick ──────────────────────────────
// Admin + Moderator: kick user from socket
router.post('/users/:id/kick', requireRole('admin', 'moderator'), async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    try {
        const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
        if (!target) return res.status(404).json({ error: 'User not found' });
        if (target.role === 'admin') return res.status(403).json({ error: 'Cannot kick an admin' });

        await logAudit(req.user.userId, 'kick', userId);

        // The actual socket disconnect is handled by the socket layer via the io instance
        // We return the userId so the caller can emit a kick event
        res.json({ message: 'Kick requested', userId });
    } catch (err) {
        console.error('Kick error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── DELETE /api/admin/messages/:id ──────────────────────────────
// Admin + Moderator: delete a chat message
router.delete('/messages/:id', requireRole('admin', 'moderator'), async (req, res) => {
    const messageId = parseInt(req.params.id);
    if (isNaN(messageId)) return res.status(400).json({ error: 'Invalid message ID' });

    try {
        const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
        if (!message) return res.status(404).json({ error: 'Message not found' });

        await prisma.chatMessage.delete({ where: { id: messageId } });
        await logAudit(req.user.userId, 'delete_message', message.senderId, {
            messageId, channel: message.channel, content: message.content.slice(0, 100),
        });

        res.json({ message: 'Message deleted', messageId, channel: message.channel });
    } catch (err) {
        console.error('Delete message error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN-ONLY ROUTES
// ══════════════════════════════════════════════════════════════════

// ─── POST /api/admin/users/:id/gold ──────────────────────────────
router.post('/users/:id/gold', requireRole('admin'), async (req, res) => {
    const userId = parseInt(req.params.id);
    const { amount } = req.body;
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
    if (typeof amount !== 'number' || amount === 0) {
        return res.status(400).json({ error: 'Amount required (positive or negative number)' });
    }

    try {
        const state = await prisma.gameState.findUnique({ where: { userId } });
        if (!state) return res.status(404).json({ error: 'Game state not found' });

        const newGold = Math.max(0, state.gold + Math.floor(amount));
        await prisma.gameState.update({ where: { userId }, data: { gold: newGold } });
        await logAudit(req.user.userId, 'add_gold', userId, { amount, newGold });

        res.json({ gold: newGold });
    } catch (err) {
        console.error('Add gold error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/users/:id/essence ───────────────────────────
router.post('/users/:id/essence', requireRole('admin'), async (req, res) => {
    const userId = parseInt(req.params.id);
    const { amount } = req.body;
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
    if (typeof amount !== 'number' || amount === 0) {
        return res.status(400).json({ error: 'Amount required' });
    }

    try {
        const state = await prisma.gameState.findUnique({ where: { userId } });
        if (!state) return res.status(404).json({ error: 'Game state not found' });

        const newEssence = Math.max(0, state.essence + Math.floor(amount));
        await prisma.gameState.update({ where: { userId }, data: { essence: newEssence } });
        await logAudit(req.user.userId, 'add_essence', userId, { amount, newEssence });

        res.json({ essence: newEssence });
    } catch (err) {
        console.error('Add essence error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/users/:id/diamonds ───────────────────────────
router.post('/users/:id/diamonds', requireRole('admin'), async (req, res) => {
    const userId = parseInt(req.params.id);
    const { amount } = req.body;
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
    if (typeof amount !== 'number' || amount === 0) {
        return res.status(400).json({ error: 'Amount required (positive or negative number)' });
    }

    try {
        const state = await prisma.gameState.findUnique({ where: { userId } });
        if (!state) return res.status(404).json({ error: 'Game state not found' });

        const newDiamonds = Math.max(0, state.diamonds + Math.floor(amount));
        await prisma.gameState.update({ where: { userId }, data: { diamonds: newDiamonds } });
        await logAudit(req.user.userId, 'add_diamonds', userId, { amount, newDiamonds });

        res.json({ diamonds: newDiamonds });
    } catch (err) {
        console.error('Add diamonds error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/users/:id/level ─────────────────────────────
router.post('/users/:id/level', requireRole('admin'), async (req, res) => {
    const userId = parseInt(req.params.id);
    const { level } = req.body;
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
    if (typeof level !== 'number' || level < 1 || level > 100) {
        return res.status(400).json({ error: 'Level must be between 1 and 100' });
    }

    try {
        const state = await prisma.gameState.findUnique({ where: { userId } });
        if (!state) return res.status(404).json({ error: 'Game state not found' });

        const player = typeof state.player === 'object' ? state.player : JSON.parse(state.player);
        player.level = Math.floor(level);
        player.xp = 0;

        await prisma.gameState.update({ where: { userId }, data: { player } });
        await logAudit(req.user.userId, 'set_level', userId, { level });

        res.json({ player });
    } catch (err) {
        console.error('Set level error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PUT /api/admin/users/:id/role ───────────────────────────────
router.put('/users/:id/role', requireRole('admin'), async (req, res) => {
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
    if (!['user', 'moderator', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Role must be user, moderator, or admin' });
    }

    // Prevent demoting yourself
    if (userId === req.user.userId) {
        return res.status(400).json({ error: 'Cannot change your own role' });
    }

    try {
        await prisma.user.update({ where: { id: userId }, data: { role } });
        await logAudit(req.user.userId, 'set_role', userId, { role });

        res.json({ message: 'Role updated', role });
    } catch (err) {
        console.error('Set role error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── DELETE /api/admin/users/:id/reset-state ─────────────────────
router.delete('/users/:id/reset-state', requireRole('admin'), async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    try {
        await prisma.gameState.update({
            where: { userId },
            data: {
                equipment: {},
                gold: 0,
                diamonds: 100,
                forgeLevel: 1,
                forgeUpgrade: null,
                combat: { currentWave: 1, currentSubWave: 1, highestWave: 1, highestSubWave: 1 },
                essence: 0,
                player: { level: 1, xp: 0, profilePicture: 'wizard' },
                research: { completed: {}, active: null, queue: [] },
                forgeHighestLevel: {},
            },
        });
        await logAudit(req.user.userId, 'reset_state', userId);

        res.json({ message: 'Game state reset' });
    } catch (err) {
        console.error('Reset state error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/admin/stats ────────────────────────────────────────
router.get('/stats', requireRole('admin'), async (req, res) => {
    try {
        const [totalUsers, totalGuests, totalGold, totalEssence] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { isGuest: true } }),
            prisma.gameState.aggregate({ _sum: { gold: true } }),
            prisma.gameState.aggregate({ _sum: { essence: true } }),
        ]);

        res.json({
            totalUsers,
            totalGuests,
            registeredUsers: totalUsers - totalGuests,
            totalGoldInCirculation: totalGold._sum.gold || 0,
            totalEssenceInCirculation: totalEssence._sum.essence || 0,
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/admin/audit-log ────────────────────────────────────
router.get('/audit-log', requireRole('admin', 'moderator'), async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const action = req.query.action;

    try {
        const where = {};

        // Moderators can only see their own actions
        if (req.user.role === 'moderator') {
            where.actorId = req.user.userId;
        }
        if (action) {
            where.action = action;
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: { actor: { select: { username: true } } },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.auditLog.count({ where }),
        ]);

        res.json({ logs, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error('Audit log error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/broadcast ───────────────────────────────────
// Admin only: send a system announcement to all connected players
router.post('/broadcast', requireRole('admin'), async (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length < 1) {
        return res.status(400).json({ error: 'Message required' });
    }

    await logAudit(req.user.userId, 'broadcast', null, { message: message.trim().slice(0, 500) });

    // The actual broadcast is done via socket from the caller
    res.json({ message: 'Broadcast queued', content: message.trim().slice(0, 500) });
});

export default router;
