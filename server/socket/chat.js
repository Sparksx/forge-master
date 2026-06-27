import prisma from '../lib/prisma.js';
import { computeStatsFromEquipment, playerPowerScore } from '../../shared/stats.js';
import { clanLevelFromXp, clanPerks } from '../../shared/clan-config.js';
import { getActiveMute, logAudit } from '../middleware/auth.js';

// Extract a player's equipped cosmetic frame from their stored game-state JSON,
// guarding against a missing/non-object `player` blob.
function frameOf(gameState) {
    const player = gameState?.player;
    return player && typeof player === 'object' && typeof player.frame === 'string'
        ? player.frame
        : 'none';
}

// Selector for a message sender, including the game-state needed to surface their
// equipped profile frame alongside each chat line.
const SENDER_SELECT = {
    select: {
        id: true, username: true, profilePicture: true, role: true,
        gameState: { select: { player: true } },
    },
};

// In-memory combat log store with 24h TTL and size cap
const combatLogs = new Map();
const COMBAT_LOG_TTL = 24 * 60 * 60 * 1000; // 24h
const MAX_COMBAT_LOGS = 5000;

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
    // Evict oldest entries if at capacity
    if (combatLogs.size >= MAX_COMBAT_LOGS) {
        const oldest = combatLogs.keys().next().value;
        combatLogs.delete(oldest);
    }
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

const CHAT_COOLDOWN_MS = 1500;
const HISTORY_LIMIT = 100;

// Resolve a logical channel requested by a client into a concrete stored channel
// + socket room, enforcing authorization. Logical channels:
//   'general'     → world chat (everyone)
//   'clan'        → the requester's own clan (resolved server-side, anti-spoof)
//   'conv:<id>'   → a private DM / custom group the requester belongs to
// Returns null when the requester isn't allowed to use the channel.
async function resolveChannel(userId, channel) {
    if (channel === 'general') {
        return { stored: 'general', room: 'chat:general' };
    }
    if (channel === 'clan') {
        const member = await prisma.clanMember.findUnique({
            where: { userId }, select: { clanId: true },
        });
        if (!member) return null;
        return { stored: `clan:${member.clanId}`, room: `chat:clan:${member.clanId}` };
    }
    if (typeof channel === 'string' && channel.startsWith('conv:')) {
        const convId = Number(channel.slice(5));
        if (!Number.isInteger(convId) || convId <= 0) return null;
        const member = await prisma.conversationMember.findUnique({
            where: { conversationId_userId: { conversationId: convId, userId } },
            select: { id: true },
        });
        if (!member) return null;
        return { stored: `conv:${convId}`, room: `chat:conv:${convId}` };
    }
    return null;
}

// Shape a conversation for a given viewer: derive a display title (group name, or
// the other party's username for a DM) and a flat member list.
function serializeConversation(conv, viewerId) {
    const members = conv.members.map((m) => ({
        id: m.userId,
        username: m.user?.username,
        avatar: m.user?.profilePicture,
    }));
    const others = members.filter((m) => m.id !== viewerId);
    const title = conv.type === 'group'
        ? (conv.name || 'Group')
        : (others[0]?.username || 'Direct message');
    return {
        id: conv.id,
        type: conv.type,
        name: conv.name,
        title,
        members,
        channel: `conv:${conv.id}`,
        updatedAt: conv.updatedAt,
    };
}

function loadConversation(id) {
    return prisma.conversation.findUnique({
        where: { id },
        include: { members: { include: { user: { select: { id: true, username: true, profilePicture: true } } } } },
    });
}

// Push a conversation to every currently-connected member, joining their socket
// to the room so they receive live messages. This only adds it to their list —
// it does not force their view to switch (that's `chat:conversation-opened`,
// sent to the initiator alone).
function broadcastConversation(io, conv) {
    const memberIds = new Set(conv.members.map((m) => m.userId));
    for (const [, s] of io.of('/').sockets) {
        if (s.user && memberIds.has(s.user.userId)) {
            s.join(`chat:conv:${conv.id}`);
            s.emit('chat:conversation', serializeConversation(conv, s.user.userId));
        }
    }
}

async function sendConversations(socket) {
    const userId = socket.user.userId;
    const memberships = await prisma.conversationMember.findMany({
        where: { userId }, select: { conversationId: true },
    });
    const ids = memberships.map((m) => m.conversationId);
    if (!ids.length) { socket.emit('chat:conversations', []); return; }
    const convs = await prisma.conversation.findMany({
        where: { id: { in: ids } },
        orderBy: { updatedAt: 'desc' },
        include: { members: { include: { user: { select: { id: true, username: true, profilePicture: true } } } } },
    });
    socket.emit('chat:conversations', convs.map((c) => serializeConversation(c, userId)));
}

