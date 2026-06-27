import { describe, it, expect } from 'vitest';
import { autoForgeAction } from '../auto-forge.js';

const item = (tier, type = 'weapon') => ({ type, tier });
const off = { keepSlots: {}, trashRarities: {} };

describe('autoForgeAction — keeps everything that no filter rejects', () => {
    it('presents a strictly lower-rarity roll (the forge never judges your gear)', () => {
        // Previously this was auto-trashed, which silently ate most rolls.
        expect(autoForgeAction(item(2), item(4), off)).toBe('present');
    });

    it('presents a same-rarity roll even when it RAISES power', () => {
        // The whole point: power must never climb without the player choosing.
        expect(autoForgeAction(item(3), item(3), off)).toBe('present');
    });

    it('presents a higher-rarity roll for the player to decide', () => {
        expect(autoForgeAction(item(5), item(3), off)).toBe('present');
    });

    it('presents when the slot is empty (filling it still changes power)', () => {
        expect(autoForgeAction(item(1), null, off)).toBe('present');
    });
});

describe('autoForgeAction — trashRarities filter', () => {
    it('trashes every roll of a trashed rarity, even a better one', () => {
        const opts = { keepSlots: {}, trashRarities: { 3: true } };
        expect(autoForgeAction(item(3), item(1), opts)).toBe('trash');
        expect(autoForgeAction(item(3), null, opts)).toBe('trash');
    });

    it('leaves rolls of other rarities untouched', () => {
        const opts = { keepSlots: {}, trashRarities: { 3: true } };
        expect(autoForgeAction(item(4), item(2), opts)).toBe('present');
    });
});

describe('autoForgeAction — keepSlots filter', () => {
    it('trashes every roll for a kept slot, even a better one', () => {
        const opts = { keepSlots: { weapon: true }, trashRarities: {} };
        expect(autoForgeAction(item(7), item(1), opts)).toBe('trash');
        expect(autoForgeAction(item(7, 'weapon'), null, opts)).toBe('trash');
    });

    it('leaves other slots unaffected', () => {
        const opts = { keepSlots: { weapon: true }, trashRarities: {} };
        expect(autoForgeAction(item(5, 'armor'), item(3, 'armor'), opts)).toBe('present');
    });
});
