import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
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

// Import after mocking
const {
    getEquipment, getGold, equipItem, sellForgedItem, setForgedItem, getForgedItem,
    saveGame, loadGame, resetGame, getForgeLevel, getSellValue, getForgeUpgradeCost,
    upgradeForge, startForgeUpgrade, getForgeUpgradeStatus, getForgeUpgradeState,
    speedUpForgeUpgrade, checkForgeUpgradeComplete, addGold, getHighestLevelForTier,
    getHighestLevelForSlot, trackForgedLevel
} = await import('../state.js');
const { createItem, calculateItemStats, forgeEquipment } = await import('../forge.js');
const { INITIAL_LEVEL_MAX, LEVEL_RANGE, MAX_LEVEL } = await import('../config.js');

describe('state', () => {
    beforeEach(() => {
        localStorageMock.clear();
        localStorageMock.getItem.mockClear();
        localStorageMock.setItem.mockClear();
        resetGame();
    });

    describe('equipItem', () => {
        it('equips an item to the correct slot', () => {
            const item = createItem('hat', 10, 1);
            setForgedItem(item);
            equipItem(item);

            const equipment = getEquipment();
            expect(equipment.hat).toEqual(item);
        });

        it('clears forgedItem after equipping', () => {
            const item = createItem('weapon', 5, 1);
            setForgedItem(item);
            equipItem(item);

            expect(getForgedItem()).toBeNull();
        });

        it('saves game after equipping', () => {
            const item = createItem('armor', 3, 1);
            equipItem(item);

            expect(localStorageMock.setItem).toHaveBeenCalled();
        });
    });

    describe('getSellValue', () => {
        it('returns level * tier for sell value', () => {
            const item = createItem('ring', 15, 3);
            expect(getSellValue(item)).toBe(15 * 3);
        });

        it('returns level * 1 for tier 1 items', () => {
            const item = createItem('hat', 50, 1);
            expect(getSellValue(item)).toBe(50);
        });

        it('handles items without tier (defaults to 1)', () => {
            const item = { level: 20 };
            expect(getSellValue(item)).toBe(20);
        });
    });

    describe('sellForgedItem', () => {
        it('returns gold equal to level * tier', () => {
            const item = createItem('ring', 15, 3);
            setForgedItem(item);

            const earned = sellForgedItem();
            expect(earned).toBe(15 * 3);
        });

        it('adds gold to total', () => {
            const item1 = createItem('hat', 10, 1);
            setForgedItem(item1);
            sellForgedItem();

            const item2 = createItem('weapon', 20, 2);
            setForgedItem(item2);
            sellForgedItem();

            expect(getGold()).toBe(10 + 40);
        });

        it('clears forgedItem after selling', () => {
            const item = createItem('boots', 5, 1);
            setForgedItem(item);
            sellForgedItem();

            expect(getForgedItem()).toBeNull();
        });

        it('returns 0 if no forged item', () => {
            expect(sellForgedItem()).toBe(0);
        });
    });

    describe('equipItem gold from old item', () => {
        it('earns gold from replacing old item', () => {
            const oldItem = createItem('hat', 20, 2);
            equipItem(oldItem);

            const newItem = createItem('hat', 30, 1);
            setForgedItem(newItem);
            equipItem(newItem);

            // Old item: level 20 * tier 2 = 40 gold
            expect(getGold()).toBe(40);
        });
    });

    describe('forgeLevel', () => {
        it('starts at level 1', () => {
            expect(getForgeLevel()).toBe(1);
        });

        it('returns upgrade cost for next level', () => {
            expect(getForgeUpgradeCost()).toBe(200);
        });

        it('starts timed upgrade when enough gold', () => {
            addGold(400);
            const result = startForgeUpgrade();
            expect(result).toBe(true);
            // Level 2 has time=60, so it starts an upgrade timer
            expect(getForgeUpgradeState()).not.toBeNull();
            expect(getForgeUpgradeState().targetLevel).toBe(2);
            expect(getGold()).toBe(200); // 400 - 200
        });

        it('fails to start upgrade when not enough gold', () => {
            const result = startForgeUpgrade();
            expect(result).toBe(false);
            expect(getForgeLevel()).toBe(1);
            expect(getForgeUpgradeState()).toBeNull();
        });

        it('fails to start upgrade when already upgrading', () => {
            addGold(1000);
            startForgeUpgrade();
            const result = startForgeUpgrade();
            expect(result).toBe(false);
        });

        it('completes upgrade when time has passed', () => {
            addGold(400);
            startForgeUpgrade();
            // Simulate time passing by modifying startedAt
            const upgrade = getForgeUpgradeState();
            upgrade.startedAt = Date.now() - (upgrade.duration * 1000 + 1000);
            const completed = checkForgeUpgradeComplete();
            expect(completed).toBe(true);
            expect(getForgeLevel()).toBe(2);
            expect(getForgeUpgradeState()).toBeNull();
        });

        it('speed up completes upgrade instantly', () => {
            addGold(1000);
            startForgeUpgrade(); // costs 200, leaves 800
            const status = getForgeUpgradeStatus();
            expect(status).not.toBeNull();
            // Speed up costs remaining time * 2 gold/sec
            const result = speedUpForgeUpgrade();
            expect(result).toBe(true);
            expect(getForgeLevel()).toBe(2);
            expect(getForgeUpgradeState()).toBeNull();
        });

        it('speed up fails when not enough gold', () => {
            addGold(200); // just enough for upgrade cost
            startForgeUpgrade();
            const result = speedUpForgeUpgrade();
            expect(result).toBe(false);
            expect(getForgeLevel()).toBe(1);
        });

        it('resets forge level and upgrade on resetGame', () => {
            addGold(400);
            startForgeUpgrade();
            expect(getForgeUpgradeState()).not.toBeNull();

            resetGame();
            expect(getForgeLevel()).toBe(1);
            expect(getForgeUpgradeState()).toBeNull();
        });
    });

    describe('getHighestLevelForTier', () => {
        it('returns null when no equipment of that tier exists', () => {
            expect(getHighestLevelForTier(1)).toBeNull();
        });

        it('returns the level of the only equipped item of that tier', () => {
            equipItem(createItem('hat', 30, 2));
            expect(getHighestLevelForTier(2)).toBe(30);
        });

        it('returns the highest level among multiple items of the same tier', () => {
            equipItem(createItem('hat', 20, 1));
            equipItem(createItem('armor', 50, 1));
            equipItem(createItem('weapon', 35, 1));
            expect(getHighestLevelForTier(1)).toBe(50);
        });

        it('ignores items of different tiers', () => {
            equipItem(createItem('hat', 90, 1));
            equipItem(createItem('armor', 30, 2));
            expect(getHighestLevelForTier(2)).toBe(30);
            expect(getHighestLevelForTier(1)).toBe(90);
            expect(getHighestLevelForTier(3)).toBeNull();
        });
    });

    describe('getHighestLevelForSlot (per-slot forge tracker)', () => {
        it('returns null when no item of that slot+tier has been forged', () => {
            expect(getHighestLevelForSlot('hat', 1)).toBeNull();
        });

        it('tracks the highest level forged per slot and tier', () => {
            trackForgedLevel('hat', 1, 20);
            trackForgedLevel('hat', 1, 35);
            trackForgedLevel('hat', 1, 10); // lower, should not replace
            expect(getHighestLevelForSlot('hat', 1)).toBe(35);
        });

        it('tracks independently per slot', () => {
            trackForgedLevel('hat', 1, 50);
            trackForgedLevel('weapon', 1, 20);
            expect(getHighestLevelForSlot('hat', 1)).toBe(50);
            expect(getHighestLevelForSlot('weapon', 1)).toBe(20);
        });

        it('tracks independently per tier', () => {
            trackForgedLevel('hat', 1, 80);
            trackForgedLevel('hat', 2, 10);
            expect(getHighestLevelForSlot('hat', 1)).toBe(80);
            expect(getHighestLevelForSlot('hat', 2)).toBe(10);
            expect(getHighestLevelForSlot('hat', 3)).toBeNull();
        });

        it('resets on resetGame', () => {
            trackForgedLevel('hat', 1, 50);
            expect(getHighestLevelForSlot('hat', 1)).toBe(50);
            resetGame();
            expect(getHighestLevelForSlot('hat', 1)).toBeNull();
        });
    });

    describe('loadGame', () => {
        it('loads valid save data with tier and bonuses', () => {
            const saveData = JSON.stringify({
                equipment: {
                    hat: {
                        type: 'hat', level: 10, tier: 3, stats: 500, statType: 'health',
                        bonuses: [{ type: 'critChance', value: 5 }]
                    },
                    armor: null, belt: null, boots: null,
                    gloves: null, necklace: null, ring: null, weapon: null,
                },
                gold: 100,
                forgeLevel: 5,
            });
            localStorageMock.getItem.mockReturnValueOnce(saveData);
            loadGame();

            expect(getEquipment().hat.level).toBe(10);
            expect(getEquipment().hat.tier).toBe(3);
            expect(getEquipment().hat.bonuses).toEqual([{ type: 'critChance', value: 5 }]);
            expect(getGold()).toBe(100);
            expect(getForgeLevel()).toBe(5);
        });

        it('migrates old format items (bonusType/bonusValue) to new format', () => {
            const saveData = JSON.stringify({
                equipment: {
                    hat: { type: 'hat', level: 10, stats: 50, statType: 'health', bonusType: 'critChance', bonusValue: 5 },
                    armor: null, belt: null, boots: null,
                    gloves: null, necklace: null, ring: null, weapon: null,
                },
                gold: 50,
            });
            localStorageMock.getItem.mockReturnValueOnce(saveData);
            loadGame();

            const hat = getEquipment().hat;
            expect(hat.tier).toBe(2);
            expect(hat.bonuses).toEqual([{ type: 'critChance', value: 5 }]);
            expect(hat.bonusType).toBeUndefined();
            expect(hat.bonusValue).toBeUndefined();
            // Stats recalculated with new formula
            expect(hat.stats).toBe(calculateItemStats(10, 2, true));
        });

        it('migrates old items without bonus to tier 1', () => {
            const saveData = JSON.stringify({
                equipment: {
                    hat: { type: 'hat', level: 10, stats: 50, statType: 'health' },
                },
                gold: 0,
            });
            localStorageMock.getItem.mockReturnValueOnce(saveData);
            loadGame();

            const hat = getEquipment().hat;
            expect(hat.tier).toBe(1);
            expect(hat.bonuses).toEqual([]);
        });

        it('defaults forgeLevel to 1 if not in save', () => {
            const saveData = JSON.stringify({
                equipment: {},
                gold: 0,
            });
            localStorageMock.getItem.mockReturnValueOnce(saveData);
            loadGame();

            expect(getForgeLevel()).toBe(1);
        });

        it('rejects items with invalid level', () => {
            const saveData = JSON.stringify({
                equipment: {
                    hat: { type: 'hat', level: -5, stats: 50, statType: 'health' },
                },
                gold: 0,
            });
            localStorageMock.getItem.mockReturnValueOnce(saveData);
            loadGame();

            expect(getEquipment().hat).toBeNull();
        });

        it('rejects items with invalid statType', () => {
            const saveData = JSON.stringify({
                equipment: {
                    hat: { type: 'hat', level: 10, stats: 50, statType: 'mana' },
                },
                gold: 0,
            });
            localStorageMock.getItem.mockReturnValueOnce(saveData);
            loadGame();

            expect(getEquipment().hat).toBeNull();
        });

        it('rejects items with missing properties', () => {
            const saveData = JSON.stringify({
                equipment: {
                    hat: { type: 'hat' },
                },
                gold: 0,
            });
            localStorageMock.getItem.mockReturnValueOnce(saveData);
            loadGame();

            expect(getEquipment().hat).toBeNull();
        });

        it('rejects negative gold', () => {
            const saveData = JSON.stringify({
                equipment: {},
                gold: -50,
            });
            localStorageMock.getItem.mockReturnValueOnce(saveData);
            loadGame();

            expect(getGold()).toBe(0);
        });

        it('handles corrupted JSON gracefully', () => {
            localStorageMock.getItem.mockReturnValueOnce('not valid json{{{');
            expect(() => loadGame()).not.toThrow();
        });

        it('handles null localStorage gracefully', () => {
            localStorageMock.getItem.mockReturnValueOnce(null);
            expect(() => loadGame()).not.toThrow();
        });
    });

    describe('forgeEquipment level calculation', () => {
        it('uses initial level range when no item of that slot+tier has been forged', () => {
            // Track a high-level tier 1 hat
            trackForgedLevel('hat', 1, 90);

            // Forge many items — items of a different type or tier should use initial range
            for (let i = 0; i < 50; i++) {
                const item = forgeEquipment()[0];
                if (item.tier !== 1 || item.type !== 'hat') {
                    // If this specific (type,tier) hasn't been forged before, it should
                    // use initial range OR use its own tracker (from previous iterations)
                    const tracked = getHighestLevelForSlot(item.type, item.tier);
                    if (tracked === null) {
                        expect(item.level).toBeGreaterThanOrEqual(1);
                        expect(item.level).toBeLessThanOrEqual(INITIAL_LEVEL_MAX);
                    }
                }
            }
        });

        it('uses per-slot tracker for level range', () => {
            // Set up tracked levels for specific slots
            trackForgedLevel('hat', 1, 80);
            trackForgedLevel('weapon', 1, 30);

            for (let i = 0; i < 200; i++) {
                const item = forgeEquipment()[0];
                if (item.tier === 1 && item.type === 'hat') {
                    // Should be based on hat tier 1 tracker (80), so range [70, 90]
                    const tracked = getHighestLevelForSlot('hat', 1);
                    const minExpected = Math.max(1, tracked - LEVEL_RANGE);
                    const maxExpected = Math.min(MAX_LEVEL, tracked + LEVEL_RANGE);
                    expect(item.level).toBeGreaterThanOrEqual(minExpected);
                    expect(item.level).toBeLessThanOrEqual(maxExpected);
                } else if (item.tier === 1 && item.type === 'weapon') {
                    // Should be based on weapon tier 1 tracker (30), so range [20, 40]
                    const tracked = getHighestLevelForSlot('weapon', 1);
                    const minExpected = Math.max(1, tracked - LEVEL_RANGE);
                    const maxExpected = Math.min(MAX_LEVEL, tracked + LEVEL_RANGE);
                    expect(item.level).toBeGreaterThanOrEqual(minExpected);
                    expect(item.level).toBeLessThanOrEqual(maxExpected);
                }
            }
        });

        it('does not inherit level from different tier', () => {
            // Track only a high-level tier 1 hat
            trackForgedLevel('hat', 1, 95);

            // All items of other tiers should start at initial range, not near 95
            for (let i = 0; i < 50; i++) {
                const item = forgeEquipment()[0];
                if (item.tier > 1) {
                    const tracked = getHighestLevelForSlot(item.type, item.tier);
                    if (tracked === null) {
                        expect(item.level).toBeLessThanOrEqual(INITIAL_LEVEL_MAX);
                    }
                }
            }
        });

        it('each slot progresses independently through levels per tier', () => {
            // Track hat at level 90 tier 1, weapon should still start low
            trackForgedLevel('hat', 1, 90);
            // weapon tier 1 has no tracking

            for (let i = 0; i < 50; i++) {
                const item = forgeEquipment()[0];
                if (item.tier === 1 && item.type === 'weapon') {
                    const tracked = getHighestLevelForSlot('weapon', 1);
                    if (tracked === null) {
                        // First weapon forge should be in initial range
                        expect(item.level).toBeLessThanOrEqual(INITIAL_LEVEL_MAX);
                        break; // only need to verify once
                    }
                }
            }
        });
    });
});
