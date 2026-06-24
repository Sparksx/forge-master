import { describe, it, expect } from 'vitest';
import { MAX_TIER, MAX_PLAYER_LEVEL, EQUIPMENT_TYPES } from '../../../shared/stats.js';
import {
    isValidItem, isValidEquipment, isValidCombat, isValidForgeUpgrade,
    isValidPlayer, isValidResearch, isValidForgeHighestLevel, isValidSkills,
} from '../game-validators.js';

// ── isValidItem ──────────────────────────────────────────────────────────────

describe('isValidItem', () => {
    it('accepts null (empty slot)', () => {
        expect(isValidItem(null)).toBe(true);
    });

    it('accepts a well-formed item', () => {
        expect(isValidItem({ type: 'weapon', level: 5, tier: 3 })).toBe(true);
    });

    it('accepts an item with valid bonuses', () => {
        const item = {
            type: 'armor', level: 1, tier: 2,
            bonuses: [{ type: 'critChance', value: 5 }],
        };
        expect(isValidItem(item)).toBe(true);
    });

    it('accepts an item without bonuses field', () => {
        expect(isValidItem({ type: 'hat', level: 10, tier: 1 })).toBe(true);
    });

    it('rejects non-object types', () => {
        expect(isValidItem('weapon')).toBe(false);
        expect(isValidItem(42)).toBe(false);
        expect(isValidItem(undefined)).toBe(false);
        expect(isValidItem(true)).toBe(false);
    });

    it('rejects arrays', () => {
        expect(isValidItem([{ type: 'weapon', level: 1, tier: 1 }])).toBe(false);
    });

    it('rejects invalid level', () => {
        expect(isValidItem({ type: 'weapon', level: 0, tier: 1 })).toBe(false);
        expect(isValidItem({ type: 'weapon', level: -1, tier: 1 })).toBe(false);
        expect(isValidItem({ type: 'weapon', level: 'high', tier: 1 })).toBe(false);
    });

    it('rejects invalid tier', () => {
        expect(isValidItem({ type: 'weapon', level: 1, tier: 0 })).toBe(false);
        expect(isValidItem({ type: 'weapon', level: 1, tier: MAX_TIER + 1 })).toBe(false);
        expect(isValidItem({ type: 'weapon', level: 1, tier: 'epic' })).toBe(false);
    });

    it('rejects invalid equipment type', () => {
        expect(isValidItem({ type: 'gun', level: 1, tier: 1 })).toBe(false);
        expect(isValidItem({ type: '', level: 1, tier: 1 })).toBe(false);
        expect(isValidItem({ type: 123, level: 1, tier: 1 })).toBe(false);
    });

    it('rejects non-array bonuses', () => {
        expect(isValidItem({ type: 'weapon', level: 1, tier: 1, bonuses: 'none' })).toBe(false);
        expect(isValidItem({ type: 'weapon', level: 1, tier: 1, bonuses: {} })).toBe(false);
    });

    it('rejects malformed bonus entries', () => {
        expect(isValidItem({
            type: 'weapon', level: 1, tier: 1,
            bonuses: [{ type: '', value: 5 }],
        })).toBe(false);
        expect(isValidItem({
            type: 'weapon', level: 1, tier: 1,
            bonuses: [{ type: 'critChance', value: 'high' }],
        })).toBe(false);
        expect(isValidItem({
            type: 'weapon', level: 1, tier: 1,
            bonuses: [{ value: 5 }],
        })).toBe(false);
    });

    it('validates every equipment type', () => {
        for (const type of EQUIPMENT_TYPES) {
            expect(isValidItem({ type, level: 1, tier: 1 })).toBe(true);
        }
    });
});

// ── isValidEquipment ─────────────────────────────────────────────────────────

describe('isValidEquipment', () => {
    it('accepts an empty equipment map', () => {
        expect(isValidEquipment({})).toBe(true);
    });

    it('accepts valid equipment with null slots', () => {
        expect(isValidEquipment({ weapon: null, armor: null })).toBe(true);
    });

    it('accepts valid equipment with items', () => {
        expect(isValidEquipment({
            weapon: { type: 'weapon', level: 5, tier: 3 },
            armor: null,
        })).toBe(true);
    });

    it('rejects non-object', () => {
        expect(isValidEquipment(null)).toBe(false);
        expect(isValidEquipment('gear')).toBe(false);
        expect(isValidEquipment([])).toBe(false);
    });

    it('rejects unknown slot names', () => {
        expect(isValidEquipment({ sword: { type: 'weapon', level: 1, tier: 1 } })).toBe(false);
    });

    it('rejects invalid items in valid slots', () => {
        expect(isValidEquipment({ weapon: { type: 'weapon', level: -1, tier: 1 } })).toBe(false);
    });
});

// ── isValidCombat ────────────────────────────────────────────────────────────

describe('isValidCombat', () => {
    it('accepts valid combat state', () => {
        expect(isValidCombat({
            currentWave: 1, currentSubWave: 1, highestWave: 5, highestSubWave: 3,
        })).toBe(true);
    });

    it('rejects non-object', () => {
        expect(isValidCombat(null)).toBe(false);
        expect(isValidCombat([])).toBe(false);
        expect(isValidCombat('combat')).toBe(false);
    });

    it('rejects zero or negative waves', () => {
        expect(isValidCombat({ currentWave: 0, currentSubWave: 1, highestWave: 1, highestSubWave: 1 })).toBe(false);
        expect(isValidCombat({ currentWave: 1, currentSubWave: -1, highestWave: 1, highestSubWave: 1 })).toBe(false);
    });

    it('rejects non-numeric wave fields', () => {
        expect(isValidCombat({ currentWave: '1', currentSubWave: 1, highestWave: 1, highestSubWave: 1 })).toBe(false);
    });
});

