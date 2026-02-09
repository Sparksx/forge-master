// Re-export shared constants so existing client imports keep working
export {
    EQUIPMENT_TYPES, HEALTH_ITEMS, DAMAGE_ITEMS,
    BASE_HEALTH, BASE_DAMAGE, HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL,
    GROWTH_EXPONENT, BONUS_STATS, BONUS_STAT_KEYS,
} from '../shared/stats.js';

export const EQUIPMENT_ICONS = {
    hat: '🎩',
    armor: '🛡️',
    belt: '📿',
    boots: '👢',
    gloves: '🧤',
    necklace: '📿',
    ring: '💍',
    weapon: '⚔️'
};

export const LEVEL_RANGE = 10;
export const MAX_LEVEL = 100;
export const INITIAL_LEVEL_MAX = 10;

export const SAVE_KEY = 'forgemaster_save';

// --- Tier system ---

export const TIERS = [
    { id: 1, name: 'Common',    color: '#9d9d9d', bonusCount: 0 },
    { id: 2, name: 'Uncommon',  color: '#1eff00', bonusCount: 1 },
    { id: 3, name: 'Rare',      color: '#0070dd', bonusCount: 1 },
    { id: 4, name: 'Epic',      color: '#a335ee', bonusCount: 2 },
    { id: 5, name: 'Legendary', color: '#ff8000', bonusCount: 2 },
    { id: 6, name: 'Mythic',    color: '#ff0000', bonusCount: 3 },
];

export const MAX_TIER = TIERS.length;

// --- Forge level system ---

// Gold per remaining second to instantly complete an upgrade
export const SPEED_UP_GOLD_PER_SECOND = 1;

// Auto-forge interval in milliseconds
export const AUTO_FORGE_INTERVAL = 2000;

export const FORGE_LEVELS = [
    //                                    Com  Unc  Rar  Epi  Leg  Myt
    { level: 1,  cost: 0,        time: 0,      chances: [100, 0,  0,  0,  0,  0] },
    { level: 2,  cost: 100,      time: 30,     chances: [96,  4,  0,  0,  0,  0] },
    { level: 3,  cost: 250,      time: 60,     chances: [92,  8,  0,  0,  0,  0] },
    { level: 4,  cost: 500,      time: 120,    chances: [87,  13, 0,  0,  0,  0] },
    { level: 5,  cost: 800,      time: 240,    chances: [82,  18, 0,  0,  0,  0] },
    { level: 6,  cost: 1200,     time: 420,    chances: [77,  20, 3,  0,  0,  0] },
    { level: 7,  cost: 1800,     time: 600,    chances: [72,  22, 6,  0,  0,  0] },
    { level: 8,  cost: 2800,     time: 900,    chances: [66,  24, 10, 0,  0,  0] },
    { level: 9,  cost: 4000,     time: 1500,   chances: [60,  26, 13, 1,  0,  0] },
    { level: 10, cost: 6000,     time: 2100,   chances: [54,  27, 16, 3,  0,  0] },
    { level: 11, cost: 9000,     time: 3600,   chances: [48,  28, 19, 5,  0,  0] },
    { level: 12, cost: 13000,    time: 5400,   chances: [42,  28, 22, 7,  1,  0] },
    { level: 13, cost: 18000,    time: 7200,   chances: [36,  28, 25, 9,  2,  0] },
    { level: 14, cost: 25000,    time: 10800,  chances: [30,  27, 27, 12, 4,  0] },
    { level: 15, cost: 35000,    time: 14400,  chances: [25,  25, 28, 16, 6,  0] },
    { level: 16, cost: 50000,    time: 21600,  chances: [20,  23, 29, 20, 8,  0] },
    { level: 17, cost: 70000,    time: 28800,  chances: [15,  21, 29, 24, 11, 0] },
    { level: 18, cost: 100000,   time: 43200,  chances: [11,  19, 28, 28, 14, 0] },
    { level: 19, cost: 140000,   time: 57600,  chances: [7,   16, 27, 32, 18, 0] },
    { level: 20, cost: 200000,   time: 86400,  chances: [4,   13, 25, 35, 23, 0] },
    { level: 21, cost: 280000,   time: 115200, chances: [2,   10, 23, 37, 27, 1] },
    { level: 22, cost: 400000,   time: 144000, chances: [0,   8,  20, 38, 33, 1] },
    { level: 23, cost: 550000,   time: 172800, chances: [0,   6,  18, 38, 37, 1] },
    { level: 24, cost: 750000,   time: 216000, chances: [0,   4,  15, 38, 41, 2] },
    { level: 25, cost: 1000000,  time: 259200, chances: [0,   2,  12, 36, 47, 3] },
    { level: 26, cost: 1400000,  time: 345600, chances: [0,   0,  10, 33, 53, 4] },
    { level: 27, cost: 2000000,  time: 432000, chances: [0,   0,  7,  30, 58, 5] },
    { level: 28, cost: 2800000,  time: 518400, chances: [0,   0,  4,  26, 63, 7] },
    { level: 29, cost: 4000000,  time: 604800, chances: [0,   0,  2,  20, 68, 10] },
    { level: 30, cost: 5500000,  time: 864000, chances: [0,   0,  0,  10, 75, 15] },
];

export const MAX_FORGE_LEVEL = FORGE_LEVELS.length;
