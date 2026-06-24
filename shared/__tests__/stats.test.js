import { describe, it, expect } from 'vitest';
import {
    BASE_HEALTH, BASE_DAMAGE, HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL, MAX_PLAYER_LEVEL,
    BASE_ATTACK_PERIOD, playerBaseHealth, playerBaseDamage, computeStatsFromEquipment,
    playerPowerScore, weaponStyle,
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

describe('combat style', () => {
    it('paces combat at roughly one hit per second by default', () => {
        expect(BASE_ATTACK_PERIOD).toBeGreaterThan(0);
        expect(1 / BASE_ATTACK_PERIOD).toBeCloseTo(1.0, 1);
    });

    it('resolves weapon attack style, defaulting to melee', () => {
        expect(weaponStyle(null)).toBe('melee');
        expect(weaponStyle({ attackStyle: 'melee' })).toBe('melee');
        expect(weaponStyle({ attackStyle: 'ranged' })).toBe('ranged');
        expect(weaponStyle({})).toBe('melee');
    });

    it('derives the player ranged flag from the equipped weapon', () => {
        expect(computeStatsFromEquipment({}).ranged).toBe(false);
        expect(computeStatsFromEquipment({ weapon: { type: 'weapon', level: 5, tier: 2, attackStyle: 'ranged' } }).ranged).toBe(true);
        expect(computeStatsFromEquipment({ weapon: { type: 'weapon', level: 5, tier: 2, attackStyle: 'melee' } }).ranged).toBe(false);
    });
});
