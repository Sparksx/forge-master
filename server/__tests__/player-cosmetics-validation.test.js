import { describe, it, expect } from 'vitest';
import { isValidPlayer } from '../lib/state-validation.js';

const base = { level: 1, xp: 0 };

describe('isValidPlayer — cosmetics fields', () => {
    it('accepts a player with no cosmetics fields (back-compat)', () => {
        expect(isValidPlayer({ ...base })).toBe(true);
    });

    it('accepts a well-formed owned-cosmetics list and frame', () => {
        expect(isValidPlayer({ ...base, cosmetics: ['ninja', 'gold'], frame: 'gold' })).toBe(true);
        expect(isValidPlayer({ ...base, cosmetics: [], frame: 'none' })).toBe(true);
    });

    it('rejects a non-array cosmetics field', () => {
        expect(isValidPlayer({ ...base, cosmetics: 'ninja' })).toBe(false);
        expect(isValidPlayer({ ...base, cosmetics: { ninja: true } })).toBe(false);
    });

    it('rejects cosmetics entries that are not short non-empty strings', () => {
        expect(isValidPlayer({ ...base, cosmetics: [123] })).toBe(false);
        expect(isValidPlayer({ ...base, cosmetics: [''] })).toBe(false);
        expect(isValidPlayer({ ...base, cosmetics: ['x'.repeat(31)] })).toBe(false);
    });

    it('rejects an absurdly long cosmetics list', () => {
        expect(isValidPlayer({ ...base, cosmetics: Array(101).fill('a') })).toBe(false);
    });

    it('rejects a non-string frame', () => {
        expect(isValidPlayer({ ...base, frame: 5 })).toBe(false);
    });
});
