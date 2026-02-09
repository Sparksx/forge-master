import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import cors from 'cors';
import { PORT, NODE_ENV } from './config.js';
import { setupSocket } from './socket/index.js';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
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

server.listen(PORT, () => {
    console.log(`Forge Master server running on port ${PORT} (${NODE_ENV})`);
});

export { app, server, io };
