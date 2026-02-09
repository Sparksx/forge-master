// Monster definitions and wave scaling
// Wave structure: 10 waves × 10 sub-waves = 100 stages
// Lose at X-Y (Y>1) → go back to X-(Y-1)
// Lose at X-1 → restart X-1

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

// Base monster stats (wave 1-1)
const BASE_MONSTER_HP = 50;
const BASE_MONSTER_DMG = 5;
const BASE_MONSTER_ATTACK_SPEED = 2000; // ms between attacks

// Scaling exponents
const HP_WAVE_SCALE = 1.8;
const HP_SUB_SCALE = 1.15;
const DMG_WAVE_SCALE = 1.6;
const DMG_SUB_SCALE = 1.12;

export function getMonsterForWave(wave, subWave) {
    const theme = WAVE_THEMES[wave - 1];
    const subName = SUB_NAMES[subWave - 1];

    const waveMultHP = Math.pow(wave, HP_WAVE_SCALE);
    const subMultHP = Math.pow(subWave, HP_SUB_SCALE);
    const hp = Math.floor(BASE_MONSTER_HP * waveMultHP * subMultHP);

    const waveMultDMG = Math.pow(wave, DMG_WAVE_SCALE);
    const subMultDMG = Math.pow(subWave, DMG_SUB_SCALE);
    const damage = Math.floor(BASE_MONSTER_DMG * waveMultDMG * subMultDMG);

    // Monsters get slightly faster at higher waves
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
