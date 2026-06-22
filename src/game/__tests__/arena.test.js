import { describe, it, expect } from 'vitest';
import { makeEnemy, simulateDuel } from '../arena.js';
import { arenaEnemyPower, arenaReward } from '../config.js';

describe('arena scaling', () => {
    it('enemy power increases with rank', () => {
        expect(arenaEnemyPower(2)).toBeGreaterThan(arenaEnemyPower(1));
        expect(arenaEnemyPower(10)).toBeGreaterThan(arenaEnemyPower(5));
    });

    it('reward increases with rank', () => {
        expect(arenaReward(5)).toBeGreaterThan(arenaReward(1));
    });

    it('makeEnemy returns combat-ready stats', () => {
        const e = makeEnemy(3);
        expect(e.maxHP).toBeGreaterThan(0);
        expect(e.damage).toBeGreaterThan(0);
        expect(e.name).toBeTruthy();
    });
});

describe('simulateDuel', () => {
    const strong = { maxHP: 5000, damage: 400, critChance: 20, critMultiplier: 80, attackSpeed: 20, lifeSteal: 10, healthRegen: 2 };
    const weak = { maxHP: 200, damage: 10, critChance: 0, critMultiplier: 0, attackSpeed: 0, lifeSteal: 0, healthRegen: 0 };

    it('a far stronger fighter wins', () => {
        const { win, events } = simulateDuel(strong, weak);
        expect(win).toBe(true);
        expect(events.length).toBeGreaterThan(0);
    });

    it('a far weaker fighter loses', () => {
        const { win } = simulateDuel(weak, strong);
        expect(win).toBe(false);
    });

    it('always terminates with a boolean result', () => {
        const a = { maxHP: 1000, damage: 50, critChance: 5, critMultiplier: 50, attackSpeed: 0, lifeSteal: 0, healthRegen: 0 };
        const b = { maxHP: 1000, damage: 50, critChance: 5, critMultiplier: 50, attackSpeed: 0, lifeSteal: 0, healthRegen: 0 };
        const { win } = simulateDuel(a, b);
        expect(typeof win).toBe('boolean');
    });
});
