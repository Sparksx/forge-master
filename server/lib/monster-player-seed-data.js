/**
 * Monster and player seed data.
 * Contains sprite sheet definitions and template records for monsters and player skins.
 */

// Monster sprite sheet: 1536×1024, 7 columns × 4 rows
const MONSTER_COLS = 7;
const MONSTER_ROWS = 4;
const MONSTER_CELL_W = Math.floor(1536 / MONSTER_COLS); // ≈219
const MONSTER_CELL_H = Math.floor(1024 / MONSTER_ROWS); // 256

// Player sprite sheet: 1536×1024, 4 columns × 2 rows
const PLAYER_COLS = 4;
const PLAYER_ROWS = 2;
const PLAYER_CELL_W = Math.floor(1536 / PLAYER_COLS); // 384
const PLAYER_CELL_H = Math.floor(1024 / PLAYER_ROWS); // 512

export const MONSTER_SPRITE_SHEET = {
    type: 'monster',
    file: '/assets/monsters.png',
    width: 1536,
    height: 1024,
};

export const PLAYER_SPRITE_SHEET = {
    type: 'player',
    file: '/assets/players.png',
    width: 1536,
    height: 1024,
};

/**
 * Monster templates — one per wave theme.
 * sprite: [col, row] in the sprite sheet grid.
 * hpMultiplier / dmgMultiplier: per-monster stat modifiers (1.0 = normal).
 * speedModifier: ms offset applied to base attack speed (negative = faster).
 */
export const MONSTER_TEMPLATES = [
    // Wave 1-10 (base waves)
    { slug: 'rat',           name: 'Rat',           emoji: '🐀', color: '#8d6e63', wave: 1,  sprite: [0, 0], hpMultiplier: 0.8,  dmgMultiplier: 0.7,  speedModifier: 0   },
    { slug: 'wolf',          name: 'Wolf',          emoji: '🐺', color: '#78909c', wave: 2,  sprite: [3, 1], hpMultiplier: 0.9,  dmgMultiplier: 1.0,  speedModifier: -50  },
    { slug: 'spider',        name: 'Spider',        emoji: '🕷️', color: '#6d4c41', wave: 3,  sprite: [0, 2], hpMultiplier: 0.7,  dmgMultiplier: 1.1,  speedModifier: -100 },
    { slug: 'ogre',          name: 'Ogre',          emoji: '👹', color: '#e65100', wave: 4,  sprite: [3, 0], hpMultiplier: 1.3,  dmgMultiplier: 1.2,  speedModifier: 100  },
    { slug: 'skeleton',      name: 'Skeleton',      emoji: '💀', color: '#eceff1', wave: 5,  sprite: [2, 0], hpMultiplier: 1.0,  dmgMultiplier: 1.0,  speedModifier: 0    },
    { slug: 'zombie',        name: 'Zombie',        emoji: '🧟', color: '#558b2f', wave: 6,  sprite: [5, 1], hpMultiplier: 1.4,  dmgMultiplier: 0.8,  speedModifier: 150  },
    { slug: 'wraith',        name: 'Wraith',        emoji: '👻', color: '#7e57c2', wave: 7,  sprite: [4, 1], hpMultiplier: 0.8,  dmgMultiplier: 1.3,  speedModifier: -80  },
    { slug: 'drake',         name: 'Drake',         emoji: '🐉', color: '#c62828', wave: 8,  sprite: [5, 2], hpMultiplier: 1.2,  dmgMultiplier: 1.2,  speedModifier: 0    },
    { slug: 'demon',         name: 'Demon',         emoji: '😈', color: '#d50000', wave: 9,  sprite: [4, 0], hpMultiplier: 1.1,  dmgMultiplier: 1.3,  speedModifier: -50  },
    { slug: 'infernal',      name: 'Infernal',      emoji: '🔥', color: '#ff6f00', wave: 10, sprite: [5, 0], hpMultiplier: 1.3,  dmgMultiplier: 1.3,  speedModifier: -100 },
    // Wave 11-20 (extended waves, unlocked by Wave Breaker tech)
    { slug: 'abyssal_bat',   name: 'Abyssal Bat',   emoji: '🦇', color: '#4a148c', wave: 11, sprite: [2, 1], hpMultiplier: 0.9,  dmgMultiplier: 1.2,  speedModifier: -120 },
    { slug: 'kraken',        name: 'Kraken',        emoji: '🐙', color: '#0d47a1', wave: 12, sprite: [1, 1], hpMultiplier: 1.5,  dmgMultiplier: 1.0,  speedModifier: 100  },
    { slug: 'frost_giant',   name: 'Frost Giant',   emoji: '🧊', color: '#4fc3f7', wave: 13, sprite: [6, 0], hpMultiplier: 1.6,  dmgMultiplier: 1.1,  speedModifier: 150  },
    { slug: 'thunder_god',   name: 'Thunder God',   emoji: '⚡', color: '#ffd600', wave: 14, sprite: [0, 1], hpMultiplier: 1.0,  dmgMultiplier: 1.5,  speedModifier: -80  },
    { slug: 'void_walker',   name: 'Void Walker',   emoji: '🌑', color: '#37474f', wave: 15, sprite: [6, 2], hpMultiplier: 1.2,  dmgMultiplier: 1.4,  speedModifier: -50  },
    { slug: 'meteor',        name: 'Meteor',        emoji: '☄️', color: '#ff3d00', wave: 16, sprite: [2, 3], hpMultiplier: 0.9,  dmgMultiplier: 1.6,  speedModifier: -100 },
    { slug: 'tempest',       name: 'Tempest',       emoji: '🌪️', color: '#80cbc4', wave: 17, sprite: [6, 3], hpMultiplier: 1.0,  dmgMultiplier: 1.3,  speedModifier: -150 },
    { slug: 'crystal_titan', name: 'Crystal Titan', emoji: '💎', color: '#e1bee7', wave: 18, sprite: [1, 3], hpMultiplier: 1.8,  dmgMultiplier: 1.0,  speedModifier: 200  },
    { slug: 'magma_lord',    name: 'Magma Lord',    emoji: '🌋', color: '#bf360c', wave: 19, sprite: [0, 3], hpMultiplier: 1.4,  dmgMultiplier: 1.4,  speedModifier: 0    },
    { slug: 'eldritch',      name: 'Eldritch',      emoji: '👁️', color: '#880e4f', wave: 20, sprite: [1, 2], hpMultiplier: 1.3,  dmgMultiplier: 1.5,  speedModifier: -80  },
];

