import { describe, it, expect } from 'vitest';
import { clanLevelFromXp, xpForLevel, clanPerks, clanLevelProgress, CLAN_XP_BASE, CLAN_MAX_LEVEL } from '../clan-config.js';

describe('clan levels (XP-driven)', () => {
    it('starts at level 1 with no XP', () => {
        expect(clanLevelFromXp(0)).toBe(1);
    });

    it('reaches level 2 at the first threshold', () => {
        expect(xpForLevel(2)).toBe(CLAN_XP_BASE);
        expect(clanLevelFromXp(CLAN_XP_BASE)).toBe(2);
        expect(clanLevelFromXp(CLAN_XP_BASE - 1)).toBe(1);
    });

    it('thresholds are strictly increasing', () => {
        let prev = -1;
        for (let l = 1; l <= 10; l++) {
            const t = xpForLevel(l);
            expect(t).toBeGreaterThan(prev);
            prev = t;
        }
    });

    it('caps at the max level', () => {
        expect(clanLevelFromXp(xpForLevel(CLAN_MAX_LEVEL) * 100)).toBe(CLAN_MAX_LEVEL);
    });

    it('perks scale with level and are neutral at level 1', () => {
        expect(clanPerks(1)).toEqual({
            goldBonusPct: 0, forgeLuckPct: 0, maxMembers: 10,
            forgeSpeedPct: 0, forgeBestOf: 1, statBonusPct: 0,
        });
        const p3 = clanPerks(3);
        expect(p3.goldBonusPct).toBeGreaterThan(0);
        expect(p3.forgeLuckPct).toBeGreaterThan(0);
        expect(p3.maxMembers).toBeGreaterThan(10);
        expect(p3.forgeSpeedPct).toBeGreaterThan(0);
        expect(p3.statBonusPct).toBeGreaterThan(0);
    });

    it('grants +1 best-of forge every 10 levels', () => {
        expect(clanPerks(1).forgeBestOf).toBe(1);
        expect(clanPerks(9).forgeBestOf).toBe(1);
        expect(clanPerks(10).forgeBestOf).toBe(2);
        expect(clanPerks(20).forgeBestOf).toBe(3);
    });

    it('progress reports a fraction toward the next level', () => {
        const prog = clanLevelProgress(Math.floor(CLAN_XP_BASE / 2));
        expect(prog.level).toBe(1);
        expect(prog.pct).toBeGreaterThan(0);
        expect(prog.pct).toBeLessThan(1);
    });

    it('reports atMax at the top level', () => {
        const prog = clanLevelProgress(xpForLevel(CLAN_MAX_LEVEL));
        expect(prog.atMax).toBe(true);
        expect(prog.pct).toBe(1);
    });
});
