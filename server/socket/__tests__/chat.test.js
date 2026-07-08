import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({ default: {} }));
vi.mock('../../middleware/auth.js', () => ({
    getActiveMute: vi.fn(),
    logAudit: vi.fn(),
}));

import {
    getEloRank,
    frameOf,
    serializeConversation,
    storeCombatLog,
    getCombatLog,
} from '../chat.js';

// ---------------------------------------------------------------------------
// getEloRank
// ---------------------------------------------------------------------------
describe('getEloRank', () => {
    it('returns Bronze below 1000', () => {
        expect(getEloRank(999)).toEqual({ name: 'Bronze', icon: '\u{1F949}' });
        expect(getEloRank(0)).toEqual({ name: 'Bronze', icon: '\u{1F949}' });
    });

    it('returns Silver at exactly 1000', () => {
        expect(getEloRank(1000)).toEqual({ name: 'Silver', icon: '\u{1F948}' });
    });

    it('returns Silver at 1199 (just below Gold)', () => {
        expect(getEloRank(1199)).toEqual({ name: 'Silver', icon: '\u{1F948}' });
    });

    it('returns Gold at exactly 1200', () => {
        expect(getEloRank(1200)).toEqual({ name: 'Gold', icon: '\u{1F947}' });
    });

    it('returns Gold at 1399 (just below Platinum)', () => {
        expect(getEloRank(1399)).toEqual({ name: 'Gold', icon: '\u{1F947}' });
    });

    it('returns Platinum at exactly 1400', () => {
        expect(getEloRank(1400)).toEqual({ name: 'Platinum', icon: '⭐' });
    });

    it('returns Platinum at 1699 (just below Diamond)', () => {
        expect(getEloRank(1699)).toEqual({ name: 'Platinum', icon: '⭐' });
    });

    it('returns Diamond at exactly 1700', () => {
        expect(getEloRank(1700)).toEqual({ name: 'Diamond', icon: '💎' });
    });

    it('returns Diamond at 1999 (just below Master)', () => {
        expect(getEloRank(1999)).toEqual({ name: 'Diamond', icon: '💎' });
    });

    it('returns Master at exactly 2000', () => {
        expect(getEloRank(2000)).toEqual({ name: 'Master', icon: '👑' });
    });

    it('returns Master well above 2000', () => {
        expect(getEloRank(2500)).toEqual({ name: 'Master', icon: '👑' });
    });
});

// ---------------------------------------------------------------------------
// frameOf
// ---------------------------------------------------------------------------
describe('frameOf', () => {
    it('returns "none" for null gameState', () => {
        expect(frameOf(null)).toBe('none');
    });

    it('returns "none" for undefined gameState', () => {
        expect(frameOf(undefined)).toBe('none');
    });

    it('returns "none" for empty object', () => {
        expect(frameOf({})).toBe('none');
    });

    it('returns "none" when player is null', () => {
        expect(frameOf({ player: null })).toBe('none');
    });

    it('returns "none" when player has no frame property', () => {
        expect(frameOf({ player: {} })).toBe('none');
    });

    it('returns "none" when frame is not a string', () => {
        expect(frameOf({ player: { frame: 42 } })).toBe('none');
    });

    it('returns the frame string when present', () => {
        expect(frameOf({ player: { frame: 'gold' } })).toBe('gold');
    });

    it('returns empty string frame if that is the value', () => {
        expect(frameOf({ player: { frame: '' } })).toBe('');
    });
});

