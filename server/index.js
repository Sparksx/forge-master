import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import cors from 'cors';
import { PORT, NODE_ENV, CORS_ORIGIN } from './config.js';
import { setupSocket } from './socket/index.js';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/game.js';
import prisma from './lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// Middleware
app.use(cors(CORS_ORIGIN === '*' ? {} : { origin: CORS_ORIGIN }));
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', env: NODE_ENV });
});

// Setup Socket.io
const io = setupSocket(server);

// Serve static frontend in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('{*path}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

server.listen(PORT, async () => {
    console.log(`Forge Master server running on port ${PORT} (${NODE_ENV})`);

    // Cleanup expired refresh tokens on startup
    try {
        const { count } = await prisma.refreshToken.deleteMany({
            where: { expiresAt: { lt: new Date() } }
        });
        if (count > 0) {
            console.log(`Cleaned up ${count} expired refresh token(s)`);
        }
    } catch (err) {
        console.error('Failed to cleanup expired refresh tokens:', err);
    }
});

export { app, server, io };
