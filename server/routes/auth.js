import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import {
    JWT_SECRET, JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY,
    DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
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

/** Store refresh token in DB and return both tokens as JSON */
async function issueTokens(user, res, statusCode = 200) {
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

    res.status(statusCode).json({
        accessToken,
        refreshToken,
        user: {
            id: user.id, username: user.username, email: user.email,
            isGuest: user.isGuest,
            role: user.role || 'user',
            hasDiscord: !!user.discordId,
            hasGoogle: !!user.googleId,
            settings: user.settings || {},
        },
    });
}

/** Create default game state for a new user */
async function createDefaultGameState(userId) {
    await prisma.gameState.create({
        data: {
            userId,
            equipment: {},
            gold: 0,
            forgeLevel: 1,
            combat: { currentWave: 1, currentSubWave: 1, highestWave: 1, highestSubWave: 1 },
        }
    });
}

/** Generate a random guest username like "Hero_a3f7b2" */
function generateGuestUsername() {
    const suffix = crypto.randomBytes(3).toString('hex');
    return `Hero_${suffix}`;
}

// ─── POST /api/auth/register ─────────────────────────────────────
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

        await createDefaultGameState(user.id);
        await issueTokens(user, res, 201);
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/auth/login ────────────────────────────────────────
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
        if (!user || !user.passwordHash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        await issueTokens(user, res);
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/auth/guest ────────────────────────────────────────
router.post('/guest', authLimiter, async (req, res) => {
    try {
        // Generate unique guest username (retry on collision)
        let username;
        let user;
        for (let attempts = 0; attempts < 10; attempts++) {
            username = generateGuestUsername();
            try {
                user = await prisma.user.create({
                    data: { username, isGuest: true }
                });
                break;
            } catch (err) {
                // Unique constraint violation (P2002) — retry with new username
                if (err.code === 'P2002') continue;
                throw err;
            }
        }
        if (!user) {
            return res.status(503).json({ error: 'Could not generate unique username, please try again' });
        }

        await createDefaultGameState(user.id);
        await issueTokens(user, res, 201);
    } catch (err) {
        console.error('Guest register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/auth/discord ─────────────────────────────────────
// Client sends { code } from Discord OAuth redirect
router.post('/discord', authLimiter, async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'Authorization code required' });
    }

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
        return res.status(503).json({ error: 'Discord login is not configured' });
    }

    try {
        // Exchange code for access token
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: DISCORD_REDIRECT_URI,
            }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
            return res.status(401).json({ error: 'Discord authentication failed' });
        }

        // Fetch Discord user info
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const discordUser = await userRes.json();
        if (!userRes.ok || !discordUser.id) {
            return res.status(401).json({ error: 'Failed to get Discord profile' });
        }

        // Find or create user
        let user = await prisma.user.findUnique({ where: { discordId: discordUser.id } });

        if (!user) {
            let username = (discordUser.global_name || discordUser.username || `Discord_${discordUser.id.slice(-6)}`).slice(0, 24);

            // Try to create; on unique constraint collision, retry with random suffix
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    user = await prisma.user.create({
                        data: {
                            username,
                            discordId: discordUser.id,
                            email: discordUser.email || null,
                        }
                    });
                    break;
                } catch (err) {
                    if (err.code === 'P2002' && attempt < 2) {
                        username = `${username.slice(0, 24)}_${crypto.randomBytes(2).toString('hex')}`;
                        continue;
                    }
                    throw err;
                }
            }
            await createDefaultGameState(user.id);
        }

        await issueTokens(user, res);
    } catch (err) {
        console.error('Discord auth error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/auth/google ──────────────────────────────────────
// Client sends { credential } (Google ID token from GSI)
router.post('/google', authLimiter, async (req, res) => {
    const { credential } = req.body;
    if (!credential) {
        return res.status(400).json({ error: 'Google credential required' });
    }

    if (!GOOGLE_CLIENT_ID) {
        return res.status(503).json({ error: 'Google login is not configured' });
    }

    try {
        // Verify the Google ID token via Google's tokeninfo endpoint
        const verifyRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
        );
        const payload = await verifyRes.json();

        if (!verifyRes.ok || payload.aud !== GOOGLE_CLIENT_ID) {
            return res.status(401).json({ error: 'Invalid Google token' });
        }

        const googleId = payload.sub;
        const email = payload.email || null;

        // Find or create user
        let user = await prisma.user.findUnique({ where: { googleId } });

        if (!user) {
            let username = (payload.name || payload.email?.split('@')[0] || `Google_${googleId.slice(-6)}`).slice(0, 24);

            // Try to create; on unique constraint collision, retry with random suffix
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    user = await prisma.user.create({
                        data: {
                            username,
                            googleId,
                            email,
                        }
                    });
                    break;
                } catch (err) {
                    if (err.code === 'P2002' && attempt < 2) {
                        username = `${username.slice(0, 24)}_${crypto.randomBytes(2).toString('hex')}`;
                        continue;
                    }
                    throw err;
                }
            }
            await createDefaultGameState(user.id);
        }

        await issueTokens(user, res);
    } catch (err) {
        console.error('Google auth error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/auth/link-discord ─────────────────────────────────
// Link a Discord account to the current (guest) user
router.post('/link-discord', requireAuth, async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'Authorization code required' });
    }

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
        return res.status(503).json({ error: 'Discord login is not configured' });
    }

    try {
        // Exchange code for access token
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: DISCORD_CLIENT_ID,
                client_secret: DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
                redirect_uri: DISCORD_REDIRECT_URI,
            }),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
            return res.status(401).json({ error: 'Discord authentication failed' });
        }

        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const discordUser = await userRes.json();
        if (!userRes.ok || !discordUser.id) {
            return res.status(401).json({ error: 'Failed to get Discord profile' });
        }

        // Check if this Discord account is already linked to another user
        const existing = await prisma.user.findUnique({ where: { discordId: discordUser.id } });
        if (existing && existing.id !== req.user.userId) {
            return res.status(409).json({ error: 'This Discord account is already linked to another player' });
        }

        const user = await prisma.user.update({
            where: { id: req.user.userId },
            data: {
                discordId: discordUser.id,
                email: discordUser.email || undefined,
                isGuest: false,
            },
        });

        res.json({
            message: 'Discord account linked',
            user: { id: user.id, username: user.username, email: user.email, isGuest: user.isGuest },
        });
    } catch (err) {
        console.error('Link Discord error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/auth/link-google ──────────────────────────────────
// Link a Google account to the current (guest) user
router.post('/link-google', requireAuth, async (req, res) => {
    const { credential } = req.body;
    if (!credential) {
        return res.status(400).json({ error: 'Google credential required' });
    }

    if (!GOOGLE_CLIENT_ID) {
        return res.status(503).json({ error: 'Google login is not configured' });
    }

    try {
        const verifyRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
        );
        const payload = await verifyRes.json();

        if (!verifyRes.ok || payload.aud !== GOOGLE_CLIENT_ID) {
            return res.status(401).json({ error: 'Invalid Google token' });
        }

        const googleId = payload.sub;

        // Check if this Google account is already linked to another user
        const existing = await prisma.user.findUnique({ where: { googleId } });
        if (existing && existing.id !== req.user.userId) {
            return res.status(409).json({ error: 'This Google account is already linked to another player' });
        }

        const user = await prisma.user.update({
            where: { id: req.user.userId },
            data: {
                googleId,
                email: payload.email || undefined,
                isGuest: false,
            },
        });

        res.json({
            message: 'Google account linked',
            user: { id: user.id, username: user.username, email: user.email, isGuest: user.isGuest },
        });
    } catch (err) {
        console.error('Link Google error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/auth/refresh ─────────────────────────────────────
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

        // Rotate: delete old + create new atomically to avoid orphaned state
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);
        const decoded = jwt.decode(newRefreshToken);

        await prisma.$transaction([
            prisma.refreshToken.delete({ where: { id: stored.id } }),
            prisma.refreshToken.create({
                data: {
                    token: newRefreshToken,
                    userId: user.id,
                    expiresAt: new Date(decoded.exp * 1000),
                }
            }),
        ]);

        res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    } catch (err) {
        if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        console.error('Refresh error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/auth/logout ──────────────────────────────────────
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

// ─── GET /api/auth/me ───────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true, username: true, email: true, profilePicture: true,
                pvpRating: true, pvpWins: true, pvpLosses: true,
                isGuest: true, role: true, googleId: true, discordId: true,
                settings: true,
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Don't expose full OAuth IDs to client, just whether they're linked
        res.json({
            user: {
                ...user,
                googleId: undefined,
                discordId: undefined,
                hasGoogle: !!user.googleId,
                hasDiscord: !!user.discordId,
                role: user.role || 'user',
                settings: user.settings || {},
            }
        });
    } catch (err) {
        console.error('Me error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/auth/change-username ─────────────────────────────
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

// ─── PUT /api/auth/settings ─────────────────────────────────────
router.put('/settings', requireAuth, async (req, res) => {
    const { settings } = req.body;

    if (typeof settings !== 'object' || Array.isArray(settings) || settings === null) {
        return res.status(400).json({ error: 'Settings must be an object' });
    }

    // Validate known keys
    const VALID_THEMES = ['dark', 'light'];
    if (settings.theme !== undefined && !VALID_THEMES.includes(settings.theme)) {
        return res.status(400).json({ error: 'Invalid theme value' });
    }

    try {
        // Use a transaction to atomically read-merge-write settings
        const updated = await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: req.user.userId },
                select: { settings: true },
            });

            const current = (user?.settings && typeof user.settings === 'object') ? user.settings : {};
            const merged = { ...current, ...settings };

            return tx.user.update({
                where: { id: req.user.userId },
                data: { settings: merged },
                select: { settings: true },
            });
        });

        res.json({ message: 'Settings updated', settings: updated.settings });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PUT /api/auth/profile-picture ──────────────────────────────
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