// ---------------------------------------------------------------------------
// serializeConversation
// ---------------------------------------------------------------------------
describe('serializeConversation', () => {
    const makeConv = (overrides = {}) => ({
        id: 1,
        type: 'dm',
        name: null,
        updatedAt: '2025-01-01T00:00:00Z',
        members: [
            { userId: 10, user: { username: 'Alice', profilePicture: 'alice.png' } },
            { userId: 20, user: { username: 'Bob', profilePicture: 'bob.png' } },
        ],
        ...overrides,
    });

    it('DM title is the other person username', () => {
        const result = serializeConversation(makeConv(), 10);
        expect(result.title).toBe('Bob');
        expect(result.type).toBe('dm');
        expect(result.channel).toBe('conv:1');
    });

    it('DM title from the other side is the first person username', () => {
        const result = serializeConversation(makeConv(), 20);
        expect(result.title).toBe('Alice');
    });

    it('group title is the group name', () => {
        const conv = makeConv({ type: 'group', name: 'Raiders' });
        const result = serializeConversation(conv, 10);
        expect(result.title).toBe('Raiders');
    });

    it('unnamed group defaults to "Group"', () => {
        const conv = makeConv({ type: 'group', name: null });
        const result = serializeConversation(conv, 10);
        expect(result.title).toBe('Group');
    });

    it('unnamed group with empty-string name defaults to "Group"', () => {
        const conv = makeConv({ type: 'group', name: '' });
        const result = serializeConversation(conv, 10);
        expect(result.title).toBe('Group');
    });

    it('DM with no other member defaults to "Direct message"', () => {
        const conv = makeConv({
            members: [{ userId: 10, user: { username: 'Alice', profilePicture: 'a.png' } }],
        });
        const result = serializeConversation(conv, 10);
        expect(result.title).toBe('Direct message');
    });

    it('includes all expected fields', () => {
        const conv = makeConv();
        const result = serializeConversation(conv, 10);
        expect(result).toEqual({
            id: 1,
            type: 'dm',
            name: null,
            title: 'Bob',
            members: [
                { id: 10, username: 'Alice', avatar: 'alice.png' },
                { id: 20, username: 'Bob', avatar: 'bob.png' },
            ],
            channel: 'conv:1',
            updatedAt: '2025-01-01T00:00:00Z',
        });
    });
});

// ---------------------------------------------------------------------------
// storeCombatLog / getCombatLog
// ---------------------------------------------------------------------------
describe('storeCombatLog / getCombatLog', () => {
    beforeEach(() => {
        // Clear any previously stored logs by storing with unique IDs;
        // getCombatLog returns null for unknown IDs, so we just need a fresh
        // namespace per test. We also restore Date.now if it was mocked.
        vi.restoreAllMocks();
    });

    it('stores and retrieves a combat log', () => {
        const id = 'test-combat-1';
        const data = { player1: { userId: 1 }, player2: { userId: 2 }, winnerId: 1 };
        storeCombatLog(id, data);
        const result = getCombatLog(id);
        expect(result).not.toBeNull();
        expect(result.player1.userId).toBe(1);
        expect(result.winnerId).toBe(1);
    });

    it('returns null for a non-existent combat log', () => {
        expect(getCombatLog('does-not-exist')).toBeNull();
    });

    it('returns null for an expired combat log (TTL > 24h)', () => {
        const id = 'test-combat-expired';
        const baseTime = 1_000_000_000_000;

        // Store at baseTime
        vi.spyOn(Date, 'now').mockReturnValue(baseTime);
        storeCombatLog(id, { rounds: [] });

        // Advance past 24h TTL (24h + 1ms)
        const past24h = baseTime + 24 * 60 * 60 * 1000 + 1;
        vi.spyOn(Date, 'now').mockReturnValue(past24h);

        expect(getCombatLog(id)).toBeNull();
    });

    it('returns the log when still within TTL', () => {
        const id = 'test-combat-within-ttl';
        const baseTime = 2_000_000_000_000;

        vi.spyOn(Date, 'now').mockReturnValue(baseTime);
        storeCombatLog(id, { rounds: [1, 2, 3] });

        // Advance to just under 24h
        const under24h = baseTime + 24 * 60 * 60 * 1000 - 1;
        vi.spyOn(Date, 'now').mockReturnValue(under24h);

        const result = getCombatLog(id);
        expect(result).not.toBeNull();
        expect(result.rounds).toEqual([1, 2, 3]);
    });

    it('stored log includes createdAt timestamp', () => {
        const id = 'test-combat-ts';
        const now = 3_000_000_000_000;
        vi.spyOn(Date, 'now').mockReturnValue(now);
        storeCombatLog(id, { data: true });
        const result = getCombatLog(id);
        expect(result.createdAt).toBe(now);
    });
});
