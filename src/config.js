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
export const HEALTH_PER_LEVEL = 5;
export const DAMAGE_PER_LEVEL = 2;

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
