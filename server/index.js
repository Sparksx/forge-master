import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import clanRoutes from './routes/clans.js';
import pvpRoutes from './routes/pvp.js';
import prisma from './lib/prisma.js';
import { seedEquipmentIfEmpty } from './lib/seed-equipment.js';
import { migrateSpritesIfNeeded } from './lib/migrate-sprites.js';

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    shutdown('uncaughtException');
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// Behind Railway's (single) proxy the incoming request carries an
// `X-Forwarded-For` header. Express defaults `trust proxy` to false, which makes
// `req.ip` the proxy's address AND makes express-rate-limit throw
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR — that error bubbles out of the rate-limit
// middleware on every `/api/*` request, so auth calls (login, /refresh, /me) all
// 500 and nobody can sign in. Trust exactly the first hop in production so
// `req.ip` resolves to the real client and the limiter keys on it correctly.
// Left off in dev where there's no proxy (avoids trusting a spoofable header).
app.set('trust proxy', NODE_ENV === 'production' ? 1 : false);

// Security headers
app.use(helmet({
    contentSecurityPolicy: NODE_ENV === 'production' ? {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:", "https://discord.com", "https://accounts.google.com", "https://api.stripe.com"],
            frameSrc: ["https://checkout.stripe.com"],
            fontSrc: ["'self'"],
        },
    } : false,
    hsts: NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
}));

// CORS
app.use(cors(CORS_ORIGIN === '*' ? { maxAge: 86400 } : { origin: CORS_ORIGIN, maxAge: 86400 }));

// Rate limiting on API routes (100 requests/min per IP)
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', apiLimiter);

// Stripe webhook needs raw body for signature verification — must be registered before express.json()
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '16kb' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/sprites', spriteRoutes);
app.use('/api/monsters', monsterRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/clans', clanRoutes);
app.use('/api/pvp', pvpRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
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

// Express error handler
app.use((err, req, res, _next) => {
    console.error('Unhandled route error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, async () => {
    console.log(`Gear Master server running on port ${PORT} (${NODE_ENV})`);

    try {
        await migrateSpritesIfNeeded();
        await seedEquipmentIfEmpty();
    } catch (err) {
        console.error('Fatal startup error during DB init:', err);
        process.exit(1);
    }

    // Cleanup expired refresh tokens on startup + every 24h
    async function cleanupExpiredTokens() {
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
    }
    await cleanupExpiredTokens();
    setInterval(cleanupExpiredTokens, 24 * 60 * 60 * 1000);
});

// Graceful shutdown
function shutdown(signal) {
    console.log(`${signal} received — shutting down gracefully`);
    io.close();
    server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, server, io };
