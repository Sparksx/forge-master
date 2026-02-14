// Monster definitions and wave scaling
// Wave structure: 10 waves × 10 sub-waves = 100 stages
// Lose at X-Y (Y>1) → go back to X-(Y-1)
// Lose at X-1 → restart X-1
//
// On startup, loadMonsterTemplatesFromAPI() is called to fetch the latest
// monster definitions from the server. If the API is unavailable (offline/
// guest mode), the hardcoded FALLBACK data is used instead.

import { HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL, GROWTH_EXPONENT } from './config.js';
import { getTechEffect } from './state.js';

export const WAVE_COUNT = 10;
export const SUB_WAVE_COUNT = 10;

// Monster sprite sheet: 1536×1024, 7 columns × 4 rows
// Each sprite cell ≈ 219×256 px
const MONSTER_COLS = 7;
const MONSTER_CELL_W = 1536 / MONSTER_COLS; // ≈219.4
const MONSTER_CELL_H = 1024 / 4;            // 256

/** Return CSS background style for a monster sprite at (col, row). */
export function getMonsterSpriteStyle(col, row) {
    const sizeX = (1536 / MONSTER_CELL_W) * 100;  // 700%
    const sizeY = (1024 / MONSTER_CELL_H) * 100;  // 400%
    const posX = col / (MONSTER_COLS - 1) * 100;
    const posY = row / 3 * 100;
    const file = monsterSpriteSheet ? monsterSpriteSheet.file : '/assets/monsters.png';
    return `background-image:url(${file});background-size:${sizeX}% ${sizeY}%;background-position:${posX}% ${posY}%;`;
}

/**
 * Return CSS background style for a monster using pixel-based sprite data from DB.
 * Falls back to grid-based style if pixel data is unavailable.
 */
export function getMonsterSpriteStyleFromDB(spriteData) {
    if (!spriteData) return '';
    const sheet = monsterSpriteSheet || { file: '/assets/monsters.png', width: 1536, height: 1024 };
    const sizeX = (sheet.width / spriteData.w) * 100;
    const sizeY = (sheet.height / spriteData.h) * 100;
    const posX = spriteData.w < sheet.width ? (spriteData.x / (sheet.width - spriteData.w)) * 100 : 0;
    const posY = spriteData.h < sheet.height ? (spriteData.y / (sheet.height - spriteData.h)) * 100 : 0;
    return `background-image:url(${sheet.file});background-size:${sizeX}% ${sizeY}%;background-position:${posX}% ${posY}%;`;
}

