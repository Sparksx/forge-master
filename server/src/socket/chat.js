import { prisma } from '../db.js';

const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_MS = 1000; // 1 message per second
const lastMessageTime = new Map();

export function setupChat(io) {
  const chatNamespace = io.of('/chat');

  chatNamespace.on('connection', (socket) => {
    const { playerId, username } = socket;

    // Join general channel by default
    socket.join('general');

    // Send recent message history
    sendRecentMessages(socket, 'general');

    // Handle joining a channel
    socket.on('join', (channel) => {
      if (typeof channel !== 'string' || channel.length > 30) return;
      socket.join(channel);
      sendRecentMessages(socket, channel);
    });

    // Handle leaving a channel
    socket.on('leave', (channel) => {
      if (typeof channel !== 'string') return;
      socket.leave(channel);
    });

    // Handle sending a message
    socket.on('message', async (data) => {
      try {
        const { channel = 'general', content } = data || {};

        // Validate
        if (typeof content !== 'string' || content.trim().length === 0) return;
        if (content.length > MAX_MESSAGE_LENGTH) return;

        // Rate limit
        const now = Date.now();
        const lastTime = lastMessageTime.get(playerId) || 0;
        if (now - lastTime < RATE_LIMIT_MS) return;
        lastMessageTime.set(playerId, now);

        // Save to database
        const message = await prisma.chatMessage.create({
          data: {
            playerId,
            channel,
            content: content.trim(),
          },
        });

        // Broadcast to channel
        chatNamespace.to(channel).emit('message', {
          id: message.id,
          playerId,
          username,
          channel,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        });
      } catch (error) {
        console.error('Chat message error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      lastMessageTime.delete(playerId);
    });
  });
}

async function sendRecentMessages(socket, channel) {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { channel },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        player: { select: { username: true } },
      },
    });

    socket.emit('history', {
      channel,
      messages: messages.reverse().map(m => ({
        id: m.id,
        playerId: m.playerId,
        username: m.player.username,
        channel: m.channel,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Send recent messages error:', error);
  }
}
