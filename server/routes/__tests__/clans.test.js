import { describe, it, expect, vi } from 'vitest';

// Mock server-only dependencies that run at module-load time so the import of
// clans.js doesn't blow up (Router() is called at the top level, and several
// route handlers reference prisma / requireAuth).
vi.mock('express', () => {
    const fakeRouter = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    return { Router: () => fakeRouter };
});
vi.mock('../../lib/prisma.js', () => ({ default: {} }));
vi.mock('../../middleware/auth.js', () => ({
    requireAuth: (_req, _res, next) => next(),
    requireNotBanned: (_req, _res, next) => next(),
}));

import {
    validClanFields,
    serializeClan,
    serializeExpedition,
    serializeMission,
    memberPower,
} from '../clans.js';

// ── validClanFields ────────────────────────────────────────────────────────

describe('validClanFields', () => {
    it('returns null for fully valid input', () => {
        expect(validClanFields({ name: 'Warriors', tag: 'WAR', emblem: '⚔', description: 'We fight!' })).toBe(null);
    });

    it('returns null when optional fields are omitted', () => {
        expect(validClanFields({ name: 'Abc', tag: 'AB' })).toBe(null);
    });

    // ── name ──

    it('rejects a name shorter than 3 characters (after trim)', () => {
        expect(validClanFields({ name: '  ab  ', tag: 'AB' })).toMatch(/name/i);
    });

    it('rejects a name longer than 30 characters', () => {
        expect(validClanFields({ name: 'A'.repeat(31), tag: 'AB' })).toMatch(/name/i);
    });

    it('rejects a non-string name', () => {
        expect(validClanFields({ name: 123, tag: 'AB' })).toMatch(/name/i);
    });

    it('accepts a name exactly 3 characters after trim', () => {
        expect(validClanFields({ name: '  XYZ  ', tag: 'AB' })).toBe(null);
    });

    it('accepts a name exactly 30 characters', () => {
        expect(validClanFields({ name: 'A'.repeat(30), tag: 'AB' })).toBe(null);
    });

    // ── tag ──

    it('rejects a tag with special characters', () => {
        expect(validClanFields({ name: 'Warriors', tag: 'W@R' })).toMatch(/tag/i);
    });

    it('rejects a tag shorter than 2 characters', () => {
        expect(validClanFields({ name: 'Warriors', tag: 'A' })).toMatch(/tag/i);
    });

    it('rejects a tag longer than 5 characters', () => {
        expect(validClanFields({ name: 'Warriors', tag: 'ABCDEF' })).toMatch(/tag/i);
    });

    it('rejects a non-string tag', () => {
        expect(validClanFields({ name: 'Warriors', tag: 99 })).toMatch(/tag/i);
    });

    it('accepts a 2-character alphanumeric tag', () => {
        expect(validClanFields({ name: 'Warriors', tag: 'A1' })).toBe(null);
    });

    it('accepts a 5-character alphanumeric tag', () => {
        expect(validClanFields({ name: 'Warriors', tag: 'Ab12X' })).toBe(null);
    });

    // ── emblem ──

    it('rejects an emblem longer than 10 characters', () => {
        expect(validClanFields({ name: 'Warriors', tag: 'AB', emblem: 'x'.repeat(11) })).toMatch(/emblem/i);
    });

    it('rejects a non-string emblem', () => {
        expect(validClanFields({ name: 'Warriors', tag: 'AB', emblem: 42 })).toMatch(/emblem/i);
    });

    it('accepts emblem at exactly 10 characters', () => {
        expect(validClanFields({ name: 'Warriors', tag: 'AB', emblem: 'x'.repeat(10) })).toBe(null);
    });

    // ── description ──

    it('rejects a description longer than 200 characters', () => {
        expect(validClanFields({ name: 'Warriors', tag: 'AB', description: 'd'.repeat(201) })).toMatch(/description/i);
    });

    it('rejects a non-string description', () => {
        expect(validClanFields({ name: 'Warriors', tag: 'AB', description: true })).toMatch(/description/i);
    });

    it('accepts a description at exactly 200 characters', () => {
        expect(validClanFields({ name: 'Warriors', tag: 'AB', description: 'd'.repeat(200) })).toBe(null);
    });
});

// ── memberPower ────────────────────────────────────────────────────────────

describe('memberPower', () => {
    it('returns 0 for null', () => {
        expect(memberPower(null)).toBe(0);
    });

    it('returns 0 for undefined', () => {
        expect(memberPower(undefined)).toBe(0);
    });

    it('returns 0 for an object with no equipment key', () => {
        expect(memberPower({})).toBe(0);
    });

    it('returns 0 when equipment is null', () => {
        expect(memberPower({ equipment: null })).toBe(0);
    });

    it('delegates to gearPowerFromEquipment for valid equipment', () => {
        // A single tier-1, level-1 weapon should produce a small positive power.
        const equipment = {
            weapon: { type: 'weapon', level: 1, tier: 1 },
        };
        const result = memberPower({ equipment });
        expect(result).toBeGreaterThan(0);
        expect(Number.isFinite(result)).toBe(true);
    });
});

// ── serializeExpedition ────────────────────────────────────────────────────

