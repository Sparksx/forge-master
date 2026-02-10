import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import {
    JWT_SECRET, JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY
} from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';

const router = Router();

const authLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 attempts per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later' },
});

function generateAccessToken(user) {
    return jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: JWT_ACCESS_EXPIRY }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        { userId: user.id, username: user.username },
        JWT_REFRESH_SECRET,
        { expiresIn: JWT_REFRESH_EXPIRY }
    );
}

// POST /api/auth/register
router.post('/register', authLimiter, [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    try {
        const existing = await prisma.user.findFirst({
            where: { OR: [{ username }, { email }] }
        });
        if (existing) {
            const field = existing.username === username ? 'username' : 'email';
            return res.status(409).json({ error: `This ${field} is already taken` });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: { username, email, passwordHash }
        });

        // Create default game state
        await prisma.gameState.create({
            data: {
                userId: user.id,
                equipment: {},
                gold: 0,
                forgeLevel: 1,
                combat: { currentWave: 1, currentSubWave: 1, highestWave: 1, highestSubWave: 1 },
            }
        });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store refresh token in DB
        const decoded = jwt.decode(refreshToken);
        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(decoded.exp * 1000),
            }
        });

        res.status(201).json({
            accessToken,
            refreshToken,
            user: { id: user.id, username: user.username, email: user.email },
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/login
router.post('/login', authLimiter, [
    body('login').trim().notEmpty().withMessage('Username or email required'),
    body('password').notEmpty().withMessage('Password required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { login, password } = req.body;

    try {
        const user = await prisma.user.findFirst({
            where: { OR: [{ username: login }, { email: login }] }
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        const decoded = jwt.decode(refreshToken);
        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(decoded.exp * 1000),
            }
        });

        res.json({
            accessToken,
            refreshToken,
            user: { id: user.id, username: user.username, email: user.email },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
    }

    try {
        const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

        // Check token exists in DB (not revoked)
        const stored = await prisma.refreshToken.findUnique({
            where: { token: refreshToken }
        });
        if (!stored) {
            return res.status(401).json({ error: 'Token revoked' });
        }

        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Rotate: delete old, create new
        await prisma.refreshToken.delete({ where: { id: stored.id } });

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        const decoded = jwt.decode(newRefreshToken);
        await prisma.refreshToken.create({
            data: {
                token: newRefreshToken,
                userId: user.id,
                expiresAt: new Date(decoded.exp * 1000),
            }
        });

        res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    } catch (err) {
        if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        console.error('Refresh error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
    const { refreshToken } = req.body;

    try {
        if (refreshToken) {
            await prisma.refreshToken.deleteMany({
                where: { token: refreshToken, userId: req.user.userId }
            });
        } else {
            // Delete all refresh tokens for this user
            await prisma.refreshToken.deleteMany({
                where: { userId: req.user.userId }
            });
        }
        res.json({ message: 'Logged out' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/auth/me — get current user info
router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { id: true, username: true, email: true, profilePicture: true, pvpRating: true, pvpWins: true, pvpLosses: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (err) {
        console.error('Me error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/change-username — change username (costs gold, deducted client-side)
router.post('/change-username', requireAuth, [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username } = req.body;

    try {
        // Check if username is taken
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing && existing.id !== req.user.userId) {
            return res.status(409).json({ error: 'Username already taken' });
        }

        await prisma.user.update({
            where: { id: req.user.userId },
            data: { username },
        });

        res.json({ message: 'Username changed', username });
    } catch (err) {
        console.error('Change username error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/auth/profile-picture — update avatar
router.put('/profile-picture', requireAuth, async (req, res) => {
    const { profilePicture } = req.body;

    if (typeof profilePicture !== 'string' || profilePicture.length < 1 || profilePicture.length > 30) {
        return res.status(400).json({ error: 'Invalid profile picture' });
    }

    try {
        await prisma.user.update({
            where: { id: req.user.userId },
            data: { profilePicture },
        });
        res.json({ message: 'Profile picture updated', profilePicture });
    } catch (err) {
        console.error('Profile picture error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