// ── isValidForgeUpgrade ──────────────────────────────────────────────────────

describe('isValidForgeUpgrade', () => {
    it('accepts null (no upgrade in progress)', () => {
        expect(isValidForgeUpgrade(null)).toBe(true);
    });

    it('accepts valid forge upgrade with numeric startedAt', () => {
        expect(isValidForgeUpgrade({ targetLevel: 2, startedAt: 1700000000 })).toBe(true);
    });

    it('accepts valid forge upgrade with string startedAt', () => {
        expect(isValidForgeUpgrade({ targetLevel: 5, startedAt: '2024-01-01T00:00:00Z' })).toBe(true);
    });

    it('rejects targetLevel below 2', () => {
        expect(isValidForgeUpgrade({ targetLevel: 1, startedAt: 100 })).toBe(false);
        expect(isValidForgeUpgrade({ targetLevel: 0, startedAt: 100 })).toBe(false);
    });

    it('rejects non-object', () => {
        expect(isValidForgeUpgrade('upgrading')).toBe(false);
        expect(isValidForgeUpgrade([])).toBe(false);
    });

    it('rejects missing startedAt', () => {
        expect(isValidForgeUpgrade({ targetLevel: 3 })).toBe(false);
    });
});

// ── isValidPlayer ────────────────────────────────────────────────────────────

describe('isValidPlayer', () => {
    it('accepts a valid player', () => {
        expect(isValidPlayer({ level: 1, xp: 0 })).toBe(true);
        expect(isValidPlayer({ level: MAX_PLAYER_LEVEL, xp: 0 })).toBe(true);
    });

    it('accepts optional forgeXp', () => {
        expect(isValidPlayer({ level: 1, xp: 0, forgeXp: 50 })).toBe(true);
    });

    it('rejects level out of range', () => {
        expect(isValidPlayer({ level: 0, xp: 0 })).toBe(false);
        expect(isValidPlayer({ level: MAX_PLAYER_LEVEL + 1, xp: 0 })).toBe(false);
        expect(isValidPlayer({ level: -1, xp: 0 })).toBe(false);
    });

    it('rejects negative xp', () => {
        expect(isValidPlayer({ level: 1, xp: -10 })).toBe(false);
    });

    it('rejects negative forgeXp', () => {
        expect(isValidPlayer({ level: 1, xp: 0, forgeXp: -1 })).toBe(false);
    });

    it('rejects non-object', () => {
        expect(isValidPlayer(null)).toBe(false);
        expect(isValidPlayer([])).toBe(false);
        expect(isValidPlayer('player')).toBe(false);
    });
});

// ── isValidResearch ──────────────────────────────────────────────────────────

describe('isValidResearch', () => {
    it('accepts valid research state', () => {
        expect(isValidResearch({ completed: {}, active: null, queue: [] })).toBe(true);
    });

    it('accepts research with active project', () => {
        expect(isValidResearch({ completed: {}, active: { id: 'r1' }, queue: [] })).toBe(true);
    });

    it('accepts research without optional fields', () => {
        expect(isValidResearch({})).toBe(true);
    });

    it('rejects non-object completed', () => {
        expect(isValidResearch({ completed: 'all' })).toBe(false);
    });

    it('rejects non-object active (when not null/undefined)', () => {
        expect(isValidResearch({ active: 'running' })).toBe(false);
    });

    it('rejects non-array queue', () => {
        expect(isValidResearch({ queue: {} })).toBe(false);
    });

    it('rejects non-object', () => {
        expect(isValidResearch(null)).toBe(false);
        expect(isValidResearch([])).toBe(false);
    });
});

// ── isValidForgeHighestLevel ─────────────────────────────────────────────────

describe('isValidForgeHighestLevel', () => {
    it('accepts an empty object', () => {
        expect(isValidForgeHighestLevel({})).toBe(true);
    });

    it('accepts object with slot data', () => {
        expect(isValidForgeHighestLevel({ weapon: { 3: 50 } })).toBe(true);
    });

    it('rejects non-object', () => {
        expect(isValidForgeHighestLevel(null)).toBe(false);
        expect(isValidForgeHighestLevel([])).toBe(false);
        expect(isValidForgeHighestLevel('data')).toBe(false);
    });
});

// ── isValidSkills ────────────────────────────────────────────────────────────

describe('isValidSkills', () => {
    it('accepts valid skills', () => {
        expect(isValidSkills({ unlocked: {}, equipped: [] })).toBe(true);
    });

    it('accepts skills without optional fields', () => {
        expect(isValidSkills({})).toBe(true);
    });

    it('rejects non-object', () => {
        expect(isValidSkills(null)).toBe(false);
        expect(isValidSkills([])).toBe(false);
    });

    it('rejects array unlocked', () => {
        expect(isValidSkills({ unlocked: [] })).toBe(false);
    });

    it('rejects non-array equipped', () => {
        expect(isValidSkills({ equipped: {} })).toBe(false);
    });

    it('rejects more than 3 equipped skills', () => {
        expect(isValidSkills({ equipped: ['a', 'b', 'c', 'd'] })).toBe(false);
    });

    it('accepts exactly 3 equipped skills', () => {
        expect(isValidSkills({ equipped: ['a', 'b', 'c'] })).toBe(true);
    });
});
