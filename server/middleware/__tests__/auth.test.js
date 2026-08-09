import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('jsonwebtoken', () => ({
    default: {
        verify: vi.fn(),
    },
}));

vi.mock('../../config.js', () => ({
    JWT_SECRET: 'test-secret',
}));

vi.mock('../../lib/prisma.js', () => ({
    default: {
        user: { findUnique: vi.fn() },
        ban: { findFirst: vi.fn() },
        mute: { findFirst: vi.fn() },
        auditLog: { create: vi.fn() },
    },
}));

import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma.js';
import { requireAuth, requireRole, socketAuth } from '../auth.js';

function mockRes() {
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
}

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------
describe('requireAuth', () => {
    beforeEach(() => vi.clearAllMocks());

    it('rejects when Authorization header is missing', () => {
        const req = { headers: {} };
        const res = mockRes();
        const next = vi.fn();
        requireAuth(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/missing/i);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects when Authorization header lacks Bearer prefix', () => {
        const req = { headers: { authorization: 'Basic abc123' } };
        const res = mockRes();
        const next = vi.fn();
        requireAuth(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('attaches user and calls next for a valid token', () => {
        jwt.verify.mockReturnValue({ userId: 42, username: 'Alice' });
        const req = { headers: { authorization: 'Bearer valid-token' } };
        const res = mockRes();
        const next = vi.fn();
        requireAuth(req, res, next);
        expect(req.user).toEqual({ userId: 42, username: 'Alice' });
        expect(next).toHaveBeenCalledOnce();
    });

    it('returns 401 with "Token expired" for expired tokens', () => {
        const err = new Error('expired');
        err.name = 'TokenExpiredError';
        jwt.verify.mockImplementation(() => { throw err; });
        const req = { headers: { authorization: 'Bearer expired-token' } };
        const res = mockRes();
        const next = vi.fn();
        requireAuth(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/expired/i);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 with "Invalid token" for malformed tokens', () => {
        jwt.verify.mockImplementation(() => { throw new Error('bad') });
        const req = { headers: { authorization: 'Bearer garbage' } };
        const res = mockRes();
        const next = vi.fn();
        requireAuth(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/invalid/i);
        expect(next).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// requireRole
// ---------------------------------------------------------------------------
describe('requireRole', () => {
    beforeEach(() => vi.clearAllMocks());

    it('calls next when user has one of the allowed roles', async () => {
        prisma.user.findUnique.mockResolvedValue({ role: 'admin' });
        const middleware = requireRole('admin', 'moderator');
        const req = { user: { userId: 1 } };
        const res = mockRes();
        const next = vi.fn();
        await middleware(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(req.user.role).toBe('admin');
    });

    it('returns 403 when user role is not in the allowed list', async () => {
        prisma.user.findUnique.mockResolvedValue({ role: 'user' });
        const middleware = requireRole('admin');
        const req = { user: { userId: 1 } };
        const res = mockRes();
        const next = vi.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when user is not found', async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        const middleware = requireRole('admin');
        const req = { user: { userId: 999 } };
        const res = mockRes();
        const next = vi.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 500 on database errors', async () => {
        prisma.user.findUnique.mockRejectedValue(new Error('db down'));
        const middleware = requireRole('admin');
        const req = { user: { userId: 1 } };
        const res = mockRes();
        const next = vi.fn();
        await middleware(req, res, next);
        expect(res.statusCode).toBe(500);
        expect(next).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// socketAuth
// ---------------------------------------------------------------------------
describe('socketAuth', () => {
    beforeEach(() => vi.clearAllMocks());

    it('attaches user to socket and calls next for valid token', () => {
        jwt.verify.mockReturnValue({ userId: 7, username: 'Bob' });
        const socket = { handshake: { auth: { token: 'good-token' } } };
        const next = vi.fn();
        socketAuth(socket, next);
        expect(socket.user).toEqual({ userId: 7, username: 'Bob' });
        expect(next).toHaveBeenCalledWith();
    });

    it('passes error to next when token is missing', () => {
        const socket = { handshake: { auth: {} } };
        const next = vi.fn();
        socketAuth(socket, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toMatch(/authentication/i);
    });

    it('passes error to next when handshake.auth is undefined', () => {
        const socket = { handshake: {} };
        const next = vi.fn();
        socketAuth(socket, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('passes error to next when token verification fails', () => {
        jwt.verify.mockImplementation(() => { throw new Error('bad'); });
        const socket = { handshake: { auth: { token: 'bad-token' } } };
        const next = vi.fn();
        socketAuth(socket, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toMatch(/invalid|expired/i);
    });
});
