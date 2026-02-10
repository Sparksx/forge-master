import prisma from '../lib/prisma.js';

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

    // Join a specific channel
    socket.on('chat:join', (data) => {
        const { channel } = data || {};
        if (channel && typeof channel === 'string') {
            socket.join(`chat:${channel}`);
            sendHistory(socket, channel);
        }
    });
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