// ── Hardcoded fallback data ──────────────────────────────────────
const FALLBACK_WAVE_THEMES = [
    { emoji: '🐀', name: 'Rat',        color: '#8d6e63',  sprite: [0, 0], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '🐺', name: 'Wolf',       color: '#78909c',  sprite: [3, 1], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '🕷️', name: 'Spider',     color: '#6d4c41',  sprite: [0, 2], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '👹', name: 'Ogre',       color: '#e65100',  sprite: [3, 0], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '💀', name: 'Skeleton',   color: '#eceff1',  sprite: [2, 0], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '🧟', name: 'Zombie',     color: '#558b2f',  sprite: [5, 1], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '👻', name: 'Wraith',     color: '#7e57c2',  sprite: [4, 1], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '🐉', name: 'Drake',      color: '#c62828',  sprite: [5, 2], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '😈', name: 'Demon',      color: '#d50000',  sprite: [4, 0], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '🔥', name: 'Infernal',   color: '#ff6f00',  sprite: [5, 0], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    // Extended waves (unlocked by Wave Breaker tech)
    { emoji: '🦇', name: 'Abyssal Bat', color: '#4a148c', sprite: [2, 1], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '🐙', name: 'Kraken',     color: '#0d47a1',  sprite: [1, 1], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '🧊', name: 'Frost Giant', color: '#4fc3f7',  sprite: [6, 0], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '⚡', name: 'Thunder God', color: '#ffd600',  sprite: [0, 1], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '🌑', name: 'Void Walker', color: '#37474f',  sprite: [6, 2], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '☄️', name: 'Meteor',      color: '#ff3d00',  sprite: [2, 3], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '🌪️', name: 'Tempest',     color: '#80cbc4',  sprite: [6, 3], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '💎', name: 'Crystal Titan', color: '#e1bee7', sprite: [1, 3], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '🌋', name: 'Magma Lord',  color: '#bf360c',  sprite: [0, 3], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
    { emoji: '👁️', name: 'Eldritch',    color: '#880e4f',  sprite: [1, 2], hpMultiplier: 1, dmgMultiplier: 1, speedModifier: 0 },
];

// ── Mutable state: starts with fallback, replaced by API data ────
export let WAVE_THEMES = [...FALLBACK_WAVE_THEMES];
let monsterSpriteSheet = null;

/**
 * Load monster templates from the server API.
 * Replaces in-memory WAVE_THEMES with DB data including per-monster stat modifiers.
 * Falls back silently to hardcoded data on failure.
 */
export async function loadMonsterTemplatesFromAPI() {
    try {
        const res = await fetch('/api/monsters/templates');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.spriteSheet) {
            monsterSpriteSheet = data.spriteSheet;
        }

        if (data.templates && data.templates.length > 0) {
            WAVE_THEMES = data.templates.map(t => ({
                emoji: t.emoji,
                name: t.name,
                color: t.color,
                sprite: t.sprite
                    ? [t.sprite.x, t.sprite.y, t.sprite.w, t.sprite.h] // pixel coords from DB
                    : null,
                spriteDB: t.sprite, // keep raw pixel data for DB-based rendering
                hpMultiplier: t.hpMultiplier ?? 1,
                dmgMultiplier: t.dmgMultiplier ?? 1,
                speedModifier: t.speedModifier ?? 0,
            }));
        }
    } catch {
        // API unavailable — use fallback monster templates
    }
}

/** Get the current max wave count (base 10 + waveBreaker tech bonus) */
export function getMaxWaveCount() {
    return WAVE_COUNT + getTechEffect('waveBreaker');
}

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
 * Per-monster stat modifiers from the database are applied on top:
 *   - hpMultiplier: scales monster HP (e.g. 1.3 = +30% HP)
 *   - dmgMultiplier: scales monster damage
 *   - speedModifier: ms offset to base attack speed (negative = faster)
 *
 * Difficulty targets (T1 = Common tier, no bonus stats):
 *   T1 lvl 15-20 → barely clears wave 1 (stages 1-7)
 *   T1 lvl 90+   → barely clears wave 2 (stages 11-18)
 *   T2+ gear needed for wave 3+
 */
export function getMonsterForWave(wave, subWave) {
    const themeIndex = Math.min(wave - 1, WAVE_THEMES.length - 1);
    const theme = WAVE_THEMES[themeIndex];
    const subName = SUB_NAMES[subWave - 1];

    const stage = (wave - 1) * SUB_WAVE_COUNT + subWave; // 1-100

    // Effective level grows as a power curve of stage
    const effLevel = 3 + 1.5 * Math.pow(stage, 1.55);

    // Per-monster stat modifiers (from DB, default 1.0 / 0)
    const hpMod = theme.hpMultiplier ?? 1;
    const dmgMod = theme.dmgMultiplier ?? 1;
    const spdMod = theme.speedModifier ?? 0;

    // Use same stat formula as items: perLevel × effLevel^GROWTH_EXPONENT × multiplier
    const hp = Math.max(30, Math.floor(HEALTH_PER_LEVEL * Math.pow(effLevel, GROWTH_EXPONENT) * HP_MULTIPLIER * hpMod));
    const damage = Math.max(5, Math.floor(DAMAGE_PER_LEVEL * Math.pow(effLevel, GROWTH_EXPONENT) * DMG_MULTIPLIER * dmgMod));

    // Monsters get slightly faster at higher waves but not below 800ms
    const attackSpeed = Math.max(800, BASE_MONSTER_ATTACK_SPEED - (wave - 1) * 80 - (subWave - 1) * 15 + spdMod);

    return {
        name: `${theme.name} ${subName}`,
        emoji: theme.emoji,
        color: theme.color,
        sprite: theme.sprite,
        spriteDB: theme.spriteDB || null,
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