/**
 * Player skin templates.
 * sprite: [col, row] in the player sprite sheet grid.
 */
export const PLAYER_TEMPLATES = [
    { slug: 'knight',    name: 'Knight',    sprite: [0, 0], isDefault: true  },
    { slug: 'mage',      name: 'Mage',      sprite: [1, 0], isDefault: false },
    { slug: 'ranger',    name: 'Ranger',    sprite: [2, 0], isDefault: false },
    { slug: 'paladin',   name: 'Paladin',   sprite: [3, 0], isDefault: false },
    { slug: 'barbarian', name: 'Barbarian', sprite: [0, 1], isDefault: false },
    { slug: 'rogue',     name: 'Rogue',     sprite: [1, 1], isDefault: false },
    { slug: 'cleric',    name: 'Cleric',    sprite: [2, 1], isDefault: false },
    { slug: 'warlock',   name: 'Warlock',   sprite: [3, 1], isDefault: false },
];

/**
 * Convert a [col, row] grid position to pixel coordinates for the monster sprite sheet.
 */
export function monsterGridToPixels(col, row) {
    return {
        x: col * MONSTER_CELL_W,
        y: row * MONSTER_CELL_H,
        w: MONSTER_CELL_W,
        h: MONSTER_CELL_H,
    };
}

/**
 * Convert a [col, row] grid position to pixel coordinates for the player sprite sheet.
 */
export function playerGridToPixels(col, row) {
    return {
        x: col * PLAYER_CELL_W,
        y: row * PLAYER_CELL_H,
        w: PLAYER_CELL_W,
        h: PLAYER_CELL_H,
    };
}
