import { describe, it, expect } from 'vitest';
import { createItem, calculateStats } from '../forge.js';

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
});

describe('calculateStats', () => {
    it('returns zeros for all null equipment', () => {
        const equipment = {
            hat: null, armor: null, belt: null, boots: null,
            gloves: null, necklace: null, ring: null, weapon: null,
        };
        const { totalHealth, totalDamage } = calculateStats(equipment);
        expect(totalHealth).toBe(0);
        expect(totalDamage).toBe(0);
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
});
