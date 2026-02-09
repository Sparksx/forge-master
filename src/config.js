export const EQUIPMENT_TYPES = ['hat', 'armor', 'belt', 'boots', 'gloves', 'necklace', 'ring', 'weapon'];

export const HEALTH_ITEMS = ['hat', 'armor', 'belt', 'boots'];
export const DAMAGE_ITEMS = ['gloves', 'necklace', 'ring', 'weapon'];

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

export const BASE_HEALTH = 100;
export const BASE_DAMAGE = 10;
export const HEALTH_PER_LEVEL = 10;
export const DAMAGE_PER_LEVEL = 2;

export const GROWTH_EXPONENT = 1.2;

export const LEVEL_RANGE = 10;
export const MAX_LEVEL = 100;
export const INITIAL_LEVEL_MAX = 10;

export const SAVE_KEY = 'forgemaster_save';

export const BONUS_STATS = {
    attackSpeed:    { label: 'Attack Speed',    icon: '⚡', max: 15, unit: '%' },
    critChance:     { label: 'Crit Chance',     icon: '🎯', max: 10, unit: '%' },
    critMultiplier: { label: 'Crit Multiplier', icon: '💥', max: 20, unit: '%' },
    healthMulti:    { label: 'Health Multi',    icon: '💗', max: 12, unit: '%' },
    damageMulti:    { label: 'Damage Multi',    icon: '🗡️', max: 12, unit: '%' },
    healthRegen:    { label: 'Health Regen',    icon: '🩹', max: 5,  unit: '%' },
    lifeSteal:      { label: 'Life Steal',      icon: '🧛', max: 8,  unit: '%' },
};

export const BONUS_STAT_KEYS = Object.keys(BONUS_STATS);

// --- Tier system ---

export const TIERS = [
    { id: 1, name: 'Commun',     color: '#9d9d9d', bonusCount: 0 },
    { id: 2, name: 'Amélioré',   color: '#1eff00', bonusCount: 1 },
    { id: 3, name: 'Rare',       color: '#0070dd', bonusCount: 1 },
    { id: 4, name: 'Épique',     color: '#a335ee', bonusCount: 2 },
    { id: 5, name: 'Légendaire', color: '#ff8000', bonusCount: 2 },
];

export const MAX_TIER = TIERS.length;

// --- Forge level system ---

// Gold per remaining second to instantly complete an upgrade
export const SPEED_UP_GOLD_PER_SECOND = 1;

export const FORGE_LEVELS = [
    //                                    Com  Amé  Rar  Épi  Lég
    { level: 1,  cost: 0,        time: 0,      chances: [100, 0,  0,  0,  0 ] },
    { level: 2,  cost: 100,      time: 10,     chances: [96,  4,  0,  0,  0 ] },
    { level: 3,  cost: 200,      time: 20,     chances: [92,  8,  0,  0,  0 ] },
    { level: 4,  cost: 350,      time: 35,     chances: [87,  13, 0,  0,  0 ] },
    { level: 5,  cost: 550,      time: 60,     chances: [82,  18, 0,  0,  0 ] },
    { level: 6,  cost: 800,      time: 90,     chances: [76,  22, 2,  0,  0 ] },
    { level: 7,  cost: 1200,     time: 150,    chances: [70,  25, 5,  0,  0 ] },
    { level: 8,  cost: 1800,     time: 240,    chances: [63,  28, 9,  0,  0 ] },
    { level: 9,  cost: 2500,     time: 360,    chances: [56,  30, 13, 1,  0 ] },
    { level: 10, cost: 3500,     time: 540,    chances: [49,  30, 18, 3,  0 ] },
    { level: 11, cost: 5000,     time: 780,    chances: [42,  30, 22, 5,  1 ] },
    { level: 12, cost: 7000,     time: 1080,   chances: [36,  28, 26, 8,  2 ] },
    { level: 13, cost: 10000,    time: 1500,   chances: [30,  27, 28, 12, 3 ] },
    { level: 14, cost: 14000,    time: 2100,   chances: [25,  25, 30, 15, 5 ] },
    { level: 15, cost: 20000,    time: 3000,   chances: [20,  23, 30, 20, 7 ] },
    { level: 16, cost: 28000,    time: 4200,   chances: [16,  21, 30, 24, 9 ] },
    { level: 17, cost: 40000,    time: 5400,   chances: [12,  19, 29, 28, 12] },
    { level: 18, cost: 55000,    time: 7200,   chances: [9,   17, 27, 32, 15] },
    { level: 19, cost: 75000,    time: 10800,  chances: [6,   15, 25, 35, 19] },
    { level: 20, cost: 100000,   time: 14400,  chances: [4,   12, 24, 37, 23] },
    { level: 21, cost: 140000,   time: 21600,  chances: [2,   10, 22, 38, 28] },
    { level: 22, cost: 190000,   time: 28800,  chances: [0,   8,  20, 39, 33] },
    { level: 23, cost: 260000,   time: 36000,  chances: [0,   6,  18, 38, 38] },
    { level: 24, cost: 350000,   time: 50400,  chances: [0,   4,  15, 38, 43] },
    { level: 25, cost: 480000,   time: 64800,  chances: [0,   2,  12, 36, 50] },
    { level: 26, cost: 650000,   time: 86400,  chances: [0,   0,  10, 33, 57] },
    { level: 27, cost: 880000,   time: 108000, chances: [0,   0,  7,  30, 63] },
    { level: 28, cost: 1200000,  time: 144000, chances: [0,   0,  4,  26, 70] },
    { level: 29, cost: 1600000,  time: 187200, chances: [0,   0,  2,  20, 78] },
    { level: 30, cost: 2200000,  time: 259200, chances: [0,   0,  0,  12, 88] },
];

export const MAX_FORGE_LEVEL = FORGE_LEVELS.length;
