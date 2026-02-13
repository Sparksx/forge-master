// Equipment templates: each item is generated from a template that provides
// a unique name and skin identifier, keyed by equipment type and tier.
//
// When forging an item of a given type + tier, a random template is picked
// from the corresponding array below.  The `skin` id is used to select the
// visual asset, and `name` is the display name shown on the item card.
//
// Sprite sheets live in public/assets/<type>s.png  (e.g. helmets.png)
// All sheets are 1024×1536 → 8 rows of 192 px each.
// Most sheets have a "Demon" row at index 6 that the game skips (7 game
// tiers only).  `tierToRow` maps tier 1-7 to the correct row index.

// ── Sprite-sheet layout constants ──────────────────────────────────
export const SPRITE_SHEETS = {
    hat:      { file: '/assets/helmets.png',   cols: 4, rows: 8 },
    armor:    { file: '/assets/armors.png',     cols: 4, rows: 8, tierToRow: [0, 1, 2, 3, 4, 5, 7] },
    weapon:   { file: '/assets/weapons.png',    cols: 4, rows: 8, tierToRow: [0, 1, 2, 3, 4, 5, 7] },
    necklace: { file: '/assets/necklaces.png',  cols: 4, rows: 8, tierToRow: [0, 1, 2, 3, 4, 5, 7] },
    ring:     { file: '/assets/rings.png',      cols: 4, rows: 8, tierToRow: [0, 1, 2, 3, 4, 5, 7] },
    gloves:   { file: '/assets/gloves.png',     cols: 5, rows: 8, tierToRow: [0, 1, 2, 3, 4, 5, 7] },
    belt:     { file: '/assets/belts.png',      cols: 4, rows: 8, tierToRow: [0, 1, 2, 3, 4, 5, 7] },
    boots:    { file: '/assets/boots.png',      cols: 5, rows: 8, tierToRow: [0, 1, 2, 3, 4, 5, 7] },
};