describe('serializeExpedition', () => {
    const baseExp = {
        id: 'exp-1',
        defKey: 'patrol',
        difficulty: 'Easy',
        slots: 4,
        powerReq: 12000,
        rewardXp: 400,
        rewardGold: 24,
        startedBy: 'user-1',
        status: 'active',
        success: null,
        endsAt: new Date('2026-01-01T12:00:00Z'),
        members: [
            { userId: 'u1', user: { username: 'Alice' }, power: 5000 },
            { userId: 'u2', user: { username: 'Bob' }, power: 3000 },
        ],
    };

    it('builds the correct shape with all expected fields', () => {
        const now = new Date('2026-01-01T10:00:00Z').getTime(); // 2 hours before endsAt
        const result = serializeExpedition(baseExp, now);

        expect(result.id).toBe('exp-1');
        expect(result.defKey).toBe('patrol');
        expect(result.name).toBe('Border Patrol'); // from expeditionDef('patrol')
        expect(result.difficulty).toBe('Easy');
        expect(result.slots).toBe(4);
        expect(result.filled).toBe(2);
        expect(result.members).toHaveLength(2);
        expect(result.members[0]).toEqual({ userId: 'u1', username: 'Alice', power: 5000 });
        expect(result.members[1]).toEqual({ userId: 'u2', username: 'Bob', power: 3000 });
        expect(result.totalPower).toBe(8000);
        expect(result.powerReq).toBe(12000);
        expect(result.rewardXp).toBe(400);
        expect(result.rewardGold).toBe(24);
        expect(result.startedBy).toBe('user-1');
        expect(result.status).toBe('active');
        expect(result.success).toBe(null);
        expect(result.endsAt).toEqual(new Date('2026-01-01T12:00:00Z'));
        expect(result.msLeft).toBe(2 * 60 * 60 * 1000); // 2 hours in ms
    });

    it('clamps msLeft to 0 when endsAt is in the past', () => {
        const now = new Date('2026-01-02T00:00:00Z').getTime(); // well past endsAt
        const result = serializeExpedition(baseExp, now);
        expect(result.msLeft).toBe(0);
    });

    it('handles empty members array', () => {
        const exp = { ...baseExp, members: [] };
        const result = serializeExpedition(exp, Date.now());
        expect(result.filled).toBe(0);
        expect(result.members).toEqual([]);
        expect(result.totalPower).toBe(0);
    });

    it('handles missing members key', () => {
        const exp = { ...baseExp, members: undefined };
        const result = serializeExpedition(exp, Date.now());
        expect(result.filled).toBe(0);
        expect(result.members).toEqual([]);
        expect(result.totalPower).toBe(0);
    });

    it('falls back to defKey when expeditionDef returns null', () => {
        const exp = { ...baseExp, defKey: 'unknown_expedition' };
        const result = serializeExpedition(exp, Date.now());
        expect(result.name).toBe('unknown_expedition');
    });

    it('maps missing username to ???', () => {
        const exp = {
            ...baseExp,
            members: [{ userId: 'u1', user: null, power: 100 }],
        };
        const result = serializeExpedition(exp, Date.now());
        expect(result.members[0].username).toBe('???');
    });
});

// ── serializeMission ───────────────────────────────────────────────────────

describe('serializeMission', () => {
    const baseMission = {
        id: 'mis-1',
        defKey: 'forge',
        type: 'forge',
        target: 50,
        progress: 25,
        rewardXp: 300,
        status: 'active',
        contributions: [
            { userId: 'u1', user: { username: 'Alice' }, amount: 10 },
            { userId: 'u2', user: { username: 'Bob' }, amount: 20 },
            { userId: 'u3', user: { username: 'Charlie' }, amount: 5 },
            { userId: 'u4', user: { username: 'Dave' }, amount: 15 },
        ],
    };

    it('sorts contributors by amount descending', () => {
        const result = serializeMission(baseMission);
        expect(result.topContributors[0].username).toBe('Bob');
        expect(result.topContributors[1].username).toBe('Dave');
        expect(result.topContributors[2].username).toBe('Alice');
    });

    it('caps top contributors at 3', () => {
        const result = serializeMission(baseMission);
        expect(result.topContributors).toHaveLength(3);
        // Dave (15) is ranked 2nd; Charlie (5) ranked 4th should be excluded
        const names = result.topContributors.map((c) => c.username);
        expect(names).not.toContain('Charlie');
    });

    it('handles mission with no contributions', () => {
        const m = { ...baseMission, contributions: [] };
        const result = serializeMission(m);
        expect(result.topContributors).toEqual([]);
    });

    it('handles missing contributions key', () => {
        const m = { ...baseMission, contributions: undefined };
        const result = serializeMission(m);
        expect(result.topContributors).toEqual([]);
    });

    it('maps unknown username to ???', () => {
        const m = {
            ...baseMission,
            contributions: [{ userId: 'u1', user: null, amount: 10 }],
        };
        const result = serializeMission(m);
        expect(result.topContributors[0].username).toBe('???');
    });

    it('includes all expected fields', () => {
        const result = serializeMission(baseMission);
        expect(result.id).toBe('mis-1');
        expect(result.defKey).toBe('forge');
        expect(result.type).toBe('forge');
        expect(result.target).toBe(50);
        expect(result.progress).toBe(25);
        expect(result.rewardXp).toBe(300);
        expect(result.status).toBe('active');
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('desc');
    });

    it('falls back to defKey for unknown mission', () => {
        const m = { ...baseMission, defKey: 'unknown_mission_xyz' };
        const result = serializeMission(m);
        expect(result.name).toBe('unknown_mission_xyz');
        expect(result.desc).toBe('');
    });

    it('does not mutate the original contributions array', () => {
        const contributions = [
            { userId: 'u1', user: { username: 'A' }, amount: 1 },
            { userId: 'u2', user: { username: 'B' }, amount: 3 },
            { userId: 'u3', user: { username: 'C' }, amount: 2 },
        ];
        const m = { ...baseMission, contributions };
        serializeMission(m);
        // Original order should be preserved (the function calls .slice() before sorting)
        expect(contributions[0].amount).toBe(1);
        expect(contributions[1].amount).toBe(3);
        expect(contributions[2].amount).toBe(2);
    });
});
