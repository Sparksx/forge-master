import { describe, it, expect } from 'vitest';
import {
    MAX_TIER,
    MAX_PLAYER_LEVEL,
    MAX_ITEM_LEVEL,
    BONUS_STATS,
    calculateItemStats,
    HEALTH_ITEMS,
} from '../../../shared/stats.js';
import {
    isFiniteNumber,
    isNonNegativeNumber,
    isIntInRange,
    isValidBonuses,
    isValidItem,
    isValidEquipment,
    isValidCombat,
    isValidPlayer,
} from '../state-validation.js';

// Build a canonical, server-legal item for a slot — exactly what an honest
// client would forge and save.
function makeItem(slot, { level = 5, tier = 2, bonuses } = {}) {
    const isHealth = HEALTH_ITEMS.includes(slot);
    const item = {
        type: slot,
        level,
        tier,
        stats: calculateItemStats(level, tier, isHealth),
        statType: isHealth ? 'health' : 'damage',
        bonuses: bonuses ?? [{ type: 'critChance', value: 3 }],
    };
    if (slot === 'weapon') item.attackStyle = 'melee';
    return item;
}

describe('numeric guards reject false/non-finite data', () => {
    it('isFiniteNumber rejects NaN, Infinity and non-numbers', () => {
        expect(isFiniteNumber(5)).toBe(true);
        expect(isFiniteNumber(0)).toBe(true);
        expect(isFiniteNumber(NaN)).toBe(false);
        expect(isFiniteNumber(Infinity)).toBe(false);
        expect(isFiniteNumber(-Infinity)).toBe(false);
        expect(isFiniteNumber('5')).toBe(false);
        expect(isFiniteNumber(null)).toBe(false);
    });

    it('isNonNegativeNumber rejects negatives and Infinity (the classic "gold = Infinity" cheat)', () => {
        expect(isNonNegativeNumber(0)).toBe(true);
        expect(isNonNegativeNumber(1000)).toBe(true);
        expect(isNonNegativeNumber(-1)).toBe(false);
        expect(isNonNegativeNumber(Infinity)).toBe(false);
        expect(isNonNegativeNumber(NaN)).toBe(false);
    });

    it('isIntInRange enforces integer bounds', () => {
        expect(isIntInRange(5, 1, 10)).toBe(true);
        expect(isIntInRange(1, 1, 10)).toBe(true);
        expect(isIntInRange(10, 1, 10)).toBe(true);
        expect(isIntInRange(0, 1, 10)).toBe(false);
        expect(isIntInRange(11, 1, 10)).toBe(false);
        expect(isIntInRange(5.5, 1, 10)).toBe(false);
        expect(isIntInRange(Infinity, 1, 10)).toBe(false);
    });
});

describe('isValidItem accepts honest gear', () => {
    it('accepts a canonical forged item', () => {
        expect(isValidItem(makeItem('weapon'), 'weapon')).toBe(true);
        expect(isValidItem(makeItem('armor'), 'armor')).toBe(true);
        expect(isValidItem(null, 'ring')).toBe(true); // empty slot
    });
});

describe('isValidItem blocks tampered gear', () => {
    it('rejects an item level above the cap', () => {
        const item = makeItem('weapon', { level: MAX_ITEM_LEVEL + 1 });
        expect(isValidItem(item, 'weapon')).toBe(false);
    });

    it('rejects an absurd item level (the "level 1e9 = god stats" cheat)', () => {
        const item = makeItem('weapon', { level: 1e9 });
        expect(isValidItem(item, 'weapon')).toBe(false);
    });

    it('rejects a tier above MAX_TIER', () => {
        const item = makeItem('weapon', { tier: MAX_TIER + 1 });
        expect(isValidItem(item, 'weapon')).toBe(false);
    });

    it('rejects a non-integer / non-finite level', () => {
        expect(isValidItem(makeItem('weapon', { level: 5.5 }), 'weapon')).toBe(false);
        const inf = makeItem('weapon');
        inf.level = Infinity;
        expect(isValidItem(inf, 'weapon')).toBe(false);
    });

    it('rejects an item equipped in the wrong slot (weapon in the hat slot)', () => {
        expect(isValidItem(makeItem('weapon'), 'hat')).toBe(false);
    });

    it('rejects a fabricated raw stat value (cannot lie about `stats`)', () => {
        const item = makeItem('weapon');
        item.stats = 999999999;
        expect(isValidItem(item, 'weapon')).toBe(false);
    });

    it('rejects a mismatched statType', () => {
        const item = makeItem('armor'); // armor is a health item
        item.statType = 'damage';
        expect(isValidItem(item, 'armor')).toBe(false);
    });

    it('rejects attackStyle on a non-weapon and unknown styles on a weapon', () => {
        const armor = makeItem('armor');
        armor.attackStyle = 'ranged';
        expect(isValidItem(armor, 'armor')).toBe(false);

        const weapon = makeItem('weapon');
        weapon.attackStyle = 'teleport';
        expect(isValidItem(weapon, 'weapon')).toBe(false);
    });
});

