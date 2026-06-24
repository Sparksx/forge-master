import { describe, it, expect } from 'vitest';
import { TIERS, EQUIPMENT_TYPES, BONUS_STATS } from '../config.js';
import {
    tierDef, rarityName, rarityColor, slotIcon, itemIcon, slotLabel,
    itemName, bonusDef, bonusLabel, RANGED_WEAPON_ICON,
} from '../items.js';

describe('tierDef', () => {
    it('returns the correct tier for each valid index', () => {
        for (let i = 1; i <= TIERS.length; i++) {
            expect(tierDef(i)).toBe(TIERS[i - 1]);
        }
    });

    it('falls back to tier 1 for null/undefined/zero', () => {
        expect(tierDef(null)).toBe(TIERS[0]);
        expect(tierDef(undefined)).toBe(TIERS[0]);
        expect(tierDef(0)).toBe(TIERS[0]);
    });

    it('falls back to tier 1 for out-of-range values', () => {
        expect(tierDef(99)).toBe(TIERS[0]);
    });
});

describe('rarityName', () => {
    it('returns the name string for each tier', () => {
        expect(rarityName(1)).toBe('Common');
        expect(rarityName(4)).toBe('Epic');
        expect(rarityName(7)).toBe('Divine');
    });
});

describe('rarityColor', () => {
    it('returns a hex color string for each tier', () => {
        for (let i = 1; i <= TIERS.length; i++) {
            expect(rarityColor(i)).toMatch(/^#[0-9a-f]{6}$/);
        }
    });

    it('matches the TIERS constant', () => {
        expect(rarityColor(2)).toBe(TIERS[1].color);
    });
});

describe('slotIcon', () => {
    it('returns an icon for every equipment type', () => {
        for (const type of EQUIPMENT_TYPES) {
            const icon = slotIcon(type);
            expect(icon).toBeTruthy();
            expect(icon).not.toBe('❔');
        }
    });

    it('returns fallback for unknown types', () => {
        expect(slotIcon('unknown')).toBe('❔');
        expect(slotIcon('')).toBe('❔');
    });
});

describe('itemIcon', () => {
    it('returns the slot icon for non-weapon items', () => {
        expect(itemIcon({ type: 'armor' })).toBe(slotIcon('armor'));
        expect(itemIcon({ type: 'hat' })).toBe(slotIcon('hat'));
    });

    it('returns weapon icon for melee weapons', () => {
        expect(itemIcon({ type: 'weapon', attackStyle: 'melee' })).toBe(slotIcon('weapon'));
    });

    it('returns ranged icon for ranged weapons', () => {
        expect(itemIcon({ type: 'weapon', attackStyle: 'ranged' })).toBe(RANGED_WEAPON_ICON);
    });

    it('returns slot icon fallback for null/undefined', () => {
        expect(itemIcon(null)).toBe('❔');
        expect(itemIcon(undefined)).toBe('❔');
    });
});

describe('slotLabel', () => {
    it('returns a human-readable label for every equipment type', () => {
        for (const type of EQUIPMENT_TYPES) {
            const label = slotLabel(type);
            expect(typeof label).toBe('string');
            expect(label.length).toBeGreaterThan(0);
        }
    });

    it('falls back to the raw type string for unknowns', () => {
        expect(slotLabel('laser')).toBe('laser');
    });
});

describe('itemName', () => {
    it('returns an existing name if the item already has one', () => {
        expect(itemName({ name: 'Excalibur', tier: 5, level: 10, type: 'weapon' })).toBe('Excalibur');
    });

    it('generates a two-word name from tier and level', () => {
        const name = itemName({ tier: 3, level: 5, type: 'weapon' });
        const parts = name.split(' ');
        expect(parts.length).toBe(2);
        expect(parts[0].length).toBeGreaterThan(0);
        expect(parts[1].length).toBeGreaterThan(0);
    });

    it('is deterministic — same item always gets the same name', () => {
        const item = { tier: 4, level: 12, type: 'armor' };
        expect(itemName(item)).toBe(itemName(item));
    });

    it('produces different names for different tiers', () => {
        const a = itemName({ tier: 1, level: 5, type: 'weapon' });
        const b = itemName({ tier: 7, level: 5, type: 'weapon' });
        expect(a).not.toBe(b);
    });

    it('uses ranged noun pool for ranged weapons', () => {
        const rangedNouns = ['Bow', 'Longbow', 'Crossbow', 'Sling', 'Recurve'];
        const name = itemName({ tier: 3, level: 5, type: 'weapon', attackStyle: 'ranged' });
        const noun = name.split(' ')[1];
        expect(rangedNouns).toContain(noun);
    });

    it('handles null/undefined gracefully', () => {
        const name = itemName(null);
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
    });
});

describe('bonusDef', () => {
    it('returns the definition for every known bonus key', () => {
        for (const key of Object.keys(BONUS_STATS)) {
            const def = bonusDef(key);
            expect(def).toBeDefined();
            expect(def.label).toBeTruthy();
            expect(def.icon).toBeTruthy();
            expect(typeof def.max).toBe('number');
        }
    });

    it('returns undefined for unknown keys', () => {
        expect(bonusDef('nonexistent')).toBeUndefined();
    });
});

describe('bonusLabel', () => {
    it('formats a bonus with icon, value, and label', () => {
        const label = bonusLabel({ type: 'critChance', value: 5 });
        expect(label).toContain('+5');
        expect(label).toContain('%');
        expect(label).toContain('Crit Chance');
    });

    it('returns empty string for unknown bonus type', () => {
        expect(bonusLabel({ type: 'fake', value: 10 })).toBe('');
    });
});
