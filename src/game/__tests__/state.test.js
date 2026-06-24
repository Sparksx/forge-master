import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../api.js', () => ({
    apiFetch: vi.fn(() => Promise.resolve({ ok: true })),
    getAccessToken: vi.fn(() => null),
}));

import {
    getGold, getForgeLevel, getArenaRank, getHighestArenaRank,
    getPlayerLevel, getAvatar, getForgeLuckPct, getGoldBonusPct,
    getPlayerLevelProgress, getForgeLevelProgress,
    getBestLevelForSlot, recordForgedLevel,
    grantForgeXp, grantPlayerXp, grantGold, spendGold, addGold,
    equipItem, setArenaRank, setClanPerks, resetProgress,
    getForgeUpgradeCost, upgradeForge, getEquipment, getEquippedItem,
} from '../state.js';
import { STARTING_GOLD } from '../config.js';
import { gameEvents, EVENTS } from '../../events.js';

beforeEach(() => {
    resetProgress();
});

// ── Default state ────────────────────────────────────────────────────────────

describe('default state after reset', () => {
    it('starts with STARTING_GOLD', () => {
        expect(getGold()).toBe(STARTING_GOLD);
    });

    it('starts at forge level 1', () => {
        expect(getForgeLevel()).toBe(1);
    });

    it('starts at arena rank 1', () => {
        expect(getArenaRank()).toBe(1);
        expect(getHighestArenaRank()).toBe(1);
    });

    it('starts at player level 1', () => {
        expect(getPlayerLevel()).toBe(1);
    });

    it('starts with wizard avatar', () => {
        expect(getAvatar()).toBe('wizard');
    });

    it('starts with zero clan perks', () => {
        expect(getForgeLuckPct()).toBe(0);
        expect(getGoldBonusPct()).toBe(0);
    });

    it('starts with all equipment slots empty', () => {
        const equip = getEquipment();
        for (const item of Object.values(equip)) {
            expect(item).toBeNull();
        }
    });
});

// ── Gold ─────────────────────────────────────────────────────────────────────

describe('gold operations', () => {
    it('grantGold adds gold and returns the amount', () => {
        const granted = grantGold(50);
        expect(granted).toBe(50);
        expect(getGold()).toBe(STARTING_GOLD + 50);
    });

    it('grantGold applies clan gold bonus', () => {
        setClanPerks({ goldBonusPct: 100, forgeLuckPct: 0 });
        const granted = grantGold(50);
        expect(granted).toBe(100);
        expect(getGold()).toBe(STARTING_GOLD + 100);
    });

    it('spendGold deducts and returns true when affordable', () => {
        expect(spendGold(50)).toBe(true);
        expect(getGold()).toBe(STARTING_GOLD - 50);
    });

    it('spendGold returns false when insufficient', () => {
        expect(spendGold(STARTING_GOLD + 1)).toBe(false);
        expect(getGold()).toBe(STARTING_GOLD);
    });

    it('addGold adjusts balance directly (admin helper)', () => {
        addGold(200);
        expect(getGold()).toBe(STARTING_GOLD + 200);
    });

    it('addGold floors to zero on negative overshoot', () => {
        addGold(-99999);
        expect(getGold()).toBe(0);
    });
});

// ── Equipment ────────────────────────────────────────────────────────────────

describe('equipment', () => {
    it('equipItem places an item in its slot', () => {
        const sword = { type: 'weapon', level: 5, tier: 3 };
        equipItem(sword);
        expect(getEquippedItem('weapon')).toBe(sword);
    });

    it('equipItem overwrites existing item in the slot', () => {
        const old = { type: 'weapon', level: 1, tier: 1 };
        const upgrade = { type: 'weapon', level: 10, tier: 5 };
        equipItem(old);
        equipItem(upgrade);
        expect(getEquippedItem('weapon')).toBe(upgrade);
    });

    it('emits ITEM_EQUIPPED event', () => {
        const spy = vi.fn();
        gameEvents.on(EVENTS.ITEM_EQUIPPED, spy);
        const item = { type: 'armor', level: 3, tier: 2 };
        equipItem(item);
        expect(spy).toHaveBeenCalledWith(item);
        gameEvents.off(EVENTS.ITEM_EQUIPPED, spy);
    });
});

// ── Arena rank ───────────────────────────────────────────────────────────────

describe('arena rank', () => {
    it('setArenaRank updates rank', () => {
        setArenaRank(5);
        expect(getArenaRank()).toBe(5);
    });

    it('tracks highest arena rank', () => {
        setArenaRank(10);
        setArenaRank(3);
        expect(getArenaRank()).toBe(3);
        expect(getHighestArenaRank()).toBe(10);
    });

    it('clamps rank to minimum 1', () => {
        setArenaRank(-5);
        expect(getArenaRank()).toBe(1);
    });
});

// ── Forge XP ─────────────────────────────────────────────────────────────────

