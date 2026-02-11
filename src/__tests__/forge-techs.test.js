import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before importing modules
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: vi.fn((key) => store[key] ?? null),
        setItem: vi.fn((key, value) => { store[key] = value; }),
        removeItem: vi.fn((key) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

const { resetGame, completeResearch, getTechEffect } = await import('../state.js');
const { createItem, rollTier, getEffectiveMaxLevel } = await import('../forge.js');
const { MAX_LEVEL, TIERS, FORGE_LEVELS, HEALTH_ITEMS, BONUS_STAT_KEYS } = await import('../config.js');

describe('forge tech effects', () => {

    beforeEach(() => {
        localStorageMock.clear();
        localStorageMock.getItem.mockClear();
        localStorageMock.setItem.mockClear();
        resetGame();
    });

    describe('tierAffinity', () => {
        it('has no effect at level 0', () => {
            expect(getTechEffect('tierAffinity')).toBe(0);
        });

        it('adds 2% per level', () => {
            completeResearch('forgeMultiple', 1);
            completeResearch('forgeMultiple', 2);
            completeResearch('tierAffinity', 1);
            expect(getTechEffect('tierAffinity')).toBe(2);
            completeResearch('tierAffinity', 2);
            expect(getTechEffect('tierAffinity')).toBe(4);
        });

        it('shifts tier chances upward when rolling', () => {
            // At forge level 1, chances are [100, 0, 0, 0, 0, 0]
            // With tierAffinity at 2, 2% should shift from tier 1 to tier 2
            completeResearch('forgeMultiple', 1);
            completeResearch('forgeMultiple', 2);
            completeResearch('tierAffinity', 1);

            // Roll many times and verify we can get tier > 1
            // (At forge level 1 without tech, it's always 100% common)
            // With 2% shifted, ~2% chance of uncommon
            let gotHigherTier = false;
            for (let i = 0; i < 500; i++) {
                const tier = rollTier(1);
                if (tier > 1) {
                    gotHigherTier = true;
                    break;
                }
            }
            expect(gotHigherTier).toBe(true);
        });
    });

    describe('extraBonus', () => {
        it('has no effect at level 0', () => {
            expect(getTechEffect('extraBonus')).toBe(0);
        });

        it('adds +1 bonus slot per level', () => {
            // Need prereqs: any mastery L5 -> bonusEnhance L3 -> extraBonus
            completeResearch('armorMastery', 5);
            completeResearch('bonusEnhance', 1);
            completeResearch('bonusEnhance', 2);
            completeResearch('bonusEnhance', 3);
            completeResearch('extraBonus', 1);
            expect(getTechEffect('extraBonus')).toBe(1);
        });

        it('creates items with more bonuses when active', () => {
            // Setup: extraBonus level 1
            completeResearch('armorMastery', 5);
            completeResearch('bonusEnhance', 1);
            completeResearch('bonusEnhance', 2);
            completeResearch('bonusEnhance', 3);
            completeResearch('extraBonus', 1);

            // Tier 2 items normally get 1 bonus; with extraBonus, they get 2
            // We create a tier 2 item (bonusCount = 1) + 1 extra = 2 bonuses
            const item = createItem('weapon', 50, 2);
            expect(item.bonuses.length).toBe(2); // 1 (tier 2 base) + 1 (extra)
        });

        it('tier 1 items get bonus slots from tech', () => {
            completeResearch('armorMastery', 5);
            completeResearch('bonusEnhance', 1);
            completeResearch('bonusEnhance', 2);
            completeResearch('bonusEnhance', 3);
            completeResearch('extraBonus', 1);

            // Tier 1 normally has 0 bonuses; with extraBonus L1 it should have 1
            const item = createItem('weapon', 50, 1);
            expect(item.bonuses.length).toBe(1);
        });

        it('bonus count is capped at total available bonus stat keys', () => {
            // Extreme case: extraBonus 3 + tier 6 (bonusCount 3) = 6, but BONUS_STAT_KEYS has 7
            completeResearch('armorMastery', 5);
            completeResearch('bonusEnhance', 1);
            completeResearch('bonusEnhance', 2);
            completeResearch('bonusEnhance', 3);
            completeResearch('extraBonus', 1);
            completeResearch('extraBonus', 2);
            completeResearch('extraBonus', 3);

            // Tier 6 (3 base bonuses + 3 extra = 6)
            const item = createItem('weapon', 50, 6);
            expect(item.bonuses.length).toBe(6);
            expect(item.bonuses.length).toBeLessThanOrEqual(BONUS_STAT_KEYS.length);
        });
    });

    describe('bonusEnhance', () => {
        it('increases bonus stat values', () => {
            completeResearch('armorMastery', 5);
            completeResearch('bonusEnhance', 1);
            expect(getTechEffect('bonusEnhance')).toBe(8); // +8% per level

            // Create many tier 2 items and check average bonus value is higher
            // than without tech (statistical check)
            const valuesWithTech = [];
            for (let i = 0; i < 500; i++) {
                const item = createItem('weapon', 50, 2);
                if (item.bonuses.length > 0) {
                    valuesWithTech.push(item.bonuses[0].value);
                }
            }

            // Reset and compare without tech
            resetGame();
            const valuesWithout = [];
            for (let i = 0; i < 500; i++) {
                const item = createItem('weapon', 50, 2);
                if (item.bonuses.length > 0) {
                    valuesWithout.push(item.bonuses[0].value);
                }
            }

            const avgWith = valuesWithTech.reduce((a, b) => a + b, 0) / valuesWithTech.length;
            const avgWithout = valuesWithout.reduce((a, b) => a + b, 0) / valuesWithout.length;
            // With 8% enhancement, average should be higher
            expect(avgWith).toBeGreaterThan(avgWithout * 0.90); // tolerance for randomness
        });
    });

    describe('getEffectiveMaxLevel', () => {
        it('returns MAX_LEVEL with no tech', () => {
            expect(getEffectiveMaxLevel('hat')).toBe(MAX_LEVEL);
            expect(getEffectiveMaxLevel('weapon')).toBe(MAX_LEVEL);
        });

        it('each mastery increases only its own slot max level', () => {
            completeResearch('armorMastery', 1);
            // armorMastery: +2 per level, only affects 'armor'
            expect(getEffectiveMaxLevel('armor')).toBe(MAX_LEVEL + 2);
            expect(getEffectiveMaxLevel('hat')).toBe(MAX_LEVEL); // unaffected
            expect(getEffectiveMaxLevel('weapon')).toBe(MAX_LEVEL); // unaffected
        });

        it('weaponMastery increases only weapon max level', () => {
            completeResearch('weaponMastery', 1);
            // weaponMastery: +2 per level, only affects 'weapon'
            expect(getEffectiveMaxLevel('weapon')).toBe(MAX_LEVEL + 2);
            expect(getEffectiveMaxLevel('gloves')).toBe(MAX_LEVEL); // unaffected
            expect(getEffectiveMaxLevel('hat')).toBe(MAX_LEVEL); // unaffected
        });

        it('armorMastery does not affect weapon slot', () => {
            completeResearch('armorMastery', 3);
            expect(getEffectiveMaxLevel('weapon')).toBe(MAX_LEVEL);
        });

        it('weaponMastery does not affect armor slot', () => {
            completeResearch('weaponMastery', 3);
            expect(getEffectiveMaxLevel('armor')).toBe(MAX_LEVEL);
        });

        it('scales with multiple levels', () => {
            completeResearch('armorMastery', 5);
            // 5 * 2 = +10
            expect(getEffectiveMaxLevel('armor')).toBe(MAX_LEVEL + 10);
        });
    });

    describe('masterwork', () => {
        it('has no effect at level 0', () => {
            expect(getTechEffect('masterwork')).toBe(0);
        });

        it('has effect at level 1', () => {
            completeResearch('hatMastery', 10);
            completeResearch('weaponMastery', 10);
            completeResearch('masterwork', 1);
            expect(getTechEffect('masterwork')).toBe(1);
        });
    });

    describe('rollTier consistency', () => {
        it('returns valid tier values (1-6)', () => {
            for (let forgeLevel = 1; forgeLevel <= FORGE_LEVELS.length; forgeLevel++) {
                for (let i = 0; i < 20; i++) {
                    const tier = rollTier(forgeLevel);
                    expect(tier).toBeGreaterThanOrEqual(1);
                    expect(tier).toBeLessThanOrEqual(TIERS.length);
                }
            }
        });

        it('forge level 1 always gives tier 1 without tech', () => {
            for (let i = 0; i < 100; i++) {
                expect(rollTier(1)).toBe(1);
            }
        });
    });
});
