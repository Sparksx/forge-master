import { describe, it, expect } from 'vitest';
import {
    calculateItemStats, calculateStats, calculatePowerScore, computeStatsFromEquipment,
    HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL, GROWTH_EXPONENT,
    BONUS_STAT_KEYS,
    TIERS, MAX_TIER, EQUIPMENT_TYPES,
} from '../stats.js';

// ── melee/ranged conditional damage (depends on equipped weapon style) ─────────

describe('computeStatsFromEquipment style-conditional damage', () => {
    const weapon = (attackStyle, bonuses) => ({ weapon: { type: 'weapon', tier: 5, level: 60, attackStyle, bonuses } });

    it('applies Melee Damage on a melee weapon and ignores it on a ranged one', () => {
        const plain = computeStatsFromEquipment(weapon('melee', []), 1, 0).damage;
        const melee = computeStatsFromEquipment(weapon('melee', [{ type: 'meleeDamage', value: 80 }]), 1, 0).damage;
        const ranged = computeStatsFromEquipment(weapon('ranged', [{ type: 'meleeDamage', value: 80 }]), 1, 0).damage;
        expect(melee).toBeGreaterThan(plain);
        expect(ranged).toBe(plain); // wrong style → no effect
    });

    it('applies Ranged Damage only on a ranged weapon', () => {
        const plain = computeStatsFromEquipment(weapon('ranged', []), 1, 0).damage;
        const ranged = computeStatsFromEquipment(weapon('ranged', [{ type: 'rangedDamage', value: 25 }]), 1, 0).damage;
        const melee = computeStatsFromEquipment(weapon('melee', [{ type: 'rangedDamage', value: 25 }]), 1, 0).damage;
        expect(ranged).toBeGreaterThan(plain);
        expect(melee).toBe(plain);
    });

    it('surfaces the new defensive stats', () => {
        const s = computeStatsFromEquipment(weapon('melee', [
            { type: 'damageReduction', value: 5 }, { type: 'reflect', value: 10 }, { type: 'execute', value: 20 },
        ]), 1, 0);
        expect(s.damageReduction).toBe(5);
        expect(s.reflect).toBe(10);
        expect(s.execute).toBe(20);
    });
});

// ── calculateItemStats ───────────────────────────────────────────────────────

describe('calculateItemStats', () => {
    it('returns a positive integer', () => {
        const v = calculateItemStats(1, 1, true);
        expect(v).toBeGreaterThan(0);
        expect(Number.isInteger(v)).toBe(true);
    });

    it('health items scale by HEALTH_PER_LEVEL', () => {
        const hp = calculateItemStats(1, 1, true);
        const dmg = calculateItemStats(1, 1, false);
        expect(hp).toBeGreaterThan(dmg);
    });

    it('higher tier produces higher stats at the same level', () => {
        expect(calculateItemStats(10, 3, true)).toBeGreaterThan(calculateItemStats(10, 1, true));
        expect(calculateItemStats(10, 5, false)).toBeGreaterThan(calculateItemStats(10, 2, false));
    });

    it('higher level produces higher stats at the same tier', () => {
        expect(calculateItemStats(50, 2, true)).toBeGreaterThan(calculateItemStats(10, 2, true));
    });

    it('computes the expected value for a known input', () => {
        const effectiveLevel = (3 - 1) * 100 + 10;
        const expected = Math.floor(HEALTH_PER_LEVEL * Math.pow(effectiveLevel, GROWTH_EXPONENT));
        expect(calculateItemStats(10, 3, true)).toBe(expected);
    });

    it('damage items use DAMAGE_PER_LEVEL', () => {
        const effectiveLevel = (1 - 1) * 100 + 5;
        const expected = Math.floor(DAMAGE_PER_LEVEL * Math.pow(effectiveLevel, GROWTH_EXPONENT));
        expect(calculateItemStats(5, 1, false)).toBe(expected);
    });
});

// ── calculateStats ───────────────────────────────────────────────────────────

describe('calculateStats', () => {
    it('returns zeros for empty equipment', () => {
        const { totalHealth, totalDamage, bonuses } = calculateStats({});
        expect(totalHealth).toBe(0);
        expect(totalDamage).toBe(0);
        for (const key of BONUS_STAT_KEYS) {
            expect(bonuses[key]).toBe(0);
        }
    });

    it('returns zeros when all slots are null', () => {
        const equip = {};
        EQUIPMENT_TYPES.forEach(t => { equip[t] = null; });
        const { totalHealth, totalDamage } = calculateStats(equip);
        expect(totalHealth).toBe(0);
        expect(totalDamage).toBe(0);
    });

    it('sums health from health-type items', () => {
        const equip = {
            armor: { statType: 'health', stats: 100, bonuses: [] },
            hat: { statType: 'health', stats: 50, bonuses: [] },
        };
        const { totalHealth, totalDamage } = calculateStats(equip);
        expect(totalHealth).toBe(150);
        expect(totalDamage).toBe(0);
    });

    it('sums damage from damage-type items', () => {
        const equip = {
            weapon: { statType: 'damage', stats: 200, bonuses: [] },
            ring: { statType: 'damage', stats: 30, bonuses: [] },
        };
        const { totalHealth, totalDamage } = calculateStats(equip);
        expect(totalHealth).toBe(0);
        expect(totalDamage).toBe(230);
    });

    it('aggregates bonuses across items', () => {
        const equip = {
            weapon: {
                statType: 'damage', stats: 100,
                bonuses: [{ type: 'critChance', value: 3 }, { type: 'attackSpeed', value: 5 }],
            },
            ring: {
                statType: 'damage', stats: 50,
                bonuses: [{ type: 'critChance', value: 2 }],
            },
        };
        const { bonuses } = calculateStats(equip);
        expect(bonuses.critChance).toBe(5);
        expect(bonuses.attackSpeed).toBe(5);
    });

    it('ignores items with missing bonuses array', () => {
        const equip = {
            weapon: { statType: 'damage', stats: 100 },
        };
        const { totalDamage, bonuses } = calculateStats(equip);
        expect(totalDamage).toBe(100);
        expect(bonuses.critChance).toBe(0);
    });
});