describe('forge XP and leveling', () => {
    it('grantForgeXp does nothing for zero/negative amounts', () => {
        grantForgeXp(0);
        expect(getForgeLevel()).toBe(1);
        grantForgeXp(-10);
        expect(getForgeLevel()).toBe(1);
    });

    it('grantForgeXp accumulates toward the next level', () => {
        grantForgeXp(1);
        const progress = getForgeLevelProgress();
        expect(progress.xp).toBeGreaterThan(0);
        expect(progress.level).toBe(1);
    });

    it('grantForgeXp auto-levels the forge when XP threshold is met', () => {
        grantForgeXp(999999);
        expect(getForgeLevel()).toBeGreaterThan(1);
    });

    it('grantForgeXp returns true when a level was gained', () => {
        const leveled = grantForgeXp(999999);
        expect(leveled).toBe(true);
    });

    it('getForgeLevelProgress reports maxed at max level', () => {
        for (let i = 0; i < 50; i++) grantForgeXp(9999999);
        const progress = getForgeLevelProgress();
        expect(progress.maxed).toBe(true);
        expect(progress.pct).toBe(1);
    });
});

// ── Player XP ────────────────────────────────────────────────────────────────

describe('player XP and leveling', () => {
    it('grantPlayerXp does nothing for zero/negative amounts', () => {
        grantPlayerXp(0);
        expect(getPlayerLevel()).toBe(1);
    });

    it('grantPlayerXp accumulates toward the next level', () => {
        grantPlayerXp(1);
        const progress = getPlayerLevelProgress();
        expect(progress.xp).toBeGreaterThan(0);
        expect(progress.level).toBe(1);
    });

    it('grantPlayerXp auto-levels the player when XP threshold is met', () => {
        grantPlayerXp(9999999);
        expect(getPlayerLevel()).toBeGreaterThan(1);
    });

    it('emits PLAYER_LEVEL_UP when leveling', () => {
        const spy = vi.fn();
        gameEvents.on(EVENTS.PLAYER_LEVEL_UP, spy);
        grantPlayerXp(9999999);
        expect(spy).toHaveBeenCalled();
        gameEvents.off(EVENTS.PLAYER_LEVEL_UP, spy);
    });

    it('getPlayerLevelProgress reports correct structure', () => {
        const p = getPlayerLevelProgress();
        expect(p).toHaveProperty('level');
        expect(p).toHaveProperty('xp');
        expect(p).toHaveProperty('need');
        expect(p).toHaveProperty('pct');
        expect(p).toHaveProperty('maxed');
        expect(p.pct).toBeGreaterThanOrEqual(0);
        expect(p.pct).toBeLessThanOrEqual(1);
    });
});

// ── Best levels tracking ─────────────────────────────────────────────────────

describe('best level tracking', () => {
    it('returns null for unrecorded slot/tier combos', () => {
        expect(getBestLevelForSlot('weapon', 3)).toBeNull();
    });

    it('recordForgedLevel tracks the best', () => {
        recordForgedLevel('weapon', 3, 10);
        expect(getBestLevelForSlot('weapon', 3)).toBe(10);
    });

    it('only updates if the new level is higher', () => {
        recordForgedLevel('weapon', 3, 20);
        recordForgedLevel('weapon', 3, 5);
        expect(getBestLevelForSlot('weapon', 3)).toBe(20);
    });

    it('tracks different slots independently', () => {
        recordForgedLevel('weapon', 1, 10);
        recordForgedLevel('armor', 1, 25);
        expect(getBestLevelForSlot('weapon', 1)).toBe(10);
        expect(getBestLevelForSlot('armor', 1)).toBe(25);
    });
});

// ── Clan perks ───────────────────────────────────────────────────────────────

describe('clan perks', () => {
    it('setClanPerks updates perk getters', () => {
        setClanPerks({ goldBonusPct: 15, forgeLuckPct: 8 });
        expect(getGoldBonusPct()).toBe(15);
        expect(getForgeLuckPct()).toBe(8);
    });

    it('setClanPerks handles null/undefined gracefully', () => {
        setClanPerks(null);
        expect(getGoldBonusPct()).toBe(0);
        expect(getForgeLuckPct()).toBe(0);
    });
});

// ── Forge upgrade (gold shortcut) ────────────────────────────────────────────

describe('forge upgrade via gold', () => {
    it('getForgeUpgradeCost returns the next level cost', () => {
        const cost = getForgeUpgradeCost();
        expect(typeof cost).toBe('number');
        expect(cost).toBeGreaterThanOrEqual(0);
    });

    it('upgradeForge fails when gold is insufficient', () => {
        resetProgress();
        const cost = getForgeUpgradeCost();
        if (cost > STARTING_GOLD) {
            expect(upgradeForge()).toBe(false);
            expect(getForgeLevel()).toBe(1);
        }
    });

    it('upgradeForge succeeds when gold is sufficient', () => {
        addGold(999999);
        const before = getForgeLevel();
        const result = upgradeForge();
        expect(result).toBe(true);
        expect(getForgeLevel()).toBe(before + 1);
    });

    it('upgradeForge deducts the cost from gold', () => {
        addGold(999999);
        const goldBefore = getGold();
        const cost = getForgeUpgradeCost();
        upgradeForge();
        expect(getGold()).toBe(goldBefore - cost);
    });
});
