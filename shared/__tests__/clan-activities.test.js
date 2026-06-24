import { describe, it, expect } from 'vitest';
import {
    EXPEDITIONS, expeditionDef, expeditionOutcome, maxActiveExpeditions,
    MISSIONS, missionDef, MISSION_TYPES, MISSION_PROGRESS_MAX_PER_REPORT,
} from '../clan-activities.js';

describe('expedition templates', () => {
    it('every expedition has sane fields and unique keys', () => {
        const keys = new Set();
        for (const e of EXPEDITIONS) {
            expect(e.slots).toBeGreaterThan(0);
            expect(e.durationMs).toBeGreaterThan(0);
            expect(e.rewardXp).toBeGreaterThan(0);
            expect(e.powerReq).toBeGreaterThan(0);
            // Launching is free (no gold gate); access is gated by clan level instead.
            expect(e.costGold).toBeUndefined();
            expect(e.minClanLevel).toBeGreaterThanOrEqual(1);
            expect(keys.has(e.key)).toBe(false);
            keys.add(e.key);
        }
    });

    it('unlock levels rise (or hold) with difficulty order', () => {
        for (let i = 1; i < EXPEDITIONS.length; i++) {
            expect(EXPEDITIONS[i].minClanLevel).toBeGreaterThanOrEqual(EXPEDITIONS[i - 1].minClanLevel);
        }
    });

    it('looks up by key', () => {
        expect(expeditionDef(EXPEDITIONS[0].key)).toBe(EXPEDITIONS[0]);
        expect(expeditionDef('nope')).toBe(null);
    });
});

describe('maxActiveExpeditions', () => {
    it('is always at least 1 and grows with clan level', () => {
        expect(maxActiveExpeditions(1)).toBe(1);
        expect(maxActiveExpeditions(0)).toBeGreaterThanOrEqual(1); // clamps low input
        expect(maxActiveExpeditions(5)).toBeGreaterThan(maxActiveExpeditions(1));
        expect(maxActiveExpeditions(30)).toBeGreaterThan(maxActiveExpeditions(10));
    });
});

describe('expeditionOutcome', () => {
    const def = { key: 't', slots: 4, powerReq: 1000, rewardXp: 100, rewardGold: 100 };

    it('an empty party always fails with no reward', () => {
        const o = expeditionOutcome(def, { totalPower: 0, filledSlots: 0 }, 0);
        expect(o.success).toBe(false);
        expect(o.rewardMult).toBe(0);
    });

    it('a full, over-powered party is a guaranteed success', () => {
        const o = expeditionOutcome(def, { totalPower: 5000, filledSlots: 4 }, 0.999);
        expect(o.score).toBe(1);
        expect(o.success).toBe(true);
        expect(o.rewardMult).toBeGreaterThanOrEqual(0.5);
    });

    it('a weak party can still scrape a partial reward on failure', () => {
        const o = expeditionOutcome(def, { totalPower: 100, filledSlots: 1 }, 0.99);
        expect(o.success).toBe(false);
        expect(o.rewardMult).toBeGreaterThan(0);
        expect(o.rewardMult).toBeLessThan(0.5);
    });

    it('rng below the score yields success', () => {
        const o = expeditionOutcome(def, { totalPower: 700, filledSlots: 4 }, 0);
        expect(o.success).toBe(true);
    });
});

describe('mission templates', () => {
    it('every mission has a valid type, target and reward', () => {
        const keys = new Set();
        for (const m of MISSIONS) {
            expect(m.target).toBeGreaterThan(0);
            expect(m.rewardXp).toBeGreaterThan(0);
            expect(typeof m.type).toBe('string');
            expect(keys.has(m.key)).toBe(false);
            keys.add(m.key);
        }
        expect(MISSION_TYPES.length).toBe(MISSIONS.length);
        expect(MISSION_PROGRESS_MAX_PER_REPORT).toBeGreaterThan(0);
    });

    it('looks up by key', () => {
        expect(missionDef(MISSIONS[0].key)).toBe(MISSIONS[0]);
        expect(missionDef('nope')).toBe(null);
    });
});
