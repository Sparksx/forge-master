import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

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
