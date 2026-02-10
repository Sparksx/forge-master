import { describe, it, expect } from 'vitest';
import { TECHS, TECH_BRANCHES, getTechById, getResearchCost, getResearchTime } from '../tech-config.js';

describe('tech-config', () => {

    describe('TECH_BRANCHES', () => {
        it('defines 5 branches', () => {
            expect(TECH_BRANCHES).toHaveLength(5);
        });

        it('each branch has id, name, icon', () => {
            for (const branch of TECH_BRANCHES) {
                expect(typeof branch.id).toBe('string');
                expect(typeof branch.name).toBe('string');
                expect(typeof branch.icon).toBe('string');
            }
        });

        it('branch ids are unique', () => {
            const ids = TECH_BRANCHES.map(b => b.id);
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    describe('TECHS definitions', () => {
        it('has 24 technologies', () => {
            expect(TECHS).toHaveLength(24);
        });

        it('all tech ids are unique', () => {
            const ids = TECHS.map(t => t.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('every tech belongs to a valid branch', () => {
            const branchIds = new Set(TECH_BRANCHES.map(b => b.id));
            for (const tech of TECHS) {
                expect(branchIds.has(tech.branch)).toBe(true);
            }
        });

        it('every tech has required fields', () => {
            for (const tech of TECHS) {
                expect(typeof tech.id).toBe('string');
                expect(typeof tech.name).toBe('string');
                expect(typeof tech.icon).toBe('string');
                expect(typeof tech.branch).toBe('string');
                expect(typeof tech.maxLevel).toBe('number');
                expect(tech.maxLevel).toBeGreaterThanOrEqual(1);
                expect(typeof tech.description).toBe('string');
                expect(typeof tech.baseCost).toBe('number');
                expect(tech.baseCost).toBeGreaterThan(0);
                expect(typeof tech.costScale).toBe('number');
                expect(tech.costScale).toBeGreaterThanOrEqual(1);
                expect(typeof tech.baseTime).toBe('number');
                expect(tech.baseTime).toBeGreaterThan(0);
                expect(typeof tech.timeScale).toBe('number');
                expect(tech.timeScale).toBeGreaterThanOrEqual(1);
                expect(Array.isArray(tech.requires)).toBe(true);
                expect(tech.effect).toBeDefined();
                expect(typeof tech.effect.type).toBe('string');
                expect(typeof tech.effect.perLevel).toBe('number');
            }
        });

        it('prerequisites reference existing techs', () => {
            const techIds = new Set(TECHS.map(t => t.id));
            for (const tech of TECHS) {
                for (const req of tech.requires) {
                    expect(techIds.has(req.tech)).toBe(true);
                    expect(typeof req.level).toBe('number');
                    expect(req.level).toBeGreaterThanOrEqual(1);
                }
                if (tech.altRequires) {
                    for (const req of tech.altRequires) {
                        expect(techIds.has(req.tech)).toBe(true);
                        expect(typeof req.level).toBe('number');
                    }
                }
            }
        });

        it('prerequisite levels do not exceed the required tech maxLevel', () => {
            const techMap = new Map(TECHS.map(t => [t.id, t]));
            for (const tech of TECHS) {
                for (const req of tech.requires) {
                    const reqTech = techMap.get(req.tech);
                    expect(req.level).toBeLessThanOrEqual(reqTech.maxLevel);
                }
            }
        });

        it('no tech requires itself', () => {
            for (const tech of TECHS) {
                const reqIds = tech.requires.map(r => r.tech);
                expect(reqIds).not.toContain(tech.id);
            }
        });

        it('effect types are unique per tech', () => {
            // Each tech has one effect type; verify no duplicated effect types unexpectedly
            const effectTypes = TECHS.map(t => t.effect.type);
            // Some techs can share effect types (they shouldn't in this design)
            // but verify the mapping is consistent
            for (const tech of TECHS) {
                expect(tech.effect.type).toBe(tech.id);
            }
        });
    });

    describe('branch distribution', () => {
        it('forge branch has 5 techs', () => {
            expect(TECHS.filter(t => t.branch === 'forge')).toHaveLength(5);
        });

        it('equipment branch has 5 techs', () => {
            expect(TECHS.filter(t => t.branch === 'equipment')).toHaveLength(5);
        });

        it('combat branch has 5 techs', () => {
            expect(TECHS.filter(t => t.branch === 'combat')).toHaveLength(5);
        });

        it('economy branch has 5 techs', () => {
            expect(TECHS.filter(t => t.branch === 'economy')).toHaveLength(5);
        });

        it('automation branch has 4 techs', () => {
            expect(TECHS.filter(t => t.branch === 'automation')).toHaveLength(4);
        });
    });

    describe('getTechById', () => {
        it('returns the correct tech for each id', () => {
            for (const tech of TECHS) {
                expect(getTechById(tech.id)).toBe(tech);
            }
        });

        it('returns undefined for unknown id', () => {
            expect(getTechById('nonexistent')).toBeUndefined();
        });

        it('returns undefined for empty string', () => {
            expect(getTechById('')).toBeUndefined();
        });
    });

    describe('getResearchCost', () => {
        it('returns baseCost for level 1', () => {
            const tech = getTechById('forgeMultiple');
            expect(getResearchCost('forgeMultiple', 1)).toBe(tech.baseCost);
        });

        it('scales exponentially with level', () => {
            // forgeMultiple: baseCost=80, costScale=4
            expect(getResearchCost('forgeMultiple', 1)).toBe(80);
            expect(getResearchCost('forgeMultiple', 2)).toBe(Math.floor(80 * 4));
            expect(getResearchCost('forgeMultiple', 3)).toBe(Math.floor(80 * 16));
            expect(getResearchCost('forgeMultiple', 4)).toBe(Math.floor(80 * 64));
            expect(getResearchCost('forgeMultiple', 5)).toBe(Math.floor(80 * 256));
        });

        it('handles costScale of 1 (no scaling)', () => {
            // masterSmith: baseCost=5000, costScale=1, maxLevel=1
            expect(getResearchCost('masterSmith', 1)).toBe(5000);
        });

        it('returns Infinity for unknown tech', () => {
            expect(getResearchCost('unknownTech', 1)).toBe(Infinity);
        });
    });

    describe('getResearchTime', () => {
        it('returns baseTime for level 1', () => {
            const tech = getTechById('vitality');
            expect(getResearchTime('vitality', 1)).toBe(tech.baseTime);
        });

        it('scales exponentially with level', () => {
            // vitality: baseTime=150, timeScale=4
            expect(getResearchTime('vitality', 1)).toBe(150);
            expect(getResearchTime('vitality', 2)).toBe(Math.floor(150 * 4));
            expect(getResearchTime('vitality', 3)).toBe(Math.floor(150 * 16));
        });

        it('handles timeScale of 1 (no scaling)', () => {
            // masterwork: baseTime=7200, timeScale=1
            expect(getResearchTime('masterwork', 1)).toBe(7200);
        });

        it('returns Infinity for unknown tech', () => {
            expect(getResearchTime('unknownTech', 1)).toBe(Infinity);
        });
    });

    describe('specific tech configurations', () => {
        it('bonusEnhance has altRequires (OR prerequisite)', () => {
            const tech = getTechById('bonusEnhance');
            expect(tech.requiresAny).toBe(true);
            expect(tech.altRequires).toBeDefined();
            expect(tech.altRequires).toHaveLength(1);
            expect(tech.altRequires[0].tech).toBe('weaponMastery');
        });

        it('masterwork requires both armorMastery and weaponMastery at level 3', () => {
            const tech = getTechById('masterwork');
            expect(tech.requires).toHaveLength(2);
            expect(tech.requires).toEqual(
                expect.arrayContaining([
                    { tech: 'armorMastery', level: 3 },
                    { tech: 'weaponMastery', level: 3 },
                ])
            );
        });

        it('waveBreaker unlocks extended waves (+2 per level)', () => {
            const tech = getTechById('waveBreaker');
            expect(tech.effect.perLevel).toBe(2);
            expect(tech.maxLevel).toBe(5);
        });

        it('researchQueue allows queuing (+1 per level)', () => {
            const tech = getTechById('researchQueue');
            expect(tech.effect.perLevel).toBe(1);
            expect(tech.maxLevel).toBe(3);
        });

        it('doubleHarvest has two prerequisites', () => {
            const tech = getTechById('doubleHarvest');
            expect(tech.requires).toHaveLength(2);
            expect(tech.requires[0].tech).toBe('essenceResonance');
            expect(tech.requires[1].tech).toBe('treasureHunter');
        });
    });
});
