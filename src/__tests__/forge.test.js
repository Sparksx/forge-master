import { describe, it, expect } from 'vitest';
import { createItem, calculateItemStats, calculateStats, calculatePowerScore, rollTier } from '../forge.js';
import { BONUS_STAT_KEYS, BONUS_STATS, HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL, GROWTH_EXPONENT, TIERS, FORGE_LEVELS } from '../config.js';

describe('calculateItemStats', () => {
    it('computes exponential health for tier 1 level 1', () => {
        const stats = calculateItemStats(1, 1, true);
        expect(stats).toBe(Math.floor(HEALTH_PER_LEVEL * Math.pow(1, GROWTH_EXPONENT)));
    });

    it('computes exponential health for tier 1 level 100', () => {
        const stats = calculateItemStats(100, 1, true);
        expect(stats).toBe(Math.floor(HEALTH_PER_LEVEL * Math.pow(100, GROWTH_EXPONENT)));
    });

    it('computes exponential damage for tier 1 level 10', () => {
        const stats = calculateItemStats(10, 1, false);
        expect(stats).toBe(Math.floor(DAMAGE_PER_LEVEL * Math.pow(10, GROWTH_EXPONENT)));
    });

    it('uses effective level = (tier-1)*100 + level', () => {
        const stats = calculateItemStats(50, 3, true);
        const effectiveLevel = 2 * 100 + 50;
        expect(stats).toBe(Math.floor(HEALTH_PER_LEVEL * Math.pow(effectiveLevel, GROWTH_EXPONENT)));
    });

    it('tier N+1 level 1 > tier N level 100 for health', () => {
        for (let tier = 1; tier < TIERS.length; tier++) {
            const maxCurrentTier = calculateItemStats(100, tier, true);
            const minNextTier = calculateItemStats(1, tier + 1, true);
            expect(minNextTier).toBeGreaterThan(maxCurrentTier);
        }
    });

    it('tier N+1 level 1 > tier N level 100 for damage', () => {
        for (let tier = 1; tier < TIERS.length; tier++) {
            const maxCurrentTier = calculateItemStats(100, tier, false);
            const minNextTier = calculateItemStats(1, tier + 1, false);
            expect(minNextTier).toBeGreaterThan(maxCurrentTier);
        }
    });
});

describe('createItem', () => {
    it('creates a tier 1 health item with no bonuses', () => {
        const item = createItem('hat', 10, 1);
        expect(item.type).toBe('hat');
        expect(item.level).toBe(10);
        expect(item.tier).toBe(1);
        expect(item.statType).toBe('health');
        expect(item.stats).toBe(calculateItemStats(10, 1, true));
        expect(item.bonuses).toEqual([]);
    });

    it('creates a tier 2 item with 1 bonus', () => {
        const item = createItem('armor', 5, 2);
        expect(item.tier).toBe(2);
        expect(item.bonuses).toHaveLength(1);
        expect(BONUS_STAT_KEYS).toContain(item.bonuses[0].type);
        expect(item.bonuses[0].value).toBeGreaterThanOrEqual(1);
    });

    it('creates a tier 3 item with 1 bonus', () => {
        const item = createItem('weapon', 50, 3);
        expect(item.tier).toBe(3);
        expect(item.bonuses).toHaveLength(1);
    });

    it('creates a tier 4 item with 2 distinct bonuses', () => {
        const item = createItem('belt', 30, 4);
        expect(item.tier).toBe(4);
        expect(item.bonuses).toHaveLength(2);
        expect(item.bonuses[0].type).not.toBe(item.bonuses[1].type);
    });

    it('creates a tier 5 item with 2 distinct bonuses', () => {
        const item = createItem('ring', 80, 5);
        expect(item.tier).toBe(5);
        expect(item.bonuses).toHaveLength(2);
        expect(item.bonuses[0].type).not.toBe(item.bonuses[1].type);
    });

    it('defaults to tier 1 when tier is omitted', () => {
        const item = createItem('hat', 10);
        expect(item.tier).toBe(1);
        expect(item.bonuses).toEqual([]);
    });

    it('creates a damage item for weapon', () => {
        const item = createItem('weapon', 10, 1);
        expect(item.statType).toBe('damage');
        expect(item.stats).toBe(calculateItemStats(10, 1, false));
    });

    it('creates health items for all health types', () => {
        ['hat', 'armor', 'belt', 'boots'].forEach(type => {
            const item = createItem(type, 5, 1);
            expect(item.statType).toBe('health');
        });
    });

    it('creates damage items for all damage types', () => {
        ['gloves', 'necklace', 'ring', 'weapon'].forEach(type => {
            const item = createItem(type, 5, 1);
            expect(item.statType).toBe('damage');
        });
    });
});

