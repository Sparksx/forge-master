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
export const SPEED_UP_GOLD_PER_SECOND = 2;

// Auto-forge interval in milliseconds
export const AUTO_FORGE_INTERVAL = 3500;

export const FORGE_LEVELS = [
    //                                       Com     Unc     Rar     Epi     Leg     Myt
    { level: 1,  cost: 0,         time: 0,       chances: [100,    0,      0,      0,      0,      0     ] },
    { level: 2,  cost: 200,       time: 60,      chances: [97.5,   2.5,    0,      0,      0,      0     ] },
    { level: 3,  cost: 500,       time: 180,     chances: [95,     5,      0,      0,      0,      0     ] },
    { level: 4,  cost: 1000,      time: 360,     chances: [93,     6.5,    0.5,    0,      0,      0     ] },
    { level: 5,  cost: 1800,      time: 600,     chances: [90.5,   8,      1.5,    0,      0,      0     ] },
    { level: 6,  cost: 3000,      time: 1200,    chances: [87.5,   10,     2.5,    0,      0,      0     ] },
    { level: 7,  cost: 5000,      time: 1800,    chances: [84.5,   12,     3.5,    0,      0,      0     ] },
    { level: 8,  cost: 8000,      time: 3600,    chances: [81,     14,     5,      0,      0,      0     ] },
    { level: 9,  cost: 12000,     time: 5400,    chances: [77.5,   15.5,   6.5,    0.5,    0,      0     ] },
    { level: 10, cost: 18000,     time: 7200,    chances: [74,     17,     8,      1,      0,      0     ] },
    { level: 11, cost: 27000,     time: 14400,   chances: [70,     18.5,   9.5,    2,      0,      0     ] },
    { level: 12, cost: 40000,     time: 21600,   chances: [66,     20,     11,     3,      0,      0     ] },
    { level: 13, cost: 60000,     time: 36000,   chances: [62,     21,     12.5,   4.5,    0,      0     ] },
    { level: 14, cost: 85000,     time: 50400,   chances: [58,     22,     14,     6,      0,      0     ] },
    { level: 15, cost: 120000,    time: 72000,   chances: [54,     22.5,   15,     8,      0.5,    0     ] },
    { level: 16, cost: 170000,    time: 100800,  chances: [50,     23,     16,     9.5,    1.5,    0     ] },
    { level: 17, cost: 250000,    time: 144000,  chances: [46,     23,     17,     11.5,   2.5,    0     ] },
    { level: 18, cost: 360000,    time: 201600,  chances: [42,     22.5,   18,     13.5,   4,      0     ] },
    { level: 19, cost: 500000,    time: 259200,  chances: [38,     22,     19,     15,     6,      0     ] },
    { level: 20, cost: 700000,    time: 345600,  chances: [34,     21,     19.5,   17,     8.5,    0     ] },
    { level: 21, cost: 1000000,   time: 432000,  chances: [30,     20,     20,     18.5,   11,     0.5   ] },
    { level: 22, cost: 1400000,   time: 518400,  chances: [26,     19,     20,     20,     14,     1     ] },
    { level: 23, cost: 2000000,   time: 604800,  chances: [22,     17.5,   19.5,   21.5,   17.5,   2     ] },
    { level: 24, cost: 2800000,   time: 691200,  chances: [18,     16,     19,     23,     21,     3     ] },
    { level: 25, cost: 4000000,   time: 777600,  chances: [14.5,   14.5,   18,     24,     25,     4     ] },
    { level: 26, cost: 5500000,   time: 864000,  chances: [11,     13,     17,     24.5,   29,     5.5   ] },
    { level: 27, cost: 7500000,   time: 1036800, chances: [8,      11,     15.5,   24.5,   34,     7     ] },
    { level: 28, cost: 10000000,  time: 1209600, chances: [5,      9,      14,     24,     39.5,   8.5   ] },
    { level: 29, cost: 14000000,  time: 1382400, chances: [2.5,    6.5,    12,     22.5,   46,     10.5  ] },
    { level: 30, cost: 20000000,  time: 1728000, chances: [0,      4,      10,     21,     52,     13    ] },
];

export const MAX_FORGE_LEVEL = FORGE_LEVELS.length;