export const EQUIPMENT_TEMPLATES = {
    // ─────────────────────── HAT ───────────────────────
    // 4 cols × 8 rows — no Demon row (tier 1-7 → rows 0-6)
    hat: {
        1: [
            { skin: 'flat_cap',       name: "Wanderer's Cap",      spriteCol: 0 },
            { skin: 'baseball_cap',   name: "Rookie's Cover",      spriteCol: 1 },
            { skin: 'beanie',         name: 'Wool Coif',           spriteCol: 2 },
            { skin: 'hard_hat',       name: "Ironworker's Helm",   spriteCol: 3 },
        ],
        2: [
            { skin: 'headband',       name: "Scout's Headband",    spriteCol: 0 },
            { skin: 'devil_horns',    name: "Imp's Crest",         spriteCol: 1 },
            { skin: 'ninja_mask',     name: 'Shadow Veil',         spriteCol: 2 },
            { skin: 'propeller_cap',  name: "Tinker's Whimsy",     spriteCol: 3 },
        ],
        3: [
            { skin: 'halo',           name: "Seraph's Grace",      spriteCol: 0 },
            { skin: 'cowboy_hat',     name: 'Frontier Warden',     spriteCol: 1 },
            { skin: 'viking_helmet',  name: 'Nordheim Warhelm',    spriteCol: 2 },
            { skin: 'masquerade',     name: 'Phantom Visage',      spriteCol: 3 },
        ],
        4: [
            { skin: 'royal_crown',    name: "Sovereign's Diadem",  spriteCol: 0 },
            { skin: 'samurai_kabuto', name: "Shogun's Kabuto",     spriteCol: 1 },
            { skin: 'racing_helmet',  name: 'Velocity Aegis',      spriteCol: 2 },
            { skin: 'wizard_hat',     name: "Archmage's Spire",    spriteCol: 3 },
        ],
        5: [
            { skin: 'knight_helmet',    name: 'Obsidian Juggernaut', spriteCol: 0 },
            { skin: 'fire_crown',       name: 'Inferno Crown',      spriteCol: 1 },
            { skin: 'astronaut_helmet', name: "Voidwalker's Dome",  spriteCol: 2 },
            { skin: 'pumpkin_head',     name: 'Hallowed Dread',     spriteCol: 3 },
        ],
        6: [
            { skin: 'demon_crown',   name: 'Abyssal Coronet',         spriteCol: 0 },
            { skin: 'ice_crown',     name: 'Frostborne Regalia',      spriteCol: 1 },
            { skin: 'horned_viking', name: 'Ragnarok Warhelm',        spriteCol: 2 },
            { skin: 'pirate_hat',    name: "Dread Captain's Tricorn", spriteCol: 3 },
        ],
        7: [
            { skin: 'golden_crown',   name: "Eternal Monarch's Crown", spriteCol: 0 },
            { skin: 'divine_halo',    name: 'Celestial Aureole',       spriteCol: 1 },
            { skin: 'astral_wizard',  name: "Astral Archon's Peak",    spriteCol: 2 },
            { skin: 'sun_crown',      name: 'Radiant Solaris',         spriteCol: 3 },
        ],
    },

    // ─────────────────────── WEAPON ───────────────────────
    // 4 cols × 8 rows — Demon row at index 6 (skipped)
    weapon: {
        1: [
            { skin: 'iron_sword',     name: 'Rusty Blade',          spriteCol: 0 },
            { skin: 'wooden_club',    name: "Brute's Club",         spriteCol: 1 },
            { skin: 'worn_dagger',    name: 'Worn Dagger',          spriteCol: 2 },
            { skin: 'short_bow',      name: 'Crude Shortbow',       spriteCol: 3 },
        ],
        2: [
            { skin: 'steel_sword',    name: 'Militia Sword',        spriteCol: 0 },
            { skin: 'spiked_mace',    name: 'Iron Mace',            spriteCol: 1 },
            { skin: 'hunting_bow',    name: "Hunter's Bow",         spriteCol: 2 },
            { skin: 'battle_axe',     name: 'Cleaver Axe',          spriteCol: 3 },
        ],
        3: [
            { skin: 'longsword',      name: "Knight's Longsword",   spriteCol: 0 },
            { skin: 'war_axe',        name: 'Stormcleaver',         spriteCol: 1 },
            { skin: 'frost_blade',    name: 'Frostbite Edge',       spriteCol: 2 },
            { skin: 'crossbow',       name: 'Siege Crossbow',       spriteCol: 3 },
        ],
        4: [
            { skin: 'gem_sword',      name: 'Emerald Falchion',     spriteCol: 0 },
            { skin: 'frost_saber',    name: 'Glacial Saber',        spriteCol: 1 },
            { skin: 'void_staff',     name: 'Void Scepter',         spriteCol: 2 },
            { skin: 'ornate_dagger',  name: 'Twilight Stiletto',    spriteCol: 3 },
        ],
        5: [
            { skin: 'flame_sword',    name: 'Inferno Greatsword',   spriteCol: 0 },
            { skin: 'titan_hammer',   name: "Titan's Maul",         spriteCol: 1 },
            { skin: 'golden_blade',   name: 'Radiant Warblade',     spriteCol: 2 },
            { skin: 'pumpkin_scythe', name: 'Hallowed Reaper',      spriteCol: 3 },
        ],
        6: [
            { skin: 'dark_blade',     name: 'Abyssal Executioner',  spriteCol: 0 },
            { skin: 'crimson_dagger', name: 'Bloodfire Fang',       spriteCol: 1 },
            { skin: 'shadow_axe',     name: 'Ragnarok Cleaver',     spriteCol: 2 },
            { skin: 'death_scythe',   name: "Soulreaper's Edge",    spriteCol: 3 },
        ],
        7: [
            { skin: 'golden_sword',   name: 'Eternal Sunblade',     spriteCol: 0 },
            { skin: 'divine_staff',   name: 'Celestial Scepter',    spriteCol: 1 },
            { skin: 'holy_spear',     name: 'Radiant Trident',      spriteCol: 2 },
            { skin: 'astral_edge',    name: 'Astral Wingedge',      spriteCol: 3 },
        ],
    },

    // ─────────────────────── ARMOR ───────────────────────
    // 4 cols × 8 rows — Demon row at index 6 (skipped)
    armor: {
        1: [
            { skin: 'cloth_tunic',    name: 'Threadbare Tunic',     spriteCol: 0 },
            { skin: 'leather_vest',   name: "Tanner's Vest",        spriteCol: 1 },
            { skin: 'basic_mail',     name: 'Rusty Chainmail',      spriteCol: 2 },
            { skin: 'padded_shirt',   name: 'Padded Jerkin',        spriteCol: 3 },
        ],
        2: [
            { skin: 'green_tunic',    name: "Ranger's Tunic",       spriteCol: 0 },
            { skin: 'dark_vest',      name: 'Shadow Leather',       spriteCol: 1 },
            { skin: 'scale_mail',     name: 'Scale Hauberk',        spriteCol: 2 },
            { skin: 'brown_plate',    name: 'Bronze Cuirass',       spriteCol: 3 },
        ],
        3: [
            { skin: 'silver_plate',   name: 'Silver Breastplate',   spriteCol: 0 },
            { skin: 'blue_mail',      name: 'Cobalt Chainmail',     spriteCol: 1 },
            { skin: 'white_plate',    name: 'Ivory Guard',          spriteCol: 2 },
            { skin: 'purple_vest',    name: 'Amethyst Robe',        spriteCol: 3 },
        ],
        4: [
            { skin: 'golden_cuirass', name: 'Gilded Cuirass',       spriteCol: 0 },
            { skin: 'ornate_plate',   name: "Warden's Plate",       spriteCol: 1 },
            { skin: 'crimson_mail',   name: 'Crimson Aegis',        spriteCol: 2 },
            { skin: 'dark_ornate',    name: 'Nightfall Armor',      spriteCol: 3 },
        ],
        5: [
            { skin: 'heavy_gold',     name: 'Auric Warplate',       spriteCol: 0 },
            { skin: 'dark_plate',     name: 'Obsidian Bastion',     spriteCol: 1 },
            { skin: 'fire_plate',     name: 'Inferno Plate',        spriteCol: 2 },
            { skin: 'golden_guard',   name: 'Radiant Bulwark',      spriteCol: 3 },
        ],
        6: [
            { skin: 'abyssal_plate',  name: 'Abyssal Fortress',     spriteCol: 0 },
            { skin: 'void_armor',     name: 'Voidforged Mail',      spriteCol: 1 },
            { skin: 'blood_plate',    name: 'Bloodsteel Aegis',     spriteCol: 2 },
            { skin: 'shadow_guard',   name: 'Shadow Juggernaut',    spriteCol: 3 },
        ],
        7: [
            { skin: 'celestial_plate',  name: 'Celestial Warplate', spriteCol: 0 },
            { skin: 'divine_guard',     name: 'Divine Bulwark',     spriteCol: 1 },
            { skin: 'holy_cuirass',     name: 'Seraphic Bastion',   spriteCol: 2 },
            { skin: 'astral_armor',     name: 'Astral Fortress',    spriteCol: 3 },
        ],
    },

    // ─────────────────────── NECKLACE ───────────────────────
    // 4 cols × 8 rows — Demon row at index 6 (skipped)
    necklace: {
        1: [
            { skin: 'iron_torque',    name: 'Iron Torque',          spriteCol: 0 },
            { skin: 'silver_pendant', name: 'Pewter Pendant',       spriteCol: 1 },
            { skin: 'leather_cord',   name: 'Leather Talisman',     spriteCol: 2 },
            { skin: 'bone_choker',    name: 'Bone Choker',          spriteCol: 3 },
        ],
        2: [
            { skin: 'fang_pendant',   name: 'Wolf Fang',            spriteCol: 0 },
            { skin: 'clover_amulet',  name: 'Lucky Charm',          spriteCol: 1 },
            { skin: 'jade_pendant',   name: 'Jade Pendant',         spriteCol: 2 },
            { skin: 'tribal_band',    name: 'Tribal Circlet',       spriteCol: 3 },
        ],
        3: [
            { skin: 'crystal_tear',   name: 'Crystal Tear',         spriteCol: 0 },
            { skin: 'sapphire_locket', name: 'Sapphire Locket',     spriteCol: 1 },
            { skin: 'frost_choker',   name: 'Frostgem Choker',      spriteCol: 2 },
            { skin: 'azure_gaze',     name: 'Azure Gaze',           spriteCol: 3 },
        ],
        4: [
            { skin: 'amethyst_heart', name: 'Amethyst Heart',       spriteCol: 0 },
            { skin: 'twilight_medal', name: 'Twilight Medallion',   spriteCol: 1 },
            { skin: 'arcane_focus',   name: 'Arcane Focus',         spriteCol: 2 },
            { skin: 'voidstone',      name: 'Voidstone Pendant',    spriteCol: 3 },
        ],
        5: [
            { skin: 'fire_pendant',   name: 'Inferno Pendant',      spriteCol: 0 },
            { skin: 'sun_medallion',  name: 'Sun Medallion',        spriteCol: 1 },
            { skin: 'arclight_core',  name: 'Arclight Core',        spriteCol: 2 },
            { skin: 'pumpkin_amulet', name: 'Hallowed Talisman',    spriteCol: 3 },
        ],
        6: [
            { skin: 'demon_gaze',     name: "Demon's Gaze",         spriteCol: 0 },
            { skin: 'blood_amulet',   name: 'Bloodstone Heart',     spriteCol: 1 },
            { skin: 'oni_visage',     name: 'Oni Visage',            spriteCol: 2 },
            { skin: 'corsair_mark',   name: "Corsair's Mark",       spriteCol: 3 },
        ],
        7: [
            { skin: 'lunar_crescent', name: 'Lunar Crescent',       spriteCol: 0 },
            { skin: 'solar_radiance', name: 'Solar Radiance',       spriteCol: 1 },
            { skin: 'stellaris_neck', name: 'Stellaris Pendant',    spriteCol: 2 },
            { skin: 'divine_light',   name: 'Celestial Gleam',      spriteCol: 3 },
        ],
    },

    // ─────────────────────── RING ───────────────────────
    // 4 cols × 8 rows — Demon row at index 6 (skipped)
    ring: {
        1: [
            { skin: 'plain_band',     name: 'Plain Band',           spriteCol: 0 },
            { skin: 'crystal_signet', name: 'Crystal Signet',       spriteCol: 1 },
            { skin: 'silver_ring',    name: 'Silver Ring',          spriteCol: 2 },
            { skin: 'iron_ring',      name: 'Iron Ring',            spriteCol: 3 },
        ],
        2: [
            { skin: 'emerald_ring',   name: 'Emerald Ring',         spriteCol: 0 },
            { skin: 'jade_signet',    name: 'Jade Signet',          spriteCol: 1 },
            { skin: 'verdant_band',   name: 'Verdant Band',         spriteCol: 2 },
            { skin: 'peridot_ring',   name: 'Peridot Ring',         spriteCol: 3 },
        ],
        3: [
            { skin: 'sapphire_ring',  name: 'Sapphire Ring',        spriteCol: 0 },
            { skin: 'azure_band',     name: 'Azure Band',           spriteCol: 1 },
            { skin: 'aqua_ring',      name: 'Aquamarine Ring',      spriteCol: 2 },
            { skin: 'frostfire_ring', name: 'Frostfire Ring',       spriteCol: 3 },
        ],
        4: [
            { skin: 'amethyst_ring',  name: 'Amethyst Ring',        spriteCol: 0 },
            { skin: 'rune_band',      name: 'Runic Band',           spriteCol: 1 },
            { skin: 'teardrop_ring',  name: 'Teardrop Gem',         spriteCol: 2 },
            { skin: 'twilight_ring',  name: 'Twilight Signet',      spriteCol: 3 },
        ],
        5: [
            { skin: 'inferno_gem',    name: 'Inferno Gem',          spriteCol: 0 },
            { skin: 'lion_signet',    name: "Lion's Signet",        spriteCol: 1 },
            { skin: 'arclight_ring',  name: 'Arclight Ring',        spriteCol: 2 },
            { skin: 'pumpkin_ring',   name: 'Hallowed Band',        spriteCol: 3 },
        ],
        6: [
            { skin: 'demon_eye_ring', name: 'Demon Eye Ring',       spriteCol: 0 },
            { skin: 'bloodruby',      name: 'Bloodruby Signet',     spriteCol: 1 },
            { skin: 'hellhorn_band',  name: 'Hellhorn Band',        spriteCol: 2 },
            { skin: 'skull_ring',     name: "Corsair's Ring",       spriteCol: 3 },
        ],
        7: [
            { skin: 'seraph_ring',    name: "Seraph's Ring",        spriteCol: 0 },
            { skin: 'solar_ring',     name: 'Solar Ring',           spriteCol: 1 },
            { skin: 'stellaris_ring', name: 'Stellaris Band',       spriteCol: 2 },
            { skin: 'divine_ring',    name: 'Celestial Ring',       spriteCol: 3 },
        ],
    },

    // ─────────────────────── GLOVES ───────────────────────
    // 5 cols × 8 rows — Demon row at index 6 (skipped)
    gloves: {
        1: [
            { skin: 'cloth_wraps',     name: 'Cloth Wraps',         spriteCol: 0 },
            { skin: 'leather_grips',   name: 'Leather Grips',       spriteCol: 1 },
            { skin: 'dark_gloves',     name: "Worker's Gloves",     spriteCol: 2 },
            { skin: 'green_mitts',     name: 'Forester Mitts',      spriteCol: 3 },
            { skin: 'worn_gauntlets',  name: 'Worn Gauntlets',      spriteCol: 4 },
        ],
        2: [
            { skin: 'studded_grips',   name: 'Studded Grips',       spriteCol: 0 },
            { skin: 'mystic_gloves',   name: 'Mystic Gloves',       spriteCol: 1 },
            { skin: 'steel_gauntlets', name: 'Steel Gauntlets',     spriteCol: 2 },
            { skin: 'reinforced_mitts', name: 'Reinforced Mitts',   spriteCol: 3 },
            { skin: 'frost_gauntlets', name: 'Frost Gauntlets',     spriteCol: 4 },
        ],
        3: [
            { skin: 'fur_grips',       name: 'Fur-Lined Grips',     spriteCol: 0 },
            { skin: 'gilded_gauntlets', name: 'Gilded Gauntlets',   spriteCol: 1 },
            { skin: 'emblem_gloves',   name: 'Royal Gloves',        spriteCol: 2 },
            { skin: 'crimson_fists',   name: 'Crimson Fists',       spriteCol: 3 },
            { skin: 'silver_vambrace', name: 'Silver Vambrace',     spriteCol: 4 },
        ],
        4: [
            { skin: 'shadow_grips',    name: 'Shadow Grips',        spriteCol: 0 },
            { skin: 'warden_gauntlets', name: "Warden's Gauntlets", spriteCol: 1 },
            { skin: 'arcane_gauntlets', name: 'Arcane Gauntlets',   spriteCol: 2 },
            { skin: 'crimson_guard',   name: 'Crimson Guard',       spriteCol: 3 },
            { skin: 'voidtouch',       name: 'Voidtouch Gloves',    spriteCol: 4 },
        ],
        5: [
            { skin: 'obsidian_claws',  name: 'Obsidian Claws',      spriteCol: 0 },
            { skin: 'inferno_claws',   name: 'Inferno Claws',       spriteCol: 1 },
            { skin: 'titan_fists',     name: 'Titan Fists',         spriteCol: 2 },
            { skin: 'arclight_gaunt',  name: 'Arclight Gauntlets',  spriteCol: 3 },
            { skin: 'pumpkin_grips',   name: 'Hallowed Grips',      spriteCol: 4 },
        ],
        6: [
            { skin: 'abyssal_claws',   name: 'Abyssal Claws',      spriteCol: 0 },
            { skin: 'bloodsteel_fists', name: 'Bloodsteel Fists',   spriteCol: 1 },
            { skin: 'deathgrip',       name: 'Deathgrip Gauntlets', spriteCol: 2 },
            { skin: 'corsair_gloves',  name: "Corsair's Gauntlets", spriteCol: 3 },
            { skin: 'mythic_vambrace', name: 'Mythic Vambrace',     spriteCol: 4 },
        ],
        7: [
            { skin: 'celestial_grips', name: 'Celestial Grips',     spriteCol: 0 },
            { skin: 'solar_gauntlets', name: 'Solar Gauntlets',     spriteCol: 1 },
            { skin: 'stellaris_fists', name: 'Stellaris Fists',     spriteCol: 2 },
            { skin: 'divine_vambrace', name: 'Divine Vambrace',     spriteCol: 3 },
            { skin: 'seraphic_gaunt',  name: 'Seraphic Gauntlets',  spriteCol: 4 },
        ],
    },

    // ─────────────────────── BELT ───────────────────────
    // 4 cols × 8 rows — Demon row at index 6 (skipped)
    belt: {
        1: [
            { skin: 'leather_strap',   name: 'Leather Strap',       spriteCol: 0 },
            { skin: 'iron_buckle',     name: 'Iron Buckle Belt',    spriteCol: 1 },
            { skin: 'dark_cinch',      name: 'Worn Cinch',          spriteCol: 2 },
            { skin: 'rope_cord',       name: 'Rope Cord',           spriteCol: 3 },
        ],
        2: [
            { skin: 'ranger_belt',     name: "Ranger's Belt",       spriteCol: 0 },
            { skin: 'verdant_sash',    name: 'Verdant Sash',        spriteCol: 1 },
            { skin: 'studded_girdle',  name: 'Studded Girdle',      spriteCol: 2 },
            { skin: 'brass_buckle',    name: 'Brass Buckle',        spriteCol: 3 },
        ],
        3: [
            { skin: 'warden_girdle',   name: "Warden's Girdle",     spriteCol: 0 },
            { skin: 'silver_cincture', name: 'Silver Cincture',     spriteCol: 1 },
            { skin: 'emerald_sash',    name: 'Emerald Sash',        spriteCol: 2 },
            { skin: 'starweave_belt',  name: 'Starweave Belt',      spriteCol: 3 },
        ],
        4: [
            { skin: 'amethyst_girdle', name: 'Amethyst Girdle',     spriteCol: 0 },
            { skin: 'royal_sash',      name: 'Royal Sash',          spriteCol: 1 },
            { skin: 'arcane_cincture', name: 'Arcane Cincture',     spriteCol: 2 },
            { skin: 'twilight_belt',   name: 'Twilight Belt',       spriteCol: 3 },
        ],
        5: [
            { skin: 'inferno_girdle',  name: 'Inferno Girdle',      spriteCol: 0 },
            { skin: 'ember_sash',      name: 'Ember Sash',          spriteCol: 1 },
            { skin: 'obsidian_cinch',  name: 'Obsidian Cincture',   spriteCol: 2 },
            { skin: 'pumpkin_belt',    name: 'Hallowed Girdle',     spriteCol: 3 },
        ],
        6: [
            { skin: 'abyssal_girdle',  name: 'Abyssal Girdle',      spriteCol: 0 },
            { skin: 'bloodforge_belt', name: 'Bloodforge Belt',     spriteCol: 1 },
            { skin: 'demoneye_sash',   name: 'Demon Eye Sash',      spriteCol: 2 },
            { skin: 'corsair_cinch',   name: "Corsair's Cincture",  spriteCol: 3 },
        ],
        7: [
            { skin: 'solar_girdle',    name: 'Solar Girdle',        spriteCol: 0 },
            { skin: 'celestial_sash',  name: 'Celestial Sash',      spriteCol: 1 },
            { skin: 'stellaris_belt',  name: 'Stellaris Belt',      spriteCol: 2 },
            { skin: 'seraphic_cinch',  name: 'Seraphic Cincture',   spriteCol: 3 },
        ],
    },

    // ─────────────────────── BOOTS ───────────────────────
    // 5 cols × 8 rows — Demon row at index 6 (skipped)
    boots: {
        1: [
            { skin: 'worn_sandals',    name: 'Worn Sandals',        spriteCol: 0 },
            { skin: 'leather_treads',  name: 'Leather Treads',      spriteCol: 1 },
            { skin: 'traveler_boots',  name: "Traveler's Boots",    spriteCol: 2 },
            { skin: 'muddy_boots',     name: 'Muddy Boots',         spriteCol: 3 },
            { skin: 'copper_greaves',  name: 'Copper Greaves',      spriteCol: 4 },
        ],
        2: [
            { skin: 'fur_boots',       name: 'Fur-Lined Boots',     spriteCol: 0 },
            { skin: 'padded_treads',   name: 'Padded Treads',       spriteCol: 1 },
            { skin: 'ranger_boots',    name: "Ranger's Boots",      spriteCol: 2 },
            { skin: 'buckled_boots',   name: 'Buckled Boots',       spriteCol: 3 },
            { skin: 'verdant_greaves', name: 'Verdant Greaves',     spriteCol: 4 },
        ],
        3: [
            { skin: 'silver_greaves',  name: 'Silver Greaves',      spriteCol: 0 },
            { skin: 'armored_treads',  name: 'Armored Treads',      spriteCol: 1 },
            { skin: 'cobalt_sabatons', name: 'Cobalt Sabatons',     spriteCol: 2 },
            { skin: 'emerald_greaves', name: 'Emerald Greaves',     spriteCol: 3 },
            { skin: 'jade_sabatons',   name: 'Jade Sabatons',       spriteCol: 4 },
        ],
        4: [
            { skin: 'azure_sabatons',  name: 'Azure Sabatons',      spriteCol: 0 },
            { skin: 'frost_greaves',   name: 'Frost Greaves',       spriteCol: 1 },
            { skin: 'icebound_treads', name: 'Icebound Treads',     spriteCol: 2 },
            { skin: 'shadow_sabatons', name: 'Shadow Sabatons',     spriteCol: 3 },
            { skin: 'nightfall_greaves', name: 'Nightfall Greaves', spriteCol: 4 },
        ],
        5: [
            { skin: 'gilded_sabatons', name: 'Gilded Sabatons',     spriteCol: 0 },
            { skin: 'inferno_treads',  name: 'Inferno Treads',      spriteCol: 1 },
            { skin: 'obsidian_boots',  name: 'Obsidian Warboots',   spriteCol: 2 },
            { skin: 'arcane_greaves',  name: 'Arcane Greaves',      spriteCol: 3 },
            { skin: 'twilight_sabatons', name: 'Twilight Sabatons', spriteCol: 4 },
        ],
        6: [
            { skin: 'abyssal_treads',  name: 'Abyssal Treads',      spriteCol: 0 },
            { skin: 'hellfire_sabatons', name: 'Hellfire Sabatons',  spriteCol: 1 },
            { skin: 'voidstep_boots',  name: 'Voidstep Boots',      spriteCol: 2 },
            { skin: 'deathmarch',      name: 'Deathmarch Boots',    spriteCol: 3 },
            { skin: 'pumpkin_boots',   name: 'Hallowed Greaves',    spriteCol: 4 },
        ],
        7: [
            { skin: 'celestial_treads', name: 'Celestial Treads',   spriteCol: 0 },
            { skin: 'solar_sabatons',  name: 'Solar Sabatons',      spriteCol: 1 },
            { skin: 'stellaris_boots', name: 'Stellaris Boots',     spriteCol: 2 },
            { skin: 'divine_greaves',  name: 'Divine Greaves',      spriteCol: 3 },
            { skin: 'seraphic_treads', name: 'Seraphic Treads',     spriteCol: 4 },
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
 * Returns a CSS string or empty string if no sprite data is available.
 *
 * Handles sheets that have a "Demon" row (index 6) the game doesn't use:
 * when `tierToRow` is defined, it remaps tier → actual row.
 */
export function getSpriteStyle(type, tier, spriteCol) {
    const sheet = SPRITE_SHEETS[type];
    if (!sheet || spriteCol == null) return '';

    const row = sheet.tierToRow ? sheet.tierToRow[tier - 1] : tier - 1;
    const xPct = sheet.cols > 1 ? (spriteCol / (sheet.cols - 1)) * 100 : 0;
    const yPct = sheet.rows > 1 ? (row / (sheet.rows - 1)) * 100 : 0;

    return `background-image: url(${sheet.file}); background-size: ${sheet.cols * 100}% ${sheet.rows * 100}%; background-position: ${xPct}% ${yPct}%; background-repeat: no-repeat;`;
}
