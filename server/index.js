import { execSync } from 'child_process';
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import cors from 'cors';
import { PORT, NODE_ENV, CORS_ORIGIN } from './config.js';
import { setupSocket } from './socket/index.js';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/game.js';
import adminRoutes from './routes/admin.js';
import paymentRoutes from './routes/payment.js';
import equipmentRoutes from './routes/equipment.js';
import spriteRoutes from './routes/sprites.js';
import monsterRoutes from './routes/monsters.js';
import playerRoutes from './routes/players.js';
import prisma from './lib/prisma.js';
import { seedEquipmentIfEmpty } from './lib/seed-equipment.js';
import { migrateSpritesIfNeeded } from './lib/migrate-sprites.js';

// Sync Prisma schema to database and regenerate client on startup (non-fatal)
try {
    execSync('./node_modules/.bin/prisma db push --accept-data-loss', { stdio: 'inherit' });
} catch (err) {
    console.error('Prisma db push failed (non-fatal):', err.message);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// Middleware
app.use(cors(CORS_ORIGIN === '*' ? {} : { origin: CORS_ORIGIN }));

// Stripe webhook needs raw body for signature verification — must be registered before express.json()
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/sprites', spriteRoutes);
app.use('/api/monsters', monsterRoutes);
app.use('/api/players', playerRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', env: NODE_ENV });
});

// Setup Socket.io
const io = setupSocket(server);

// Serve static frontend in production
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Admin dashboard — serve admin.html for /admin route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(distPath, 'admin.html'));
});

app.get('{*path}', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

server.listen(PORT, async () => {
    console.log(`Anvil Legends server running on port ${PORT} (${NODE_ENV})`);

    // Migrate existing sprites if upgrading from old schema
    await migrateSpritesIfNeeded();

    // Seed equipment templates into DB if tables are empty (first run)
    await seedEquipmentIfEmpty();

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
