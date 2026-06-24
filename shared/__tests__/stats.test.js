import { describe, it, expect } from 'vitest';
import {
    BASE_HEALTH, BASE_DAMAGE, HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL, MAX_PLAYER_LEVEL,
    playerBaseHealth, playerBaseDamage, computeStatsFromEquipment, playerPowerScore,
} from '../stats.js';

describe('player level base stats', () => {
    it('level 1 equals the flat base values', () => {
        expect(playerBaseHealth(1)).toBe(BASE_HEALTH);
        expect(playerBaseDamage(1)).toBe(BASE_DAMAGE);
    });

    it('higher level raises base HP and attack linearly', () => {
        expect(playerBaseHealth(5)).toBe(BASE_HEALTH + 4 * HEALTH_PER_LEVEL);
        expect(playerBaseDamage(5)).toBe(BASE_DAMAGE + 4 * DAMAGE_PER_LEVEL);
        expect(playerBaseHealth(10)).toBeGreaterThan(playerBaseHealth(9));
        expect(playerBaseDamage(10)).toBeGreaterThan(playerBaseDamage(9));
    });

    it('treats missing/invalid level as level 1', () => {
        expect(playerBaseHealth()).toBe(BASE_HEALTH);
        expect(playerBaseDamage(0)).toBe(BASE_DAMAGE);
    });

    it('exposes a raised player level cap', () => {
        expect(MAX_PLAYER_LEVEL).toBeGreaterThan(100);
    });
});

describe('computeStatsFromEquipment with player level', () => {
    it('scales base maxHP and damage with level on empty equipment', () => {
        const lvl1 = computeStatsFromEquipment({}, 1);
        const lvl20 = computeStatsFromEquipment({}, 20);
        expect(lvl1.maxHP).toBe(playerBaseHealth(1));
        expect(lvl1.damage).toBe(playerBaseDamage(1));
        expect(lvl20.maxHP).toBeGreaterThan(lvl1.maxHP);
        expect(lvl20.damage).toBeGreaterThan(lvl1.damage);
    });

    it('defaults to level 1 when no level is passed', () => {
        expect(computeStatsFromEquipment({}).maxHP).toBe(playerBaseHealth(1));
    });
});

describe('playerPowerScore', () => {
    it('increases with player level even with the same gear', () => {
        const equipment = {};
        expect(playerPowerScore(equipment, 30)).toBeGreaterThan(playerPowerScore(equipment, 1));
    });
});
