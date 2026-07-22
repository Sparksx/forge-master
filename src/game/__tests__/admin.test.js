import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCurrentUser = vi.fn(() => null);

vi.mock('../../api.js', () => ({
    apiFetch: vi.fn(),
}));
vi.mock('../../socket-client.js', () => ({
    getSocket: vi.fn(() => null),
}));
vi.mock('../../auth.js', () => ({
    getCurrentUser: (...args) => mockGetCurrentUser(...args),
}));

import { getUserRole, isStaff, isAdmin } from '../admin.js';

describe('admin role helpers', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('getUserRole', () => {
        it('defaults to "user" when no user is logged in', () => {
            mockGetCurrentUser.mockReturnValue(null);
            expect(getUserRole()).toBe('user');
        });

        it('defaults to "user" when role is missing', () => {
            mockGetCurrentUser.mockReturnValue({ username: 'Alice' });
            expect(getUserRole()).toBe('user');
        });

        it('returns the actual role when set', () => {
            mockGetCurrentUser.mockReturnValue({ role: 'admin' });
            expect(getUserRole()).toBe('admin');
        });

        it('returns moderator role', () => {
            mockGetCurrentUser.mockReturnValue({ role: 'moderator' });
            expect(getUserRole()).toBe('moderator');
        });
    });

    describe('isStaff', () => {
        it('returns false for regular users', () => {
            mockGetCurrentUser.mockReturnValue({ role: 'user' });
            expect(isStaff()).toBe(false);
        });

        it('returns false when not logged in', () => {
            mockGetCurrentUser.mockReturnValue(null);
            expect(isStaff()).toBe(false);
        });

        it('returns true for admin', () => {
            mockGetCurrentUser.mockReturnValue({ role: 'admin' });
            expect(isStaff()).toBe(true);
        });

        it('returns true for moderator', () => {
            mockGetCurrentUser.mockReturnValue({ role: 'moderator' });
            expect(isStaff()).toBe(true);
        });
    });

    describe('isAdmin', () => {
        it('returns false for regular users', () => {
            mockGetCurrentUser.mockReturnValue({ role: 'user' });
            expect(isAdmin()).toBe(false);
        });

        it('returns false for moderator (not full admin)', () => {
            mockGetCurrentUser.mockReturnValue({ role: 'moderator' });
            expect(isAdmin()).toBe(false);
        });

        it('returns true only for admin', () => {
            mockGetCurrentUser.mockReturnValue({ role: 'admin' });
            expect(isAdmin()).toBe(true);
        });
    });
});
