import { describe, it, expect } from 'vitest';
import { clanLevelFromTreasury, treasuryForLevel, clanPerks, clanLevelProgress, CLAN_LEVEL_BASE } from '../clan-config.js';

describe('clan levels', () => {
    it('starts at level 1 with empty treasury', () => {
        expect(clanLevelFromTreasury(0)).toBe(1);
    });

    it('reaches level 2 at the first threshold', () => {
        expect(treasuryForLevel(2)).toBe(CLAN_LEVEL_BASE);
        expect(clanLevelFromTreasury(CLAN_LEVEL_BASE)).toBe(2);
        expect(clanLevelFromTreasury(CLAN_LEVEL_BASE - 1)).toBe(1);
    });

    it('thresholds are strictly increasing', () => {
        let prev = -1;
        for (let l = 1; l <= 10; l++) {
            const t = treasuryForLevel(l);
            expect(t).toBeGreaterThan(prev);
            prev = t;
        }
    });

    it('perks scale with level and are zero at level 1', () => {
        expect(clanPerks(1)).toEqual({ goldBonusPct: 0, forgeLuckPct: 0, maxMembers: 10 });
        const p3 = clanPerks(3);
        expect(p3.goldBonusPct).toBeGreaterThan(0);
        expect(p3.forgeLuckPct).toBeGreaterThan(0);
        expect(p3.maxMembers).toBeGreaterThan(10);
    });

    it('progress reports a fraction toward the next level', () => {
        const prog = clanLevelProgress(Math.floor(CLAN_LEVEL_BASE / 2));
        expect(prog.level).toBe(1);
        expect(prog.pct).toBeGreaterThan(0);
        expect(prog.pct).toBeLessThan(1);
    });
});
