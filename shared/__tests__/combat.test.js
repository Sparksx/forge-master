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

    it('double hit swings a mirror match in the double-hitter favour', () => {
        let wins = 0;
        for (let seed = 0; seed < 40; seed++) {
            const twin = fighter({ id: 'player', critChance: 0, doubleHit: 20 });
            const plain = fighter({ id: 'opp', critChance: 0, doubleHit: 0 });
            if (simulateBattle([twin], [plain], seed).win) wins++;
        }
        expect(wins).toBeGreaterThan(30);
    });
});

describe('double hit mechanic', () => {
    it('leaves a fight without the stat byte-identical (no extra rolls)', () => {
        const withZero = simulateBattle([fighter({ id: 'player', doubleHit: 0 })], [fighter({ id: 'opp', damage: 55 })], 12345);
        const without = simulateBattle([fighter({ id: 'player' })], [fighter({ id: 'opp', damage: 55 })], 12345);
        expect(withZero.events).toEqual(without.events);
    });

    it('fires a flagged extra shot at the same instant as the base shot', () => {
        const { events } = simulateBattle(
            [fighter({ id: 'player', critChance: 0, doubleHit: 100 })],
            [fighter({ id: 'opp', critChance: 0, damage: 1, maxHP: 100000 })],
            7,
        );
        const playerHits = events.filter((e) => e.by === 'player');
        const doubles = playerHits.filter((e) => e.double);
        expect(doubles.length).toBeGreaterThan(0);
        // Each extra shot shares its timestamp with a base shot fired the same instant.
        for (const d of doubles) {
            expect(playerHits.some((e) => !e.double && e.t === d.t)).toBe(true);
        }
    });

    it('retargets the extra shot onto the next living foe (independent target)', () => {
        // Two frail enemies; a guaranteed double hit with enough damage to one-shot
        // each should spill the second strike onto the second enemy.
        const { events } = simulateBattle(
            [fighter({ id: 'player', critChance: 0, damage: 5000, doubleHit: 100 })],
            [fighter({ id: 'a', maxHP: 100, damage: 1 }), fighter({ id: 'b', maxHP: 100, damage: 1 })],
            3,
        );
        const targets = new Set(events.filter((e) => e.by === 'player').map((e) => e.target));
        expect(targets.has('a')).toBe(true);
        expect(targets.has('b')).toBe(true);
    });
});

describe('defensive & finisher stats', () => {
    it('damage reduction swings a mirror match toward the tankier fighter', () => {
        let wins = 0;
        for (let seed = 0; seed < 40; seed++) {
            const tank = fighter({ id: 'player', critChance: 0, damageReduction: 8 });
            const plain = fighter({ id: 'opp', critChance: 0, damageReduction: 0 });
            if (simulateBattle([tank], [plain], seed).win) wins++;
        }
        expect(wins).toBeGreaterThan(30);
    });

    it('reflect bounces a share of incoming damage back at the attacker', () => {
        const { events } = simulateBattle(
            [fighter({ id: 'player', critChance: 0, reflect: 50 })],
            [fighter({ id: 'opp', critChance: 0, damage: 100 })],
            5,
        );
        const bounced = events.filter((e) => e.by === 'opp' && e.reflected > 0);
        expect(bounced.length).toBeGreaterThan(0);
    });

    it('execute never slows the kill and sometimes speeds it up', () => {
        const hitsToKill = (execute, seed) => simulateBattle(
            [fighter({ id: 'player', critChance: 0, damage: 30, execute })],
            [fighter({ id: 'opp', critChance: 0, damage: 1, maxHP: 400 })],
            seed,
        ).events.filter((e) => e.by === 'player').length;
        let everFewer = false, everMore = false;
        for (let seed = 0; seed < 30; seed++) {
            const withEx = hitsToKill(100, seed);
            const without = hitsToKill(0, seed);
            if (withEx < without) everFewer = true;
            if (withEx > without) everMore = true;
        }
        expect(everFewer).toBe(true);
        expect(everMore).toBe(false);
    });
});

describe('engageAt (staggered pack entry)', () => {
    it('delays a fighter\'s first attack until its wave', () => {
        // Long, survivable fight so the late enemy gets to act before the time cap.
        const tanky = (over) => fighter({ critChance: 0, damage: 5, maxHP: 100000, ...over });
        const { events } = simulateBattle(
            [tanky({ id: 'player' })],
            [tanky({ id: 'lead' }), tanky({ id: 'late', engageAt: 5 })],
            7,
        );
        const leadFirst = events.find((e) => e.by === 'lead');
        const lateFirst = events.find((e) => e.by === 'late');
        expect(leadFirst.t).toBeLessThan(1);            // lead opens immediately
        expect(lateFirst).toBeTruthy();
        expect(lateFirst.t).toBeGreaterThanOrEqual(5);  // late waits for its wave
    });

    it('leaves a fight without engageAt unchanged', () => {
        const a = simulateBattle([fighter({ id: 'player' })], [fighter({ id: 'opp', engageAt: 0 })], 3);
        const b = simulateBattle([fighter({ id: 'player' })], [fighter({ id: 'opp' })], 3);
        expect(a.events).toEqual(b.events);
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