// ── calculatePowerScore ──────────────────────────────────────────────────────

describe('calculatePowerScore', () => {
    it('returns a rounded integer', () => {
        const score = calculatePowerScore(100, 50, {});
        expect(Number.isInteger(score)).toBe(true);
    });

    it('equals health + damage with no bonuses', () => {
        expect(calculatePowerScore(100, 50, {})).toBe(150);
    });

    it('health multiplier increases the score', () => {
        const base = calculatePowerScore(100, 50, {});
        const boosted = calculatePowerScore(100, 50, { healthMulti: 20 });
        expect(boosted).toBeGreaterThan(base);
    });

    it('damage multiplier increases the score', () => {
        const base = calculatePowerScore(100, 50, {});
        const boosted = calculatePowerScore(100, 50, { damageMulti: 20 });
        expect(boosted).toBeGreaterThan(base);
    });

    it('attack speed increases the score', () => {
        const base = calculatePowerScore(100, 50, {});
        const boosted = calculatePowerScore(100, 50, { attackSpeed: 10 });
        expect(boosted).toBeGreaterThan(base);
    });

    it('double hit scales the damage pool like a multiplier', () => {
        const base = calculatePowerScore(100, 50, {});
        const boosted = calculatePowerScore(100, 50, { doubleHit: 10 });
        expect(boosted).toBeGreaterThan(base);
        expect(boosted).toBe(Math.round(100 + 50 * 1.1));
    });

    it('melee/ranged damage only counts for the matching weapon style', () => {
        const base = calculatePowerScore(100, 50, {});
        expect(calculatePowerScore(100, 50, { meleeDamage: 50 }, 'melee')).toBeGreaterThan(base);
        expect(calculatePowerScore(100, 50, { meleeDamage: 50 }, 'ranged')).toBe(base);
        expect(calculatePowerScore(100, 50, { rangedDamage: 25 }, 'ranged')).toBeGreaterThan(base);
        expect(calculatePowerScore(100, 50, { rangedDamage: 25 }, 'melee')).toBe(base);
    });

    it('damage reduction raises the score (effective HP)', () => {
        const base = calculatePowerScore(1000, 50, {});
        expect(calculatePowerScore(1000, 50, { damageReduction: 8 })).toBeGreaterThan(base);
    });

    it('reflect and execute add a little score', () => {
        const base = calculatePowerScore(100, 50, {});
        expect(calculatePowerScore(100, 50, { reflect: 12 })).toBeGreaterThan(base);
        expect(calculatePowerScore(100, 50, { execute: 30 })).toBeGreaterThan(base);
    });

    it('crit chance alone does not increase score (needs crit multiplier)', () => {
        const base = calculatePowerScore(100, 50, {});
        const critOnly = calculatePowerScore(100, 50, { critChance: 10 });
        expect(critOnly).toBe(base);
    });

    it('crit chance + multiplier together increase the score', () => {
        const base = calculatePowerScore(100, 50, {});
        const crits = calculatePowerScore(100, 50, { critChance: 10, critMultiplier: 20 });
        expect(crits).toBeGreaterThan(base);
    });

    it('sustain bonuses (regen + lifesteal) increase the score', () => {
        const base = calculatePowerScore(1000, 50, {});
        const sustain = calculatePowerScore(1000, 50, { healthRegen: 5, lifeSteal: 5 });
        expect(sustain).toBeGreaterThan(base);
    });
});

// ── Tier constant sanity ─────────────────────────────────────────────────────

describe('TIERS constant', () => {
    it('has MAX_TIER entries', () => {
        expect(TIERS.length).toBe(MAX_TIER);
    });

    it('each tier has id, name, color, and bonusCount', () => {
        TIERS.forEach((t, i) => {
            expect(t.id).toBe(i + 1);
            expect(typeof t.name).toBe('string');
            expect(t.color).toMatch(/^#/);
            expect(typeof t.bonusCount).toBe('number');
        });
    });

    it('bonus count is non-decreasing', () => {
        for (let i = 1; i < TIERS.length; i++) {
            expect(TIERS[i].bonusCount).toBeGreaterThanOrEqual(TIERS[i - 1].bonusCount);
        }
    });
});