describe('isValidBonuses blocks fabricated bonuses', () => {
    it('accepts in-range, known bonuses within the tier bonus count', () => {
        // tier 5 (Legendary) allows 2 bonuses
        expect(isValidBonuses([{ type: 'critChance', value: 5 }, { type: 'lifeSteal', value: 2 }], 5)).toBe(true);
    });

    it('rejects an unknown bonus stat type', () => {
        expect(isValidBonuses([{ type: 'instantWin', value: 1 }], 5)).toBe(false);
    });

    it('rejects a bonus value above its legal max (the inflated-crit cheat)', () => {
        const max = BONUS_STATS.critChance.max;
        expect(isValidBonuses([{ type: 'critChance', value: max }], 5)).toBe(true);
        expect(isValidBonuses([{ type: 'critChance', value: max + 1 }], 5)).toBe(false);
        expect(isValidBonuses([{ type: 'critChance', value: 100000 }], 5)).toBe(false);
    });

    it('rejects more bonuses than the tier allows', () => {
        // Common (tier 1) allows 0 bonuses
        expect(isValidBonuses([{ type: 'critChance', value: 1 }], 1)).toBe(false);
        // Uncommon (tier 2) allows 1 bonus, not 3
        expect(isValidBonuses(
            [{ type: 'critChance', value: 1 }, { type: 'lifeSteal', value: 1 }, { type: 'damageMulti', value: 1 }],
            2,
        )).toBe(false);
    });

    it('rejects duplicate bonus stacking and non-finite values', () => {
        expect(isValidBonuses([{ type: 'critChance', value: 2 }, { type: 'critChance', value: 2 }], 5)).toBe(false);
        expect(isValidBonuses([{ type: 'critChance', value: NaN }], 5)).toBe(false);
        expect(isValidBonuses([{ type: 'critChance', value: Infinity }], 5)).toBe(false);
    });

    it('rejects bonuses smuggled onto an item via isValidItem', () => {
        const item = makeItem('weapon', { tier: 5, bonuses: [{ type: 'critChance', value: 99999 }] });
        expect(isValidItem(item, 'weapon')).toBe(false);
    });
});

describe('isValidEquipment', () => {
    it('accepts a map of honest items keyed by their slot', () => {
        const equipment = { weapon: makeItem('weapon'), armor: makeItem('armor'), ring: null };
        expect(isValidEquipment(equipment)).toBe(true);
    });

    it('rejects an unknown slot key', () => {
        expect(isValidEquipment({ wings: makeItem('weapon') })).toBe(false);
    });

    it('rejects a map where the item does not match its slot', () => {
        expect(isValidEquipment({ hat: makeItem('weapon') })).toBe(false);
    });

    it('rejects non-objects', () => {
        expect(isValidEquipment(null)).toBe(false);
        expect(isValidEquipment([])).toBe(false);
        expect(isValidEquipment('hax')).toBe(false);
    });
});

describe('isValidPlayer guards level/xp', () => {
    it('accepts a normal player', () => {
        expect(isValidPlayer({ level: 10, xp: 50 })).toBe(true);
    });

    it('rejects a level above the cap or below 1', () => {
        expect(isValidPlayer({ level: MAX_PLAYER_LEVEL + 1, xp: 0 })).toBe(false);
        expect(isValidPlayer({ level: 0, xp: 0 })).toBe(false);
    });

    it('rejects non-finite or negative xp', () => {
        expect(isValidPlayer({ level: 1, xp: -5 })).toBe(false);
        expect(isValidPlayer({ level: 1, xp: Infinity })).toBe(false);
    });
});

describe('isValidCombat guards wave progress', () => {
    it('accepts valid waves', () => {
        expect(isValidCombat({ currentWave: 3, currentSubWave: 1, highestWave: 5, highestSubWave: 2 })).toBe(true);
    });

    it('rejects non-finite wave values (NaN/Infinity)', () => {
        expect(isValidCombat({ currentWave: Infinity, currentSubWave: 1, highestWave: 1, highestSubWave: 1 })).toBe(false);
        expect(isValidCombat({ currentWave: NaN, currentSubWave: 1, highestWave: 1, highestSubWave: 1 })).toBe(false);
    });

    it('rejects waves below 1', () => {
        expect(isValidCombat({ currentWave: 0, currentSubWave: 1, highestWave: 1, highestSubWave: 1 })).toBe(false);
    });
});
