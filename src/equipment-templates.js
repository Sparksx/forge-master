// Equipment templates: each item is generated from a template that provides
// a unique name and skin identifier, keyed by equipment type and tier.
//
// When forging an item of a given type + tier, a random template is picked
// from the corresponding array below.  The `skin` id is used to select the
// visual asset, and `name` is the display name shown on the item card.

export const EQUIPMENT_TEMPLATES = {
    hat: {
        // Tier 1 – Common
        1: [
            { skin: 'flat_cap',       name: "Wanderer's Cap" },
            { skin: 'baseball_cap',   name: "Rookie's Cover" },
            { skin: 'beanie',         name: 'Wool Coif' },
            { skin: 'hard_hat',       name: "Ironworker's Helm" },
        ],
        // Tier 2 – Uncommon
        2: [
            { skin: 'headband',       name: "Scout's Headband" },
            { skin: 'devil_horns',    name: "Imp's Crest" },
            { skin: 'ninja_mask',     name: 'Shadow Veil' },
            { skin: 'propeller_cap',  name: "Tinker's Whimsy" },
        ],
        // Tier 3 – Rare
        3: [
            { skin: 'halo',           name: "Seraph's Grace" },
            { skin: 'cowboy_hat',     name: 'Frontier Warden' },
            { skin: 'viking_helmet',  name: 'Nordheim Warhelm' },
            { skin: 'masquerade',     name: 'Phantom Visage' },
        ],
        // Tier 4 – Epic
        4: [
            { skin: 'royal_crown',    name: "Sovereign's Diadem" },
            { skin: 'samurai_kabuto', name: "Shogun's Kabuto" },
            { skin: 'racing_helmet',  name: 'Velocity Aegis' },
            { skin: 'wizard_hat',     name: "Archmage's Spire" },
        ],
        // Tier 5 – Legendary
        5: [
            { skin: 'knight_helmet',    name: 'Obsidian Juggernaut' },
            { skin: 'fire_crown',       name: 'Inferno Crown' },
            { skin: 'astronaut_helmet', name: "Voidwalker's Dome" },
            { skin: 'pumpkin_head',     name: 'Hallowed Dread' },
        ],
        // Tier 6 – Mythic
        6: [
            { skin: 'demon_crown',   name: 'Abyssal Coronet' },
            { skin: 'ice_crown',     name: 'Frostborne Regalia' },
            { skin: 'horned_viking', name: 'Ragnarok Warhelm' },
            { skin: 'pirate_hat',    name: "Dread Captain's Tricorn" },
        ],
        // Tier 7 – Divine
        7: [
            { skin: 'golden_crown',   name: "Eternal Monarch's Crown" },
            { skin: 'divine_halo',    name: 'Celestial Aureole' },
            { skin: 'astral_wizard',  name: "Astral Archon's Peak" },
            { skin: 'sun_crown',      name: 'Radiant Solaris' },
        ],
    },
};

/**
 * Pick a random template for the given equipment type and tier.
 * Returns { skin, name } or null if no templates are defined yet.
 */
export function pickTemplate(type, tier) {
    const byType = EQUIPMENT_TEMPLATES[type];
    if (!byType) return null;
    const templates = byType[tier];
    if (!templates || templates.length === 0) return null;
    return templates[Math.floor(Math.random() * templates.length)];
}