describe('rollTier', () => {
    it('always returns tier 1 at forge level 1', () => {
        for (let i = 0; i < 50; i++) {
            expect(rollTier(1)).toBe(1);
        }
    });

    it('returns valid tier values at forge level 10', () => {
        for (let i = 0; i < 100; i++) {
            const tier = rollTier(10);
            expect(tier).toBeGreaterThanOrEqual(2); // forge 10 has 0% T1
            expect(tier).toBeLessThanOrEqual(5);
        }
    });

    it('returns tiers within range for all forge levels', () => {
        for (let fl = 1; fl <= FORGE_LEVELS.length; fl++) {
            for (let i = 0; i < 20; i++) {
                const tier = rollTier(fl);
                expect(tier).toBeGreaterThanOrEqual(1);
                expect(tier).toBeLessThanOrEqual(TIERS.length);
            }
        }
    });
});

describe('calculateStats', () => {
    it('returns zeros for all null equipment', () => {
        const equipment = {
            hat: null, armor: null, belt: null, boots: null,
            gloves: null, necklace: null, ring: null, weapon: null,
        };
        const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);
        expect(totalHealth).toBe(0);
        expect(totalDamage).toBe(0);
        BONUS_STAT_KEYS.forEach(key => expect(bonuses[key]).toBe(0));
    });

    it('sums health items correctly', () => {
        const equipment = {
            hat: createItem('hat', 10, 1),
            armor: createItem('armor', 5, 1),
            belt: null, boots: null,
            gloves: null, necklace: null, ring: null, weapon: null,
        };
        const { totalHealth, totalDamage } = calculateStats(equipment);
        expect(totalHealth).toBe(
            calculateItemStats(10, 1, true) + calculateItemStats(5, 1, true)
        );
        expect(totalDamage).toBe(0);
    });

    it('sums damage items correctly', () => {
        const equipment = {
            hat: null, armor: null, belt: null, boots: null,
            gloves: createItem('gloves', 10, 1),
            necklace: null,
            ring: createItem('ring', 5, 1),
            weapon: createItem('weapon', 20, 1),
        };
        const { totalHealth, totalDamage } = calculateStats(equipment);
        expect(totalHealth).toBe(0);
        expect(totalDamage).toBe(
            calculateItemStats(10, 1, false) +
            calculateItemStats(5, 1, false) +
            calculateItemStats(20, 1, false)
        );
    });

    it('aggregates bonuses from new format items', () => {
        const hat = {
            type: 'hat', level: 5, tier: 2, stats: 100, statType: 'health',
            bonuses: [{ type: 'critChance', value: 5 }]
        };
        const weapon = {
            type: 'weapon', level: 5, tier: 2, stats: 50, statType: 'damage',
            bonuses: [{ type: 'critChance', value: 3 }]
        };
        const equipment = {
            hat, armor: null, belt: null, boots: null,
            gloves: null, necklace: null, ring: null, weapon,
        };
        const { bonuses } = calculateStats(equipment);
        expect(bonuses.critChance).toBe(8);
    });

    it('aggregates multiple bonuses from tier 4+ items', () => {
        const item = {
            type: 'hat', level: 50, tier: 4, stats: 1000, statType: 'health',
            bonuses: [
                { type: 'critChance', value: 5 },
                { type: 'attackSpeed', value: 10 }
            ]
        };
        const equipment = {
            hat: item, armor: null, belt: null, boots: null,
            gloves: null, necklace: null, ring: null, weapon: null,
        };
        const { bonuses } = calculateStats(equipment);
        expect(bonuses.critChance).toBe(5);
        expect(bonuses.attackSpeed).toBe(10);
    });

    it('handles empty object', () => {
        const { totalHealth, totalDamage } = calculateStats({});
        expect(totalHealth).toBe(0);
        expect(totalDamage).toBe(0);
    });
});

describe('calculatePowerScore', () => {
    it('returns correct power score with no bonuses', () => {
        const power = calculatePowerScore(100, 10, {});
        expect(power).toBe(110);
    });

    it('returns correct power score with bonuses', () => {
        const bonuses = {
            healthMulti: 10, healthRegen: 5, lifeSteal: 5,
            damageMulti: 10, attackSpeed: 20, critChance: 50, critMultiplier: 100,
        };
        const power = calculatePowerScore(100, 50, bonuses);
        expect(power).toBe(220);
    });

    it('returns correct power score with no bonus object', () => {
        const power = calculatePowerScore(200, 80, null);
        expect(power).toBe(280);
    });
});
