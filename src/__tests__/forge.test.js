import { describe, it, expect } from 'vitest';
import { createItem, calculateStats, calculatePowerScore } from '../forge.js';
import { BONUS_STAT_KEYS, BONUS_STATS } from '../config.js';

describe('createItem', () => {
    it('creates a health item for hat', () => {
        const item = createItem('hat', 10);
        expect(item.type).toBe('hat');
        expect(item.level).toBe(10);
        expect(item.statType).toBe('health');
        expect(item.stats).toBe(50); // 10 * HEALTH_PER_LEVEL (5)
    });

    it('creates a health item for armor', () => {
        const item = createItem('armor', 5);
        expect(item.statType).toBe('health');
        expect(item.stats).toBe(25); // 5 * 5
    });

    it('creates a health item for belt', () => {
        const item = createItem('belt', 1);
        expect(item.statType).toBe('health');
        expect(item.stats).toBe(5);
    });

    it('creates a health item for boots', () => {
        const item = createItem('boots', 20);
        expect(item.statType).toBe('health');
        expect(item.stats).toBe(100);
    });

    it('creates a damage item for weapon', () => {
        const item = createItem('weapon', 10);
        expect(item.type).toBe('weapon');
        expect(item.level).toBe(10);
        expect(item.statType).toBe('damage');
        expect(item.stats).toBe(20); // 10 * DAMAGE_PER_LEVEL (2)
    });

    it('creates a damage item for gloves', () => {
        const item = createItem('gloves', 7);
        expect(item.statType).toBe('damage');
        expect(item.stats).toBe(14); // 7 * 2
    });

    it('creates a damage item for ring', () => {
        const item = createItem('ring', 50);
        expect(item.statType).toBe('damage');
        expect(item.stats).toBe(100);
    });

    it('creates a damage item for necklace', () => {
        const item = createItem('necklace', 3);
        expect(item.statType).toBe('damage');
        expect(item.stats).toBe(6);
    });

    it('handles level 1 (minimum)', () => {
        const item = createItem('hat', 1);
        expect(item.level).toBe(1);
        expect(item.stats).toBe(5);
    });

    it('handles level 100 (maximum)', () => {
        const item = createItem('weapon', 100);
        expect(item.level).toBe(100);
        expect(item.stats).toBe(200);
    });

    it('includes a valid bonus stat', () => {
        const item = createItem('hat', 10);
        expect(BONUS_STAT_KEYS).toContain(item.bonusType);
        expect(item.bonusValue).toBeGreaterThanOrEqual(1);
        expect(item.bonusValue).toBeLessThanOrEqual(BONUS_STATS[item.bonusType].max);
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
            hat: createItem('hat', 10),       // +50 health
            armor: createItem('armor', 5),     // +25 health
            belt: null, boots: null,
            gloves: null, necklace: null, ring: null, weapon: null,
        };
        const { totalHealth, totalDamage } = calculateStats(equipment);
        expect(totalHealth).toBe(75);
        expect(totalDamage).toBe(0);
    });

    it('sums damage items correctly', () => {
        const equipment = {
            hat: null, armor: null, belt: null, boots: null,
            gloves: createItem('gloves', 10),   // +20 damage
            necklace: null,
            ring: createItem('ring', 5),         // +10 damage
            weapon: createItem('weapon', 20),    // +40 damage
        };
        const { totalHealth, totalDamage } = calculateStats(equipment);
        expect(totalHealth).toBe(0);
        expect(totalDamage).toBe(70);
    });

    it('sums mixed equipment correctly', () => {
        const equipment = {
            hat: createItem('hat', 10),          // +50 health
            armor: createItem('armor', 10),      // +50 health
            belt: createItem('belt', 10),        // +50 health
            boots: createItem('boots', 10),      // +50 health
            gloves: createItem('gloves', 10),    // +20 damage
            necklace: createItem('necklace', 10),// +20 damage
            ring: createItem('ring', 10),        // +20 damage
            weapon: createItem('weapon', 10),    // +20 damage
        };
        const { totalHealth, totalDamage } = calculateStats(equipment);
        expect(totalHealth).toBe(200);
        expect(totalDamage).toBe(80);
    });

    it('handles empty object', () => {
        const { totalHealth, totalDamage } = calculateStats({});
        expect(totalHealth).toBe(0);
        expect(totalDamage).toBe(0);
    });

    it('aggregates bonus stats from equipment', () => {
        // Manually create items with known bonuses
        const hat = { type: 'hat', level: 5, stats: 25, statType: 'health', bonusType: 'critChance', bonusValue: 5 };
        const weapon = { type: 'weapon', level: 5, stats: 10, statType: 'damage', bonusType: 'critChance', bonusValue: 3 };
        const equipment = {
            hat, armor: null, belt: null, boots: null,
            gloves: null, necklace: null, ring: null, weapon,
        };
        const { bonuses } = calculateStats(equipment);
        expect(bonuses.critChance).toBe(8);
    });

    it('returns correct power score with no bonuses', () => {
        const power = calculatePowerScore(100, 10, {});
        // 100 + 10 = 110 (no multipliers)
        expect(power).toBe(110);
    });

    it('returns correct power score with bonuses', () => {
        const bonuses = {
            healthMulti: 10, healthRegen: 5, lifeSteal: 5,
            damageMulti: 10, attackSpeed: 20, critChance: 50, critMultiplier: 100,
        };
        // effectiveHealth = 100 * 1.10 * 1.10 = 121
        // effectiveDamage = 50 * 1.10 * 1.20 * (1 + 0.50 * 1.00) = 50 * 1.1 * 1.2 * 1.5 = 99
        // total = 220
        const power = calculatePowerScore(100, 50, bonuses);
        expect(power).toBe(220);
    });

    it('returns correct power score with no bonus object', () => {
        const power = calculatePowerScore(200, 80, null);
        expect(power).toBe(280);
    });

    it('handles items without bonus (backward compat)', () => {
        const oldItem = { type: 'hat', level: 5, stats: 25, statType: 'health' };
        const equipment = {
            hat: oldItem, armor: null, belt: null, boots: null,
            gloves: null, necklace: null, ring: null, weapon: null,
        };
        const { totalHealth, bonuses } = calculateStats(equipment);
        expect(totalHealth).toBe(25);
        BONUS_STAT_KEYS.forEach(key => expect(bonuses[key]).toBe(0));
    });
});
