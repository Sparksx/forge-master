import { Server } from 'socket.io';
import { CORS_ORIGIN } from '../config.js';
import { socketAuth, getActiveBan } from '../middleware/auth.js';
import { registerChatHandlers } from './chat.js';
import { registerPvpHandlers } from './pvp.js';
import prisma from '../lib/prisma.js';

export function setupSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN,
            methods: ['GET', 'POST']
        },
        pingInterval: 25000,
        pingTimeout: 30000,
    });

    // Auth middleware for all socket connections
    io.use(socketAuth);

    // Ban check middleware
    io.use(async (socket, next) => {
        try {
            const ban = await getActiveBan(socket.user.userId);
            if (ban) {
                const expiry = ban.expiresAt
                    ? `until ${ban.expiresAt.toISOString()}`
                    : 'permanently';
                return next(new Error(`You are banned ${expiry}. Reason: ${ban.reason}`));
            }
            // Attach user role to socket
            const user = await prisma.user.findUnique({
                where: { id: socket.user.userId },
                select: { role: true },
            });
            if (user) {
                socket.user.role = user.role;
            }
            next();
        } catch (err) {
            console.error('Ban check error:', err);
            next();
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.username} (${socket.user.userId}) [${socket.user.role || 'user'}]`);

        registerChatHandlers(io, socket);
        registerPvpHandlers(io, socket);

        // Admin: force disconnect a user by their userId
        socket.on('admin:kick-user', async (data) => {
            const { userId } = data || {};
            if (!userId || typeof userId !== 'number') return;

            // Verify the kicker is admin/mod
            if (socket.user.role !== 'admin' && socket.user.role !== 'moderator') return;

            // Find and disconnect the target user's sockets
            for (const [, s] of io.of('/').sockets) {
                if (s.user?.userId === userId) {
                    s.emit('admin:kicked', { message: 'You have been kicked by a moderator' });
                    s.disconnect(true);
                }
            }
        });

        // Admin: broadcast system message
        socket.on('admin:broadcast', (data) => {
            const { message } = data || {};
            if (!message || typeof message !== 'string') return;
            if (socket.user.role !== 'admin') return;

            io.to('chat:general').emit('chat:system', {
                content: message.trim().slice(0, 500),
                type: 'broadcast',
                createdAt: new Date().toISOString(),
            });
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.username}`);
        });
    });

    return io;
}
