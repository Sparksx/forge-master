// Equipment templates: each item is generated from a template that provides
// a unique name and skin identifier, keyed by equipment type and tier.
//
// When forging an item of a given type + tier, a random template is picked
// from the corresponding array below.  The `skin` id is used to select the
// visual asset, and `name` is the display name shown on the item card.
//
// Sprite sheets live in public/assets/<type>s.png  (e.g. helmets.png)
// Each sheet is a grid: columns = skins per tier, rows = tiers (1-7).

// ── Sprite-sheet layout constants ──────────────────────────────────
// The sprite sheet for helmets is 4 columns × 7 rows.
// Positions are expressed as (row, col), 0-indexed.
export const SPRITE_SHEETS = {
    hat: { file: '/assets/helmets.png', cols: 4, rows: 7 },
};

export const EQUIPMENT_TEMPLATES = {
    hat: {
        // Tier 1 – Common  (row 0)
        1: [
            { skin: 'flat_cap',       name: "Wanderer's Cap",      spriteCol: 0 },
            { skin: 'baseball_cap',   name: "Rookie's Cover",      spriteCol: 1 },
            { skin: 'beanie',         name: 'Wool Coif',           spriteCol: 2 },
            { skin: 'hard_hat',       name: "Ironworker's Helm",   spriteCol: 3 },
        ],
        // Tier 2 – Uncommon  (row 1)
        2: [
            { skin: 'headband',       name: "Scout's Headband",    spriteCol: 0 },
            { skin: 'devil_horns',    name: "Imp's Crest",         spriteCol: 1 },
            { skin: 'ninja_mask',     name: 'Shadow Veil',         spriteCol: 2 },
            { skin: 'propeller_cap',  name: "Tinker's Whimsy",     spriteCol: 3 },
        ],
        // Tier 3 – Rare  (row 2)
        3: [
            { skin: 'halo',           name: "Seraph's Grace",      spriteCol: 0 },
            { skin: 'cowboy_hat',     name: 'Frontier Warden',     spriteCol: 1 },
            { skin: 'viking_helmet',  name: 'Nordheim Warhelm',    spriteCol: 2 },
            { skin: 'masquerade',     name: 'Phantom Visage',      spriteCol: 3 },
        ],
        // Tier 4 – Epic  (row 3)
        4: [
            { skin: 'royal_crown',    name: "Sovereign's Diadem",  spriteCol: 0 },
            { skin: 'samurai_kabuto', name: "Shogun's Kabuto",     spriteCol: 1 },
            { skin: 'racing_helmet',  name: 'Velocity Aegis',      spriteCol: 2 },
            { skin: 'wizard_hat',     name: "Archmage's Spire",    spriteCol: 3 },
        ],
        // Tier 5 – Legendary  (row 4)
        5: [
            { skin: 'knight_helmet',    name: 'Obsidian Juggernaut', spriteCol: 0 },
            { skin: 'fire_crown',       name: 'Inferno Crown',      spriteCol: 1 },
            { skin: 'astronaut_helmet', name: "Voidwalker's Dome",  spriteCol: 2 },
            { skin: 'pumpkin_head',     name: 'Hallowed Dread',     spriteCol: 3 },
        ],
        // Tier 6 – Mythic  (row 5)
        6: [
            { skin: 'demon_crown',   name: 'Abyssal Coronet',         spriteCol: 0 },
            { skin: 'ice_crown',     name: 'Frostborne Regalia',      spriteCol: 1 },
            { skin: 'horned_viking', name: 'Ragnarok Warhelm',        spriteCol: 2 },
            { skin: 'pirate_hat',    name: "Dread Captain's Tricorn", spriteCol: 3 },
        ],
        // Tier 7 – Divine  (row 6)
        7: [
            { skin: 'golden_crown',   name: "Eternal Monarch's Crown", spriteCol: 0 },
            { skin: 'divine_halo',    name: 'Celestial Aureole',       spriteCol: 1 },
            { skin: 'astral_wizard',  name: "Astral Archon's Peak",    spriteCol: 2 },
            { skin: 'sun_crown',      name: 'Radiant Solaris',         spriteCol: 3 },
        ],
    },
};

/**
 * Pick a random template for the given equipment type and tier.
 * Returns { skin, name, spriteCol } or null if no templates are defined yet.
 */
export function pickTemplate(type, tier) {
    const byType = EQUIPMENT_TEMPLATES[type];
    if (!byType) return null;
    const templates = byType[tier];
    if (!templates || templates.length === 0) return null;
    return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Build inline style for a sprite-sheet background.
 * Returns a CSS string like "background: url(...) ...; background-size: ...;"
 * or empty string if no sprite data is available.
 */
export function getSpriteStyle(type, tier, spriteCol) {
    const sheet = SPRITE_SHEETS[type];
    if (!sheet || spriteCol == null) return '';

    const row = tier - 1; // tier 1 = row 0
    const xPct = sheet.cols > 1 ? (spriteCol / (sheet.cols - 1)) * 100 : 0;
    const yPct = sheet.rows > 1 ? (row / (sheet.rows - 1)) * 100 : 0;

    return `background-image: url(${sheet.file}); background-size: ${sheet.cols * 100}% ${sheet.rows * 100}%; background-position: ${xPct}% ${yPct}%; background-repeat: no-repeat;`;
}
