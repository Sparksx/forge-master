import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import prisma from '../lib/prisma.js';

/**
 * Express middleware — verifies JWT access token from Authorization header.
 * Attaches decoded payload to req.user = { userId, username }.
 */
export function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid token' });
    }

    const token = header.slice(7);
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = { userId: payload.userId, username: payload.username };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

/**
 * Express middleware — requires user to have one of the specified roles.
 * Must be used AFTER requireAuth.
 */
export function requireRole(...roles) {
    return async (req, res, next) => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user.userId },
                select: { role: true },
            });
            if (!user || !roles.includes(user.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
            req.user.role = user.role;
            next();
        } catch (err) {
            console.error('Role check error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    };
}

/**
 * Check if a user is currently banned (active ban that hasn't expired).
 * Returns the active ban or null.
 */
export async function getActiveBan(userId) {
    const ban = await prisma.ban.findFirst({
        where: {
            userId,
            active: true,
            OR: [
                { expiresAt: null },           // permanent
                { expiresAt: { gt: new Date() } }, // not yet expired
            ],
        },
        orderBy: { createdAt: 'desc' },
    });
    return ban;
}

/**
 * Check if a user is currently muted (active mute that hasn't expired).
 * Returns the active mute or null.
 */
export async function getActiveMute(userId) {
    const mute = await prisma.mute.findFirst({
        where: {
            userId,
            active: true,
            expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
    });
    return mute;
}

/**
 * Log an admin/moderator action to the audit log.
 */
export async function logAudit(actorId, action, targetId = null, details = null) {
    try {
        await prisma.auditLog.create({
            data: { actorId, action, targetId, details },
        });
    } catch (err) {
        console.error('Audit log error:', err);
    }
}

/**
 * Socket.io middleware — verifies JWT from handshake auth.
 */
export function socketAuth(socket, next) {
    const token = socket.handshake.auth?.token;
    if (!token) {
        return next(new Error('Authentication required'));
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        socket.user = { userId: payload.userId, username: payload.username };
        next();
    } catch (err) {
        next(new Error('Invalid or expired token'));
    }
}
