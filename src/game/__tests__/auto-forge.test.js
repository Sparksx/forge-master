import { describe, it, expect } from 'vitest';
import { autoForgeAction } from '../auto-forge.js';

const item = (tier, type = 'weapon') => ({ type, tier });
const off = { trashLowerPower: false, keepSlots: {} };
const onTrash = { trashLowerPower: true, keepSlots: {} };

describe('autoForgeAction — never auto-equips your gear', () => {
    it('trashes a strictly lower-rarity roll', () => {
        expect(autoForgeAction(item(2), item(4), 50, off)).toBe('trash');
    });

    it('presents a same-rarity roll even when it RAISES power', () => {
        // The whole point: power must never climb without the player choosing.
        expect(autoForgeAction(item(3), item(3), 999, off)).toBe('present');
    });

    it('presents a same-rarity roll that lowers power (default)', () => {
        expect(autoForgeAction(item(3), item(3), -40, off)).toBe('present');
    });

    it('presents a higher-rarity roll for the player to decide', () => {
        expect(autoForgeAction(item(5), item(3), 120, off)).toBe('present');
    });

    it('presents when the slot is empty (filling it still changes power)', () => {
        expect(autoForgeAction(item(1), null, 30, off)).toBe('present');
    });
});

describe('autoForgeAction — trashLowerPower filter', () => {
    it('trashes a same-rarity, non-upgrade roll when enabled', () => {
        expect(autoForgeAction(item(3), item(3), -10, onTrash)).toBe('trash');
        expect(autoForgeAction(item(3), item(3), 0, onTrash)).toBe('trash');
    });

    it('still presents a same-rarity roll that is a power gain', () => {
        expect(autoForgeAction(item(3), item(3), 25, onTrash)).toBe('present');
    });

    it('trashes a higher-rarity roll only if it is not a power gain', () => {
        expect(autoForgeAction(item(5), item(3), -5, onTrash)).toBe('trash');
        expect(autoForgeAction(item(5), item(3), 5, onTrash)).toBe('present');
    });
});

describe('autoForgeAction — keepSlots filter', () => {
    it('trashes every roll for a kept slot, even a better one', () => {
        const opts = { trashLowerPower: false, keepSlots: { weapon: true } };
        expect(autoForgeAction(item(7), item(1), 5000, opts)).toBe('trash');
        expect(autoForgeAction(item(7, 'weapon'), null, 5000, opts)).toBe('trash');
    });

    it('leaves other slots unaffected', () => {
        const opts = { trashLowerPower: false, keepSlots: { weapon: true } };
        expect(autoForgeAction(item(5, 'armor'), item(3, 'armor'), 80, opts)).toBe('present');
    });
});
