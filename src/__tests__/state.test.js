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
    saveGame, loadGame, resetGame, getForgeLevel, getSellValue, getForgeUpgradeCost, upgradeForge
} = await import('../state.js');
const { createItem, calculateItemStats } = await import('../forge.js');

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

        it('upgrades forge when enough gold', () => {
            // Give gold by selling items
            const item = createItem('hat', 100, 3);
            setForgedItem(item);
            sellForgedItem(); // 100 * 3 = 300 gold

            const result = upgradeForge();
            expect(result).toBe(true);
            expect(getForgeLevel()).toBe(2);
            expect(getGold()).toBe(100); // 300 - 200
        });

        it('fails to upgrade when not enough gold', () => {
            const result = upgradeForge();
            expect(result).toBe(false);
            expect(getForgeLevel()).toBe(1);
        });

        it('resets forge level on resetGame', () => {
            const item = createItem('hat', 100, 3);
            setForgedItem(item);
            sellForgedItem();
            upgradeForge();
            expect(getForgeLevel()).toBe(2);

            resetGame();
            expect(getForgeLevel()).toBe(1);
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
});
