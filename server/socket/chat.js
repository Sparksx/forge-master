import prisma from '../lib/prisma.js';
import { computeStatsFromEquipment } from '../../shared/stats.js';

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
                    sender: { select: { id: true, username: true, profilePicture: true } },
                }
            });

            io.to(`chat:${channel}`).emit('chat:message', {
                id: message.id,
                sender: message.sender.username,
                senderId: message.sender.id,
                senderAvatar: message.sender.profilePicture,
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
                    pvpRating: true,
                    pvpWins: true,
                    pvpLosses: true,
                    gameState: {
                        select: {
                            equipment: true,
                            forgeLevel: true,
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

            socket.emit('chat:player-profile', {
                userId: user.id,
                username: user.username,
                profilePicture: user.profilePicture,
                pvpRating: user.pvpRating,
                pvpWins: user.pvpWins,
                pvpLosses: user.pvpLosses,
                power,
                maxHP: stats.maxHP,
                damage: stats.damage,
                forgeLevel: user.gameState?.forgeLevel || 1,
                equipment,
                rank,
            });
        } catch (err) {
            console.error('Player profile error:', err);
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
                sender: { select: { id: true, username: true, profilePicture: true } },
            }
        });

        socket.emit('chat:history', messages.reverse().map(m => ({
            id: m.id,
            sender: m.sender.username,
            senderId: m.sender.id,
            senderAvatar: m.sender.profilePicture,
            content: m.content,
            channel: m.channel,
            createdAt: m.createdAt,
        })));
    } catch (err) {
        console.error('Chat history error:', err);
    }
}
