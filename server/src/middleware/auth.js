import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.playerId = payload.playerId;
    req.username = payload.username;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authenticateSocket(socket, next) {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Token required'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    socket.playerId = payload.playerId;
    socket.username = payload.username;
    next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
}
