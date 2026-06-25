import { describe, it, expect } from 'vitest';
import { simulateBattle, simulateDuel, computeHit, seededRng } from '../combat.js';

const fighter = (over = {}) => ({
    maxHP: 1000, damage: 60, critChance: 15, critMultiplier: 60,
    attackSpeed: 0, lifeSteal: 0, healthRegen: 0, ranged: false, ...over,
});

describe('simulateBattle determinism (replayable fights)', () => {
    it('same inputs + same seed yield an identical winner AND timeline', () => {
        const a = simulateBattle([fighter({ id: 'player' })], [fighter({ id: 'opp', damage: 55 })], 12345);
        const b = simulateBattle([fighter({ id: 'player' })], [fighter({ id: 'opp', damage: 55 })], 12345);
        expect(a.win).toBe(b.win);
        expect(a.events).toEqual(b.events);
    });

    it('a different seed produces a different fight', () => {
        const a = simulateBattle([fighter({ id: 'player' })], [fighter({ id: 'opp' })], 1);
        const b = simulateBattle([fighter({ id: 'player' })], [fighter({ id: 'opp' })], 2);
        // Even matchup → the seed drives the crit/variance rolls, so the timelines
        // diverge (otherwise the seed isn't actually threaded through).
        expect(a.events).not.toEqual(b.events);
    });

    it('events reference the supplied entity ids', () => {
        const { events } = simulateBattle([fighter({ id: 'player' })], [fighter({ id: 'opp', damage: 10 })], 7);
        expect(events.length).toBeGreaterThan(0);
        for (const ev of events) {
            expect(['player', 'opp']).toContain(ev.by);
            expect(['player', 'opp']).toContain(ev.target);
        }
    });
});

describe('gear stats actually affect the fight', () => {
    it('far more damage wins deterministically', () => {
        const strong = fighter({ id: 'player', damage: 500, critChance: 0 });
        const weak = fighter({ id: 'opp', damage: 10, critChance: 0 });
        expect(simulateBattle([strong], [weak], 99).win).toBe(true);
        expect(simulateBattle([weak], [strong], 99).win).toBe(false);
    });

    it('attack speed lets an otherwise-even fighter come out ahead', () => {
        // Two identical fighters except one swings faster — the fast one should win
        // across the vast majority of seeds.
        let fastWins = 0;
        for (let seed = 0; seed < 40; seed++) {
            const fast = fighter({ id: 'player', critChance: 0, attackSpeed: 15 });
            const slow = fighter({ id: 'opp', critChance: 0, attackSpeed: 0 });
            if (simulateBattle([fast], [slow], seed).win) fastWins++;
        }
        expect(fastWins).toBeGreaterThan(30);
    });

    it('lifesteal swings a mirror match', () => {
        let stealWins = 0;
        for (let seed = 0; seed < 40; seed++) {
            const vamp = fighter({ id: 'player', critChance: 0, lifeSteal: 8 });
            const plain = fighter({ id: 'opp', critChance: 0, lifeSteal: 0 });
            if (simulateBattle([vamp], [plain], seed).win) stealWins++;
        }
        expect(stealWins).toBeGreaterThan(30);
    });
});

describe('computeHit seeded stream', () => {
    it('is reproducible from a seed', () => {
        const att = { damage: 100, critChance: 40, critMultiplier: 75 };
        const r1 = seededRng(42); const r2 = seededRng(42);
        const a = Array.from({ length: 15 }, () => computeHit(att, r1));
        const b = Array.from({ length: 15 }, () => computeHit(att, r2));
        expect(a).toEqual(b);
    });
});

describe('simulateDuel compatibility shape', () => {
    it('keeps the legacy { pHp, eHp } event shape and is seedable', () => {
        const a = simulateDuel({ maxHP: 500, damage: 80, critChance: 0 }, { maxHP: 500, damage: 20, critChance: 0 }, 3);
        const b = simulateDuel({ maxHP: 500, damage: 80, critChance: 0 }, { maxHP: 500, damage: 20, critChance: 0 }, 3);
        expect(a.win).toBe(true);
        expect(a.events[0]).toHaveProperty('pHp');
        expect(a.events[0]).toHaveProperty('eHp');
        expect(a.events).toEqual(b.events);
    });
});
