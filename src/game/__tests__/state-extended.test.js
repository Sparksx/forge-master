import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../api.js', () => ({
    apiFetch: vi.fn(() => Promise.resolve({ ok: true })),
    getAccessToken: vi.fn(() => null),
}));

import {
    getGold, getEquipment, getEquippedItem, getForgeLevel,
    getArenaRank, getHighestArenaRank, getPlayerLevel, getAvatar,
    getFrame, getOwnedCosmetics, getGoldBonusPct, getStatBonusPct,
    getForgeSpeedPct, getForgeBestOf,
    getCombatStats, getPowerScore, getPowerBreakdown,
    equipItem, trashItem, resetProgress,
    grantGold, spendGold, addGold, creditServerGold,
    setClanPerks, grantPlayerXp, setArenaRank,
    ownsCosmetic, getPlayerLevelProgress, getForgeLevelProgress,
    save, loadLocal,
} from '../state.js';
import { STARTING_GOLD, SAVE_KEY } from '../config.js';
import { BASE_HEALTH, BASE_DAMAGE } from '../../../shared/stats.js';
import { gameEvents, EVENTS } from '../../events.js';

beforeEach(() => {
    resetProgress();
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMockItem(overrides = {}) {
    return {
        type: 'weapon',
        tier: 3,
        level: 10,
        stats: 50,
        statType: 'damage',
        bonuses: [],
        name: 'Test Sword',
        ...overrides,
    };
}

function makeHealthItem(overrides = {}) {
    return makeMockItem({ type: 'armor', statType: 'health', name: 'Test Armor', ...overrides });
}

// ── trashItem ───────────────────────────────────────────────────────────────

describe('trashItem', () => {
    it('emits ITEM_TRASHED event with the item', () => {
        const spy = vi.fn();
        gameEvents.on(EVENTS.ITEM_TRASHED, spy);
        const item = makeMockItem();
        trashItem(item);
        expect(spy).toHaveBeenCalledWith({ item });
        gameEvents.off(EVENTS.ITEM_TRASHED, spy);
    });

    it('emits STATE_CHANGED event', () => {
        const spy = vi.fn();
        gameEvents.on(EVENTS.STATE_CHANGED, spy);
        trashItem(makeMockItem());
        expect(spy).toHaveBeenCalled();
        gameEvents.off(EVENTS.STATE_CHANGED, spy);
    });

    it('does not crash when called with a null item', () => {
        expect(() => trashItem(null)).not.toThrow();
    });

    it('does not crash when called with an empty-slot item', () => {
        expect(() => trashItem(undefined)).not.toThrow();
    });

    it('does not affect other equipped items', () => {
        const weapon = makeMockItem();
        const armor = makeHealthItem();
        equipItem(weapon);
        equipItem(armor);
        trashItem(weapon);
        // trashItem emits events but does not modify equipment state directly
        expect(getEquippedItem('armor')).toBe(armor);
    });
});

// ── getCombatStats ──────────────────────────────────────────────────────────

describe('getCombatStats', () => {
    it('returns base stats for a fresh player with no equipment', () => {
        const stats = getCombatStats();
        expect(stats).toHaveProperty('maxHP');
        expect(stats).toHaveProperty('damage');
        expect(stats).toHaveProperty('critChance');
        expect(stats).toHaveProperty('critMultiplier');
        expect(stats).toHaveProperty('healthRegen');
        expect(stats).toHaveProperty('lifeSteal');
        expect(stats).toHaveProperty('attackSpeed');
        expect(stats).toHaveProperty('doubleHit');
        expect(stats).toHaveProperty('damageReduction');
        expect(stats).toHaveProperty('reflect');
        expect(stats).toHaveProperty('execute');
        expect(stats).toHaveProperty('ranged');
    });

    it('has correct base HP and damage at level 1 with no gear', () => {
        const stats = getCombatStats();
        expect(stats.maxHP).toBe(BASE_HEALTH);
        expect(stats.damage).toBe(BASE_DAMAGE);
    });

    it('all bonus stats are zero with no equipment', () => {
        const stats = getCombatStats();
        expect(stats.critChance).toBe(0);
        expect(stats.critMultiplier).toBe(0);
        expect(stats.healthRegen).toBe(0);
        expect(stats.lifeSteal).toBe(0);
        expect(stats.attackSpeed).toBe(0);
        expect(stats.doubleHit).toBe(0);
        expect(stats.damageReduction).toBe(0);
        expect(stats.reflect).toBe(0);
        expect(stats.execute).toBe(0);
        expect(stats.ranged).toBe(false);
    });

    it('increases damage when a weapon is equipped', () => {
        const baseDamage = getCombatStats().damage;
        equipItem(makeMockItem({ type: 'weapon', tier: 3, level: 10 }));
        const newDamage = getCombatStats().damage;
        expect(newDamage).toBeGreaterThan(baseDamage);
    });

    it('increases HP when a health-slot item is equipped', () => {
        const baseHP = getCombatStats().maxHP;
        equipItem(makeHealthItem({ type: 'armor', tier: 3, level: 10 }));
        const newHP = getCombatStats().maxHP;
        expect(newHP).toBeGreaterThan(baseHP);
    });

    it('reflects bonuses from equipped items', () => {
        equipItem(makeMockItem({
            type: 'weapon',
            tier: 3,
            level: 10,
            bonuses: [{ type: 'critChance', value: 15 }],
        }));
        const stats = getCombatStats();
        expect(stats.critChance).toBe(15);
    });

    it('increases stats when player levels up', () => {
        const statsAtLevel1 = getCombatStats();
        grantPlayerXp(9999999);
        const statsLeveled = getCombatStats();
        expect(statsLeveled.maxHP).toBeGreaterThan(statsAtLevel1.maxHP);
        expect(statsLeveled.damage).toBeGreaterThan(statsAtLevel1.damage);
    });

    it('applies clan stat bonus perk', () => {
        const baseStats = getCombatStats();
        setClanPerks({ statBonusPct: 50 });
        const boostedStats = getCombatStats();
        expect(boostedStats.maxHP).toBeGreaterThan(baseStats.maxHP);
        expect(boostedStats.damage).toBeGreaterThan(baseStats.damage);
        setClanPerks(null);
    });

    it('reports ranged style when weapon has ranged attackStyle', () => {
        equipItem(makeMockItem({ type: 'weapon', attackStyle: 'ranged' }));
        expect(getCombatStats().ranged).toBe(true);
    });

    it('reports melee style by default', () => {
        equipItem(makeMockItem({ type: 'weapon', attackStyle: 'melee' }));
        expect(getCombatStats().ranged).toBe(false);
    });
});

// ── getPowerScore ───────────────────────────────────────────────────────────

describe('getPowerScore', () => {
    it('returns a positive number for a fresh player', () => {
        const power = getPowerScore();
        expect(typeof power).toBe('number');
        expect(power).toBeGreaterThan(0);
    });

    it('increases when gear is equipped', () => {
        const basePower = getPowerScore();
        equipItem(makeMockItem({ type: 'weapon', tier: 5, level: 20 }));
        expect(getPowerScore()).toBeGreaterThan(basePower);
    });

    it('increases when player levels up', () => {
        const basePower = getPowerScore();
        grantPlayerXp(9999999);
        expect(getPowerScore()).toBeGreaterThan(basePower);
    });

    it('increases with clan stat bonus perk', () => {
        const basePower = getPowerScore();
        setClanPerks({ statBonusPct: 25 });
        expect(getPowerScore()).toBeGreaterThan(basePower);
        setClanPerks(null);
    });

    it('returns zero-gear power consistent with base stats', () => {
        // No gear: power should equal base health + base damage from level 1
        const power = getPowerScore();
        expect(power).toBe(BASE_HEALTH + BASE_DAMAGE);
    });

    it('accounts for multiple equipped items', () => {
        equipItem(makeMockItem({ type: 'weapon', tier: 3, level: 10 }));
        const oneItemPower = getPowerScore();
        equipItem(makeHealthItem({ type: 'armor', tier: 3, level: 10 }));
        const twoItemPower = getPowerScore();
        expect(twoItemPower).toBeGreaterThan(oneItemPower);
    });
});

// ── getPowerBreakdown ───────────────────────────────────────────────────────

describe('getPowerBreakdown', () => {
    it('returns an object with the expected shape', () => {
        const bd = getPowerBreakdown();
        expect(bd).toHaveProperty('playerLevel');
        expect(bd).toHaveProperty('statBonusPct');
        expect(bd).toHaveProperty('clanMult');
        expect(bd).toHaveProperty('baseHealth');
        expect(bd).toHaveProperty('baseDamage');
        expect(bd).toHaveProperty('gearHealth');
        expect(bd).toHaveProperty('gearDamage');
        expect(bd).toHaveProperty('gearPower');
        expect(bd).toHaveProperty('subtotal');
        expect(bd).toHaveProperty('total');
        expect(bd).toHaveProperty('rows');
    });

    it('total equals getPowerScore for the same state', () => {
        const power = getPowerScore();
        const bd = getPowerBreakdown();
        expect(bd.total).toBe(power);
    });

    it('total equals getPowerScore with gear equipped', () => {
        equipItem(makeMockItem({ type: 'weapon', tier: 4, level: 15 }));
        equipItem(makeHealthItem({ type: 'armor', tier: 3, level: 10 }));
        const power = getPowerScore();
        const bd = getPowerBreakdown();
        expect(bd.total).toBe(power);
    });

    it('total equals getPowerScore with clan bonus', () => {
        setClanPerks({ statBonusPct: 30 });
        equipItem(makeMockItem({ type: 'weapon', tier: 3, level: 10 }));
        const power = getPowerScore();
        const bd = getPowerBreakdown();
        expect(bd.total).toBe(power);
        setClanPerks(null);
    });

    it('reports zero gear stats with no equipment', () => {
        const bd = getPowerBreakdown();
        expect(bd.gearHealth).toBe(0);
        expect(bd.gearDamage).toBe(0);
        expect(bd.gearPower).toBe(0);
    });

    it('reports playerLevel matching the current state', () => {
        expect(getPowerBreakdown().playerLevel).toBe(1);
        grantPlayerXp(9999999);
        expect(getPowerBreakdown().playerLevel).toBeGreaterThan(1);
    });

    it('reports clan multiplier correctly', () => {
        expect(getPowerBreakdown().clanMult).toBe(1);
        setClanPerks({ statBonusPct: 50 });
        expect(getPowerBreakdown().clanMult).toBe(1.5);
        setClanPerks(null);
    });

    it('rows array contains health and damage entries', () => {
        const bd = getPowerBreakdown();
        const keys = bd.rows.map((r) => r.key);
        expect(keys).toContain('health');
        expect(keys).toContain('damage');
    });

    it('health row base matches BASE_HEALTH at level 1', () => {
        const bd = getPowerBreakdown();
        const healthRow = bd.rows.find((r) => r.key === 'health');
        expect(healthRow.base).toBe(BASE_HEALTH);
        expect(healthRow.gear).toBe(0);
    });

    it('damage row base matches BASE_DAMAGE at level 1', () => {
        const bd = getPowerBreakdown();
        const damageRow = bd.rows.find((r) => r.key === 'damage');
        expect(damageRow.base).toBe(BASE_DAMAGE);
        expect(damageRow.gear).toBe(0);
    });
});

// ── creditServerGold ────────────────────────────────────────────────────────

describe('creditServerGold', () => {
    it('adds the specified amount to gold', () => {
        const added = creditServerGold(200);
        expect(added).toBe(200);
        expect(getGold()).toBe(STARTING_GOLD + 200);
    });

    it('does not apply clan gold bonus (flat credit)', () => {
        setClanPerks({ goldBonusPct: 100 });
        const added = creditServerGold(100);
        expect(added).toBe(100);
        expect(getGold()).toBe(STARTING_GOLD + 100);
        setClanPerks(null);
    });

    it('floors the amount to an integer', () => {
        const added = creditServerGold(99.9);
        expect(added).toBe(99);
        expect(getGold()).toBe(STARTING_GOLD + 99);
    });

    it('returns 0 for zero amount', () => {
        expect(creditServerGold(0)).toBe(0);
        expect(getGold()).toBe(STARTING_GOLD);
    });

    it('returns 0 for negative amount', () => {
        expect(creditServerGold(-50)).toBe(0);
        expect(getGold()).toBe(STARTING_GOLD);
    });

    it('returns 0 for non-numeric input', () => {
        expect(creditServerGold('abc')).toBe(0);
        expect(getGold()).toBe(STARTING_GOLD);
    });

    it('emits STATE_CHANGED event', () => {
        const spy = vi.fn();
        gameEvents.on(EVENTS.STATE_CHANGED, spy);
        creditServerGold(50);
        expect(spy).toHaveBeenCalled();
        gameEvents.off(EVENTS.STATE_CHANGED, spy);
    });
});

// ── ownsCosmetic ────────────────────────────────────────────────────────────

describe('ownsCosmetic', () => {
    it('returns true for free base avatars (wizard)', () => {
        expect(ownsCosmetic('wizard')).toBe(true);
    });

    it('returns false for null/undefined/empty', () => {
        expect(ownsCosmetic(null)).toBe(false);
        expect(ownsCosmetic(undefined)).toBe(false);
        expect(ownsCosmetic('')).toBe(false);
    });

    it('returns false for an unknown non-free cosmetic', () => {
        expect(ownsCosmetic('totally_fake_premium_thing_xyz')).toBe(false);
    });
});

// ── Clan perk getters ───────────────────────────────────────────────────────

describe('clan perk getters', () => {
    it('getForgeSpeedPct defaults to 0', () => {
        expect(getForgeSpeedPct()).toBe(0);
    });

    it('getForgeBestOf defaults to 1', () => {
        expect(getForgeBestOf()).toBe(1);
    });

    it('getStatBonusPct defaults to 0', () => {
        expect(getStatBonusPct()).toBe(0);
    });

    it('setClanPerks updates all perk getters', () => {
        setClanPerks({
            goldBonusPct: 10,
            forgeLuckPct: 5,
            forgeSpeedPct: 20,
            forgeBestOf: 3,
            statBonusPct: 15,
        });
        expect(getGoldBonusPct()).toBe(10);
        expect(getForgeSpeedPct()).toBe(20);
        expect(getForgeBestOf()).toBe(3);
        expect(getStatBonusPct()).toBe(15);
        setClanPerks(null);
    });

    it('getForgeBestOf clamps to minimum 1', () => {
        setClanPerks({ forgeBestOf: 0 });
        expect(getForgeBestOf()).toBe(1);
        setClanPerks({ forgeBestOf: -5 });
        expect(getForgeBestOf()).toBe(1);
        setClanPerks(null);
    });
});

// ── getFrame / getOwnedCosmetics ────────────────────────────────────────────

describe('frame and owned cosmetics', () => {
    it('getFrame defaults to none after reset', () => {
        expect(getFrame()).toBe('none');
    });

    it('getOwnedCosmetics returns an empty array after reset', () => {
        const cosmetics = getOwnedCosmetics();
        expect(Array.isArray(cosmetics)).toBe(true);
        expect(cosmetics.length).toBe(0);
    });

    it('getOwnedCosmetics returns a copy, not the internal array', () => {
        const a = getOwnedCosmetics();
        const b = getOwnedCosmetics();
        expect(a).not.toBe(b);
    });
});

// ── save / loadLocal round-trip ─────────────────────────────────────────────

describe('save and loadLocal round-trip', () => {
    let storage;

    beforeEach(() => {
        storage = {};
        globalThis.localStorage = {
            getItem: vi.fn((key) => storage[key] ?? null),
            setItem: vi.fn((key, val) => { storage[key] = String(val); }),
            removeItem: vi.fn((key) => { delete storage[key]; }),
        };
    });

    it('loadLocal emits GAME_LOADED event', () => {
        const spy = vi.fn();
        gameEvents.on(EVENTS.GAME_LOADED, spy);
        loadLocal();
        expect(spy).toHaveBeenCalled();
        gameEvents.off(EVENTS.GAME_LOADED, spy);
    });

    it('loadLocal emits STATE_CHANGED event', () => {
        const spy = vi.fn();
        gameEvents.on(EVENTS.STATE_CHANGED, spy);
        loadLocal();
        expect(spy).toHaveBeenCalled();
        gameEvents.off(EVENTS.STATE_CHANGED, spy);
    });
});
