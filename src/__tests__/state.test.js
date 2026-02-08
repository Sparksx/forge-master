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
const { getEquipment, getGold, equipItem, sellForgedItem, setForgedItem, getForgedItem, saveGame, loadGame, resetGame } = await import('../state.js');
const { createItem } = await import('../forge.js');

describe('state', () => {
    beforeEach(() => {
        localStorageMock.clear();
        localStorageMock.getItem.mockClear();
        localStorageMock.setItem.mockClear();
        resetGame();
    });

    describe('equipItem', () => {
        it('equips an item to the correct slot', () => {
            const item = createItem('hat', 10);
            setForgedItem(item);
            equipItem(item);

            const equipment = getEquipment();
            expect(equipment.hat).toEqual(item);
        });

        it('clears forgedItem after equipping', () => {
            const item = createItem('weapon', 5);
            setForgedItem(item);
            equipItem(item);

            expect(getForgedItem()).toBeNull();
        });

        it('saves game after equipping', () => {
            const item = createItem('armor', 3);
            equipItem(item);

            expect(localStorageMock.setItem).toHaveBeenCalled();
        });
    });

    describe('sellForgedItem', () => {
        it('returns gold equal to item level', () => {
            const item = createItem('ring', 15);
            setForgedItem(item);

            const earned = sellForgedItem();
            expect(earned).toBe(15);
        });

        it('adds gold to total', () => {
            const item1 = createItem('hat', 10);
            setForgedItem(item1);
            sellForgedItem();

            const item2 = createItem('weapon', 20);
            setForgedItem(item2);
            sellForgedItem();

            expect(getGold()).toBe(30);
        });

        it('clears forgedItem after selling', () => {
            const item = createItem('boots', 5);
            setForgedItem(item);
            sellForgedItem();

            expect(getForgedItem()).toBeNull();
        });

        it('returns 0 if no forged item', () => {
            expect(sellForgedItem()).toBe(0);
        });
    });

    describe('loadGame', () => {
        it('loads valid save data', () => {
            const saveData = JSON.stringify({
                equipment: {
                    hat: { type: 'hat', level: 10, stats: 50, statType: 'health' },
                    armor: null, belt: null, boots: null,
                    gloves: null, necklace: null, ring: null, weapon: null,
                },
                gold: 100,
            });
            localStorageMock.getItem.mockReturnValueOnce(saveData);
            loadGame();

            expect(getEquipment().hat.level).toBe(10);
            expect(getGold()).toBe(100);
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
