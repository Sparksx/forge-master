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

export const FORGE_LEVELS = [
    { level: 1,  cost: 0,       chances: [100, 0,  0,  0,  0 ] },
    { level: 2,  cost: 200,     chances: [92,  8,  0,  0,  0 ] },
    { level: 3,  cost: 500,     chances: [80,  20, 0,  0,  0 ] },
    { level: 4,  cost: 1200,    chances: [65,  30, 5,  0,  0 ] },
    { level: 5,  cost: 3000,    chances: [50,  35, 13, 2,  0 ] },
    { level: 6,  cost: 7000,    chances: [35,  35, 22, 7,  1 ] },
    { level: 7,  cost: 15000,   chances: [20,  35, 28, 14, 3 ] },
    { level: 8,  cost: 30000,   chances: [10,  28, 33, 22, 7 ] },
    { level: 9,  cost: 60000,   chances: [5,   20, 33, 30, 12] },
    { level: 10, cost: 120000,  chances: [0,   10, 30, 40, 20] },
];

export const MAX_FORGE_LEVEL = FORGE_LEVELS.length;
