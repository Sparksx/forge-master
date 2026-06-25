import { describe, it, expect } from 'vitest';
import { pickOpponent, attackerEloChange, MAX_POWER_RANGE } from '../pvp-match.js';

describe('pickOpponent', () => {
    it('returns null when there are no candidates', () => {
        expect(pickOpponent([], 1000)).toBeNull();
    });

    it('prefers an in-range opponent over a far-stronger one', () => {
        const candidates = [
            { username: 'close', power: 1050 },
            { username: 'whale', power: 100000 },
        ];
        // rng=0 → first in-range candidate.
        const chosen = pickOpponent(candidates, 1000, () => 0);
        expect(chosen.username).toBe('close');
    });

    it('falls back to the closest power when nobody is in range', () => {
        const candidates = [
            { username: 'a', power: 5000 },
            { username: 'b', power: 9000 },
        ];
        const chosen = pickOpponent(candidates, 1000);
        expect(chosen.username).toBe('a');
    });

    it('only treats genuinely near-power opponents as in range', () => {
        const justInside = 1000 * (1 + MAX_POWER_RANGE / 2); // within ±range
        const candidates = [{ username: 'inside', power: justInside }];
        expect(pickOpponent(candidates, 1000, () => 0).username).toBe('inside');
    });
});

describe('attackerEloChange (attacker-only)', () => {
    it('a win gains rating, a loss drops it', () => {
        expect(attackerEloChange(1000, 1000, true, 1000, 1000)).toBeGreaterThan(0);
        expect(attackerEloChange(1000, 1000, false, 1000, 1000)).toBeLessThan(0);
    });

    it('beating a stronger opponent pays more than beating a weaker one', () => {
        const vsStronger = attackerEloChange(1000, 1000, true, 1000, 3000);
        const vsWeaker = attackerEloChange(1000, 1000, true, 3000, 1000);
        expect(vsStronger).toBeGreaterThan(vsWeaker);
    });

    it('always moves rating by at least one point', () => {
        // Heavily favoured win still yields >= 1; upset loss still <= -1.
        expect(attackerEloChange(3000, 100, true, 5000, 100)).toBeGreaterThanOrEqual(1);
        expect(attackerEloChange(3000, 100, false, 5000, 100)).toBeLessThanOrEqual(-1);
    });
});
