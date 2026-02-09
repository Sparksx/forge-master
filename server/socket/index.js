import { Server } from 'socket.io';
import { socketAuth } from '../middleware/auth.js';
import { registerChatHandlers } from './chat.js';
import { registerPvpHandlers } from './pvp.js';

export function setupSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    // Auth middleware for all socket connections
    io.use(socketAuth);

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.username} (${socket.user.userId})`);

        registerChatHandlers(io, socket);
        registerPvpHandlers(io, socket);

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.username}`);
        });
    });

    return io;
}
