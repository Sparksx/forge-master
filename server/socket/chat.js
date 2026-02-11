import prisma from '../lib/prisma.js';
import { computeStatsFromEquipment } from '../../shared/stats.js';
import { getActiveMute, logAudit } from '../middleware/auth.js';

// In-memory combat log store with 24h TTL
const combatLogs = new Map();
const COMBAT_LOG_TTL = 24 * 60 * 60 * 1000; // 24h

// Cleanup expired logs every hour
setInterval(() => {
    const now = Date.now();
    for (const [id, log] of combatLogs) {
        if (now - log.createdAt > COMBAT_LOG_TTL) {
            combatLogs.delete(id);
        }
    }
}, 60 * 60 * 1000);

export function storeCombatLog(combatId, logData) {
    combatLogs.set(combatId, { ...logData, createdAt: Date.now() });
}

export function getCombatLog(combatId) {
    const log = combatLogs.get(combatId);
    if (!log) return null;
    if (Date.now() - log.createdAt > COMBAT_LOG_TTL) {
        combatLogs.delete(combatId);
        return null;
    }
    return log;
}

export function registerChatHandlers(io, socket) {
    // Join the general channel by default
    socket.join('chat:general');

    // Send chat history on connect
    sendHistory(socket, 'general');

    // Handle new message
    socket.on('chat:message', async (data) => {
        const { content, channel = 'general' } = data || {};

        if (!content || typeof content !== 'string') return;
        const trimmed = content.trim().slice(0, 500);
        if (!trimmed) return;

        // Check if user is muted
        try {
            const mute = await getActiveMute(socket.user.userId);
            if (mute) {
                const remaining = Math.ceil((mute.expiresAt.getTime() - Date.now()) / 60000);
                socket.emit('chat:error', {
                    message: `You are muted for ${remaining} more minute(s). Reason: ${mute.reason}`,
                });
                return;
            }
        } catch (err) {
            console.error('Mute check error:', err);
        }

        try {
            const message = await prisma.chatMessage.create({
                data: {
                    senderId: socket.user.userId,
                    channel,
                    content: trimmed,
                },
                select: {
                    id: true,
                    content: true,
                    channel: true,
                    createdAt: true,
                    sender: { select: { id: true, username: true, profilePicture: true, role: true } },
                }
            });

            io.to(`chat:${channel}`).emit('chat:message', {
                id: message.id,
                sender: message.sender.username,
                senderId: message.sender.id,
                senderAvatar: message.sender.profilePicture,
                senderRole: message.sender.role,
                content: message.content,
                channel: message.channel,
                createdAt: message.createdAt,
            });
        } catch (err) {
            console.error('Chat message error:', err);
        }
    });

    // Share a PVP combat in chat
    socket.on('chat:share-combat', async (data) => {
        const { combatId, channel = 'general' } = data || {};
        if (!combatId || typeof combatId !== 'string') return;

        const log = getCombatLog(combatId);
        if (!log) {
            socket.emit('chat:error', { message: 'Combat log expired or not found' });
            return;
        }

        // Broadcast combat message to channel
        io.to(`chat:${channel}`).emit('chat:combat', {
            combatId,
            channel,
            createdAt: new Date().toISOString(),
            sharedBy: socket.user.username,
            player1: {
                userId: log.player1.userId,
                username: log.player1.username,
                avatar: log.player1.avatar,
            },
            player2: {
                userId: log.player2.userId,
                username: log.player2.username,
                avatar: log.player2.avatar,
            },
            winnerId: log.winnerId,
            reason: log.reason,
        });
    });

    // Fetch a combat log for replay
    socket.on('chat:get-combat', (data) => {
        const { combatId } = data || {};
        if (!combatId) return;

        const log = getCombatLog(combatId);
        if (!log) {
            socket.emit('chat:combat-log', { combatId, error: 'expired' });
            return;
        }
        socket.emit('chat:combat-log', { combatId, log });
    });

    // Fetch another player's profile
    socket.on('chat:player-profile', async (data) => {
        const { userId } = data || {};
        if (!userId || typeof userId !== 'number') return;

        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    username: true,
                    profilePicture: true,
                    role: true,
                    pvpRating: true,
                    pvpWins: true,
                    pvpLosses: true,
                    gameState: {
                        select: {
                            equipment: true,
                            forgeLevel: true,
                            gold: true,
                            essence: true,
                            player: true,
                        }
                    }
                }
            });

            if (!user) {
                socket.emit('chat:player-profile', { userId, error: 'not_found' });
                return;
            }

            const equipment = user.gameState?.equipment || {};
            const stats = computeStatsFromEquipment(equipment);
            const power = stats.maxHP + stats.damage;

            // Determine ELO rank
            const rank = getEloRank(user.pvpRating);

            // Get requesting user's role to decide what to include
            const requestingUser = await prisma.user.findUnique({
                where: { id: socket.user.userId },
                select: { role: true },
            });
            const isStaff = requestingUser && (requestingUser.role === 'admin' || requestingUser.role === 'moderator');

            const profileData = {
                userId: user.id,
                username: user.username,
                profilePicture: user.profilePicture,
                role: user.role,
                pvpRating: user.pvpRating,
                pvpWins: user.pvpWins,
                pvpLosses: user.pvpLosses,
                power,
                maxHP: stats.maxHP,
                damage: stats.damage,
                forgeLevel: user.gameState?.forgeLevel || 1,
                equipment,
                rank,
            };

            // Include moderation data for staff
            if (isStaff) {
                const [warnings, activeBans, activeMutes] = await Promise.all([
                    prisma.warning.findMany({
                        where: { userId },
                        include: { issuer: { select: { username: true } } },
                        orderBy: { createdAt: 'desc' },
                        take: 10,
                    }),
                    prisma.ban.findMany({
                        where: { userId, active: true },
                        orderBy: { createdAt: 'desc' },
                        take: 5,
                    }),
                    prisma.mute.findMany({
                        where: { userId, active: true },
                        orderBy: { createdAt: 'desc' },
                        take: 5,
                    }),
                ]);

                const player = user.gameState?.player || { level: 1 };

                profileData.moderation = {
                    warnings,
                    activeBans,
                    activeMutes,
                    gold: user.gameState?.gold || 0,
                    essence: user.gameState?.essence || 0,
                    playerLevel: typeof player === 'object' ? player.level : 1,
                };
            }

            socket.emit('chat:player-profile', profileData);
        } catch (err) {
            console.error('Player profile error:', err);
        }
    });

    // ─── Moderator: delete message via socket ─────────────────────
    socket.on('chat:delete-message', async (data) => {
        const { messageId } = data || {};
        if (!messageId || typeof messageId !== 'number') return;

        try {
            // Check role
            const user = await prisma.user.findUnique({
                where: { id: socket.user.userId },
                select: { role: true },
            });
            if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return;

            const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
            if (!message) return;

            await prisma.chatMessage.delete({ where: { id: messageId } });
            await logAudit(socket.user.userId, 'delete_message', message.senderId, {
                messageId, channel: message.channel,
            });

            // Notify all clients in the channel to remove the message
            io.to(`chat:${message.channel}`).emit('chat:message-deleted', {
                messageId,
                channel: message.channel,
            });
        } catch (err) {
            console.error('Delete message error:', err);
        }
    });

    // Join a specific channel
    socket.on('chat:join', (data) => {
        const { channel } = data || {};
        if (channel && typeof channel === 'string') {
            socket.join(`chat:${channel}`);
            sendHistory(socket, channel);
        }
    });
}

function getEloRank(rating) {
    if (rating >= 2000) return { name: 'Master', icon: '👑' };
    if (rating >= 1700) return { name: 'Diamond', icon: '💎' };
    if (rating >= 1400) return { name: 'Platinum', icon: '⭐' };
    if (rating >= 1200) return { name: 'Gold', icon: '🥇' };
    if (rating >= 1000) return { name: 'Silver', icon: '🥈' };
    return { name: 'Bronze', icon: '🥉' };
}

async function sendHistory(socket, channel) {
    try {
        const messages = await prisma.chatMessage.findMany({
            where: { channel },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                content: true,
                channel: true,
                createdAt: true,
                sender: { select: { id: true, username: true, profilePicture: true, role: true } },
            }
        });

        socket.emit('chat:history', messages.reverse().map(m => ({
            id: m.id,
            sender: m.sender.username,
            senderId: m.sender.id,
            senderAvatar: m.sender.profilePicture,
            senderRole: m.sender.role,
            content: m.content,
            channel: m.channel,
            createdAt: m.createdAt,
        })));
    } catch (err) {
        console.error('Chat history error:', err);
    }
}