export function registerChatHandlers(io, socket) {
    let lastMessageAt = 0;
    const userId = socket.user.userId;

    // Join the general channel by default and send its recent history.
    socket.join('chat:general');
    sendHistory(socket, 'general');

    // Join the clan room (if any) and all private-conversation rooms so the player
    // receives live clan + private messages without an explicit subscribe.
    (async () => {
        try {
            const member = await prisma.clanMember.findUnique({ where: { userId }, select: { clanId: true } });
            if (member) socket.join(`chat:clan:${member.clanId}`);
            const convs = await prisma.conversationMember.findMany({ where: { userId }, select: { conversationId: true } });
            convs.forEach((c) => socket.join(`chat:conv:${c.conversationId}`));
        } catch (err) {
            console.error('Chat room join error:', err);
        }
    })();

    // Handle new message
    socket.on('chat:message', async (data) => {
        const now = Date.now();
        if (now - lastMessageAt < CHAT_COOLDOWN_MS) {
            socket.emit('chat:error', { message: 'Please wait before sending another message' });
            return;
        }

        const { content, channel = 'general' } = data || {};
        if (!content || typeof content !== 'string') return;
        const trimmed = content.trim().slice(0, 500);
        if (!trimmed) return;

        const target = await resolveChannel(userId, channel);
        if (!target) {
            socket.emit('chat:error', { message: 'You can\'t post in that channel' });
            return;
        }
        lastMessageAt = now;

        // Check if user is muted
        try {
            const mute = await getActiveMute(userId);
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
                    senderId: userId,
                    channel: target.stored,
                    content: trimmed,
                },
                select: {
                    id: true,
                    content: true,
                    channel: true,
                    createdAt: true,
                    sender: SENDER_SELECT,
                }
            });

            // Bump a private conversation's recency so it sorts to the top.
            if (target.stored.startsWith('conv:')) {
                const convId = Number(target.stored.slice(5));
                prisma.conversation.update({ where: { id: convId }, data: {} }).catch(() => {});
            }

            io.to(target.room).emit('chat:message', {
                id: message.id,
                sender: message.sender.username,
                senderId: message.sender.id,
                senderAvatar: message.sender.profilePicture,
                senderFrame: frameOf(message.sender.gameState),
                senderRole: message.sender.role,
                content: message.content,
                channel: message.channel,
                createdAt: message.createdAt,
            });
        } catch (err) {
            console.error('Chat message error:', err);
        }
    });

    // Send the recent history for a specific channel on demand (tab switches).
    socket.on('chat:request-history', async (data) => {
        const { channel } = data || {};
        const target = await resolveChannel(userId, channel);
        if (!target) { socket.emit('chat:history', { channel, messages: [] }); return; }
        sendHistory(socket, target.stored);
    });

    // List the player's private conversations (DMs + custom groups).
    socket.on('chat:conversations', async () => {
        try {
            await sendConversations(socket);
        } catch (err) {
            console.error('Conversations list error:', err);
        }
    });

    // Open (or create) a 1:1 DM with another player by username.
    socket.on('chat:start-dm', async (data) => {
        const username = (data?.username || '').trim();
        if (!username) return;
        try {
            const targetUser = await prisma.user.findUnique({
                where: { username }, select: { id: true },
            });
            if (!targetUser) { socket.emit('chat:error', { message: 'No player with that name' }); return; }
            if (targetUser.id === userId) { socket.emit('chat:error', { message: 'You can\'t message yourself' }); return; }

            let conv = await prisma.conversation.findFirst({
                where: {
                    type: 'dm',
                    members: { every: { userId: { in: [userId, targetUser.id] } } },
                    AND: [
                        { members: { some: { userId } } },
                        { members: { some: { userId: targetUser.id } } },
                    ],
                },
                select: { id: true },
            });
            if (!conv) {
                conv = await prisma.conversation.create({
                    data: { type: 'dm', createdBy: userId, members: { create: [{ userId }, { userId: targetUser.id }] } },
                    select: { id: true },
                });
            }
            const full = await loadConversation(conv.id);
            broadcastConversation(io, full);
            socket.emit('chat:conversation-opened', serializeConversation(full, userId));
        } catch (err) {
            console.error('Start DM error:', err);
            socket.emit('chat:error', { message: 'Could not open conversation' });
        }
    });

    // Create a named custom group with several players.
    socket.on('chat:create-group', async (data) => {
        const name = (data?.name || '').trim().slice(0, 40);
        const usernames = Array.isArray(data?.usernames) ? data.usernames : [];
        if (!name) { socket.emit('chat:error', { message: 'Group needs a name' }); return; }
        try {
            const clean = [...new Set(usernames.map((u) => String(u).trim()).filter(Boolean))].slice(0, 20);
            const users = clean.length
                ? await prisma.user.findMany({ where: { username: { in: clean } }, select: { id: true } })
                : [];
            const memberIds = [...new Set([userId, ...users.map((u) => u.id)])];
            if (memberIds.length < 2) { socket.emit('chat:error', { message: 'Add at least one other player' }); return; }
            const conv = await prisma.conversation.create({
                data: {
                    type: 'group', name, createdBy: userId,
                    members: { create: memberIds.map((id) => ({ userId: id })) },
                },
                select: { id: true },
            });
            const full = await loadConversation(conv.id);
            broadcastConversation(io, full);
            socket.emit('chat:conversation-opened', serializeConversation(full, userId));
        } catch (err) {
            console.error('Create group error:', err);
            socket.emit('chat:error', { message: 'Could not create group' });
        }
    });

    // Share a PVP combat in chat
    socket.on('chat:share-combat', async (data) => {
        const { combatId, channel = 'general' } = data || {};
        if (!combatId || typeof combatId !== 'string') return;
        const target = await resolveChannel(userId, channel);
        if (!target) return;

        const log = getCombatLog(combatId);
        if (!log) {
            socket.emit('chat:error', { message: 'Combat log expired or not found' });
            return;
        }

        // Broadcast combat message to channel
        io.to(target.room).emit('chat:combat', {
            combatId,
            channel: target.stored,
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
                            player: true,
                        }
                    },
                    clanMembership: {
                        select: {
                            role: true,
                            clan: { select: { id: true, name: true, tag: true, emblem: true, xp: true } },
                        },
                    },
                }
            });

            if (!user) {
                socket.emit('chat:player-profile', { userId, error: 'not_found' });
                return;
            }

            const equipment = user.gameState?.equipment || {};

            // Determine ELO rank
            const rank = getEloRank(user.pvpRating);

            // Player level + equipped frame from the stored game-state blob.
            const playerJson = (user.gameState?.player && typeof user.gameState.player === 'object')
                ? user.gameState.player : {};
            const level = Number.isFinite(playerJson.level) ? playerJson.level : 1;

            // Clan membership (name/tag/level) so the public profile can show it.
            // (Friendly duels are open to everyone, not just clanmates.)
            const membership = user.clanMembership;

            // Power & stats must mirror the client (top nav) and PvP exactly:
            // include the player's level and clan stat perk, and use the same
            // weighted power formula — not a raw maxHP+damage sum — or the number
            // shown here won't match the owner's own Power readout.
            const statBonusPct = typeof membership?.clan?.xp === 'number'
                ? (clanPerks(clanLevelFromXp(membership.clan.xp)).statBonusPct || 0)
                : 0;
            const stats = computeStatsFromEquipment(equipment, level, statBonusPct);
            const power = playerPowerScore(equipment, level, statBonusPct);

            const clan = membership?.clan ? {
                id: membership.clan.id,
                name: membership.clan.name,
                tag: membership.clan.tag,
                emblem: membership.clan.emblem,
                level: clanLevelFromXp(membership.clan.xp),
                role: membership.role,
            } : null;

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
                frame: frameOf(user.gameState),
                role: user.role,
                level,
                clan,
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

    // Join a specific channel and replay its history.
    socket.on('chat:join', async (data) => {
        const { channel } = data || {};
        const target = await resolveChannel(userId, channel);
        if (!target) return;
        socket.join(target.room);
        sendHistory(socket, target.stored);
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
            take: HISTORY_LIMIT,
            select: {
                id: true,
                content: true,
                channel: true,
                createdAt: true,
                sender: SENDER_SELECT,
            }
        });

        socket.emit('chat:history', {
            channel,
            messages: messages.reverse().map(m => ({
                id: m.id,
                sender: m.sender.username,
                senderId: m.sender.id,
                senderAvatar: m.sender.profilePicture,
                senderFrame: frameOf(m.sender.gameState),
                senderRole: m.sender.role,
                content: m.content,
                channel: m.channel,
                createdAt: m.createdAt,
            })),
        });
    } catch (err) {
        console.error('Chat history error:', err);
    }
}
