// Monster definitions and wave scaling
// Wave structure: 10 waves × 10 sub-waves = 100 stages
// Lose at X-Y (Y>1) → go back to X-(Y-1)
// Lose at X-1 → restart X-1

import { HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL, GROWTH_EXPONENT } from './config.js';

export const WAVE_COUNT = 10;
export const SUB_WAVE_COUNT = 10;

// Monster themes per wave (emoji, name prefix, color)
export const WAVE_THEMES = [
    { emoji: '🐀', name: 'Rat',        color: '#8d6e63' },  // Wave 1
    { emoji: '🐺', name: 'Wolf',       color: '#78909c' },  // Wave 2
    { emoji: '🕷️', name: 'Spider',     color: '#6d4c41' },  // Wave 3
    { emoji: '👹', name: 'Ogre',       color: '#e65100' },  // Wave 4
    { emoji: '💀', name: 'Skeleton',   color: '#eceff1' },  // Wave 5
    { emoji: '🧟', name: 'Zombie',     color: '#558b2f' },  // Wave 6
    { emoji: '👻', name: 'Wraith',     color: '#7e57c2' },  // Wave 7
    { emoji: '🐉', name: 'Drake',      color: '#c62828' },  // Wave 8
    { emoji: '😈', name: 'Demon',      color: '#d50000' },  // Wave 9
    { emoji: '🔥', name: 'Infernal',   color: '#ff6f00' },  // Wave 10
];

// Sub-wave name suffixes
const SUB_NAMES = ['Scout', 'Grunt', 'Fighter', 'Warrior', 'Veteran', 'Elite', 'Champion', 'Warlord', 'Tyrant', 'Boss'];

// Base monster attack speed (ms)
const BASE_MONSTER_ATTACK_SPEED = 2000;

// Difficulty multipliers applied on top of the stat curve
const HP_MULTIPLIER = 2.5;
const DMG_MULTIPLIER = 1.8;

/**
 * How many monsters in a sub-wave:
 *   sub 1-3 → 1 monster
 *   sub 4-7 → 2 monsters
 *   sub 8-10 → 3 monsters
 */
export function getMonsterCount(subWave) {
    if (subWave <= 3) return 1;
    if (subWave <= 7) return 2;
    return 3;
}

/**
 * Monster stats use the same exponential curve as player equipment,
 * mapped through an effective level derived from the stage number.
 *
 * Difficulty targets (T1 = Common tier, no bonus stats):
 *   T1 lvl 15-20 → barely clears wave 1 (stages 1-7)
 *   T1 lvl 90+   → barely clears wave 2 (stages 11-18)
 *   T2+ gear needed for wave 3+
 */
export function getMonsterForWave(wave, subWave) {
    const theme = WAVE_THEMES[wave - 1];
    const subName = SUB_NAMES[subWave - 1];

    const stage = (wave - 1) * SUB_WAVE_COUNT + subWave; // 1-100

    // Effective level grows as a power curve of stage
    const effLevel = 3 + 1.5 * Math.pow(stage, 1.55);

    // Use same stat formula as items: perLevel × effLevel^GROWTH_EXPONENT × multiplier
    const hp = Math.max(30, Math.floor(HEALTH_PER_LEVEL * Math.pow(effLevel, GROWTH_EXPONENT) * HP_MULTIPLIER));
    const damage = Math.max(5, Math.floor(DAMAGE_PER_LEVEL * Math.pow(effLevel, GROWTH_EXPONENT) * DMG_MULTIPLIER));

    // Monsters get slightly faster at higher waves but not below 800ms
    const attackSpeed = Math.max(800, BASE_MONSTER_ATTACK_SPEED - (wave - 1) * 80 - (subWave - 1) * 15);

    return {
        name: `${theme.name} ${subName}`,
        emoji: theme.emoji,
        color: theme.color,
        maxHP: hp,
        damage,
        attackSpeed,
        wave,
        subWave,
    };
}

export function getWaveLabel(wave, subWave) {
    return `${wave}-${subWave}`;
}
