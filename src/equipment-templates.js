// Equipment templates: loaded from the database via API, with hardcoded fallback.
//
// On startup, loadTemplatesFromAPI() is called to fetch the latest templates
// from the server. If the API is unavailable (offline/guest mode), the
// hardcoded FALLBACK data is used instead.
//
// The public API is unchanged: pickTemplate(), getSpriteStyle(), SPRITE_SHEETS,
// and EQUIPMENT_TEMPLATES all work identically to before.

// ── Hardcoded fallback data (used when API is unavailable) ────────
const FALLBACK_SPRITE_SHEETS = {
    hat:         { file: '/assets/helmets.png', width: 1024, height: 1536 },
    weapon:      { file: '/assets/weapons.png', width: 1024, height: 1536 },
    armor:       { file: '/assets/armors.png', width: 1024, height: 1536 },
    necklace:    { file: '/assets/necklaces.png', width: 1024, height: 1536 },
    ring:        { file: '/assets/rings.png', width: 1024, height: 1536 },
    gloves:      { file: '/assets/gloves.png', width: 1024, height: 1536 },
    belt:        { file: '/assets/belts.png', width: 1024, height: 1536 },
    boots:       { file: '/assets/boots.png', width: 1024, height: 1536 },
};

const FALLBACK_TEMPLATES = {
    hat: {
        1: [
            { skin: 'flat_cap', name: "Wanderer's Cap", sprite: { x: 99, y: 93, w: 149, h: 66 } },
            { skin: 'baseball_cap', name: "Rookie's Cover", sprite: { x: 285, y: 71, w: 192, h: 96 } },
            { skin: 'beanie', name: 'Wool Coif', sprite: { x: 527, y: 61, w: 161, h: 123 } },
            { skin: 'hard_hat', name: "Ironworker's Helm", sprite: { x: 776, y: 68, w: 143, h: 103 } },
        ],
        2: [
            { skin: 'headband', name: "Scout's Headband", sprite: { x: 97, y: 253, w: 151, h: 61 } },
            { skin: 'devil_horns', name: "Imp's Crest", sprite: { x: 312, y: 228, w: 163, h: 105 } },
            { skin: 'ninja_mask', name: 'Shadow Veil', sprite: { x: 520, y: 256, w: 176, h: 71 } },
            { skin: 'propeller_cap', name: "Tinker's Whimsy", sprite: { x: 776, y: 230, w: 119, h: 105 } },
        ],
        3: [
            { skin: 'halo', name: "Seraph's Grace", sprite: { x: 97, y: 406, w: 151, h: 54 } },
            { skin: 'cowboy_hat', name: 'Frontier Warden', sprite: { x: 289, y: 392, w: 206, h: 89 } },
            { skin: 'viking_helmet', name: 'Nordheim Warhelm', sprite: { x: 521, y: 392, w: 167, h: 106 } },
            { skin: 'masquerade', name: 'Phantom Visage', sprite: { x: 776, y: 392, w: 131, h: 115 } },
        ],
        4: [
            { skin: 'royal_crown', name: "Sovereign's Diadem", sprite: { x: 98, y: 584, w: 150, h: 79 } },
            { skin: 'samurai_kabuto', name: "Shogun's Kabuto", sprite: { x: 295, y: 584, w: 196, h: 93 } },
            { skin: 'racing_helmet', name: 'Velocity Aegis', sprite: { x: 520, y: 584, w: 171, h: 84 } },
            { skin: 'wizard_hat', name: "Archmage's Spire", sprite: { x: 776, y: 584, w: 133, h: 84 } },
        ],
        5: [
            { skin: 'knight_helmet', name: 'Obsidian Juggernaut', sprite: { x: 105, y: 776, w: 143, h: 76 } },
            { skin: 'fire_crown', name: 'Inferno Crown', sprite: { x: 305, y: 868, w: 172, h: 84 } },
            { skin: 'astronaut_helmet', name: "Voidwalker's Dome", sprite: { x: 520, y: 776, w: 164, h: 74 } },
            { skin: 'pumpkin_head', name: 'Hallowed Dread', sprite: { x: 776, y: 872, w: 156, h: 80 } },
        ],
        6: [
            { skin: 'demon_crown', name: 'Abyssal Coronet', sprite: { x: 98, y: 1019, w: 150, h: 107 } },
            { skin: 'ice_crown', name: 'Frostborne Regalia', sprite: { x: 302, y: 1023, w: 184, h: 112 } },
            { skin: 'horned_viking', name: 'Ragnarok Warhelm', sprite: { x: 520, y: 1013, w: 176, h: 124 } },
            { skin: 'pirate_hat', name: "Dread Captain's Tricorn", sprite: { x: 776, y: 1030, w: 147, h: 88 } },
        ],
        7: [
            { skin: 'golden_crown', name: "Eternal Monarch's Crown", sprite: { x: 303, y: 1169, w: 184, h: 100 } },
            { skin: 'divine_halo', name: 'Celestial Aureole', sprite: { x: 520, y: 1171, w: 182, h: 106 } },
        ],
    },
    weapon: {
        1: [
            { skin: 'iron_sword', name: 'Rusty Blade', sprite: { x: 76, y: 63, w: 138, h: 121 } },
            { skin: 'wooden_club', name: "Brute's Club", sprite: { x: 311, y: 59, w: 144, h: 125 } },
            { skin: 'worn_dagger', name: 'Worn Dagger', sprite: { x: 520, y: 66, w: 136, h: 118 } },
            { skin: 'short_bow', name: 'Crude Shortbow', sprite: { x: 783, y: 63, w: 160, h: 121 } },
        ],
        2: [
            { skin: 'steel_sword', name: 'Militia Sword', sprite: { x: 71, y: 261, w: 150, h: 115 } },
            { skin: 'spiked_mace', name: 'Iron Mace', sprite: { x: 310, y: 259, w: 139, h: 117 } },
            { skin: 'hunting_bow', name: "Hunter's Bow", sprite: { x: 520, y: 269, w: 159, h: 107 } },
            { skin: 'battle_axe', name: 'Cleaver Axe', sprite: { x: 803, y: 270, w: 151, h: 106 } },
        ],
        3: [
            { skin: 'longsword', name: "Knight's Longsword", sprite: { x: 84, y: 466, w: 137, h: 102 } },
            { skin: 'war_axe', name: 'Stormcleaver', sprite: { x: 305, y: 467, w: 140, h: 101 } },
            { skin: 'frost_blade', name: 'Frostbite Edge', sprite: { x: 539, y: 466, w: 137, h: 102 } },
            { skin: 'crossbow', name: 'Siege Crossbow', sprite: { x: 777, y: 481, w: 181, h: 87 } },
        ],
        4: [
            { skin: 'gem_sword', name: 'Emerald Falchion', sprite: { x: 77, y: 672, w: 146, h: 88 } },
            { skin: 'frost_saber', name: 'Glacial Saber', sprite: { x: 309, y: 670, w: 144, h: 90 } },
            { skin: 'void_staff', name: 'Void Scepter', sprite: { x: 554, y: 674, w: 93, h: 86 } },
            { skin: 'ornate_dagger', name: 'Twilight Stiletto', sprite: { x: 810, y: 683, w: 141, h: 77 } },
        ],
        5: [
            { skin: 'flame_sword', name: 'Inferno Greatsword', sprite: { x: 79, y: 871, w: 146, h: 81 } },
            { skin: 'titan_hammer', name: "Titan's Maul", sprite: { x: 297, y: 882, w: 161, h: 70 } },
            { skin: 'golden_blade', name: 'Radiant Warblade', sprite: { x: 547, y: 868, w: 138, h: 84 } },
            { skin: 'pumpkin_scythe', name: 'Hallowed Reaper', sprite: { x: 779, y: 885, w: 189, h: 67 } },
        ],
        6: [
            { skin: 'dark_blade', name: 'Abyssal Executioner', sprite: { x: 108, y: 1071, w: 121, h: 73 } },
            { skin: 'crimson_dagger', name: 'Bloodfire Fang', sprite: { x: 333, y: 1071, w: 127, h: 73 } },
            { skin: 'shadow_axe', name: 'Ragnarok Cleaver', sprite: { x: 520, y: 1073, w: 160, h: 71 } },
            { skin: 'death_scythe', name: "Soulreaper's Edge", sprite: { x: 823, y: 1082, w: 143, h: 62 } },
        ],
        7: [
            { skin: 'golden_sword', name: 'Eternal Sunblade', sprite: { x: 46, y: 1352, w: 134, h: 82 } },
            { skin: 'divine_staff', name: 'Celestial Scepter', sprite: { x: 289, y: 1352, w: 142, h: 87 } },
            { skin: 'holy_spear', name: 'Radiant Trident', sprite: { x: 522, y: 1352, w: 129, h: 87 } },
            { skin: 'astral_edge', name: 'Astral Wingedge', sprite: { x: 779, y: 1352, w: 140, h: 87 } },
        ],
    },
    armor: {
        1: [{ skin: 'cloth_tunic', name: 'Threadbare Tunic', sprite: { x: 54, y: 39, w: 168, h: 145 } }, { skin: 'leather_vest', name: "Tanner's Vest", sprite: { x: 264, y: 38, w: 143, h: 146 } }, { skin: 'basic_mail', name: 'Rusty Chainmail', sprite: { x: 615, y: 36, w: 145, h: 148 } }, { skin: 'padded_shirt', name: 'Padded Jerkin', sprite: { x: 791, y: 36, w: 174, h: 148 } }],
        2: [{ skin: 'green_tunic', name: "Ranger's Tunic", sprite: { x: 48, y: 211, w: 179, h: 158 } }, { skin: 'dark_vest', name: 'Shadow Leather', sprite: { x: 264, y: 210, w: 147, h: 157 } }, { skin: 'scale_mail', name: 'Scale Hauberk', sprite: { x: 609, y: 209, w: 151, h: 160 } }, { skin: 'brown_plate', name: 'Bronze Cuirass', sprite: { x: 787, y: 208, w: 183, h: 162 } }],
        3: [{ skin: 'silver_plate', name: 'Silver Breastplate', sprite: { x: 53, y: 392, w: 175, h: 153 } }, { skin: 'blue_mail', name: 'Cobalt Chainmail', sprite: { x: 264, y: 392, w: 148, h: 152 } }, { skin: 'white_plate', name: 'Ivory Guard', sprite: { x: 610, y: 392, w: 150, h: 153 } }, { skin: 'purple_vest', name: 'Amethyst Robe', sprite: { x: 790, y: 392, w: 184, h: 154 } }],
        4: [{ skin: 'golden_cuirass', name: 'Gilded Cuirass', sprite: { x: 43, y: 584, w: 198, h: 141 } }, { skin: 'ornate_plate', name: "Warden's Plate", sprite: { x: 264, y: 584, w: 158, h: 137 } }, { skin: 'crimson_mail', name: 'Crimson Aegis', sprite: { x: 604, y: 584, w: 156, h: 137 } }, { skin: 'dark_ornate', name: 'Nightfall Armor', sprite: { x: 789, y: 584, w: 193, h: 138 } }],
        5: [{ skin: 'heavy_gold', name: 'Auric Warplate', sprite: { x: 45, y: 776, w: 194, h: 127 } }, { skin: 'dark_plate', name: 'Obsidian Bastion', sprite: { x: 264, y: 776, w: 155, h: 127 } }, { skin: 'fire_plate', name: 'Inferno Plate', sprite: { x: 605, y: 776, w: 155, h: 121 } }, { skin: 'golden_guard', name: 'Radiant Bulwark', sprite: { x: 794, y: 776, w: 187, h: 123 } }],
        6: [{ skin: 'abyssal_plate', name: 'Abyssal Fortress', sprite: { x: 43, y: 968, w: 193, h: 110 } }, { skin: 'void_armor', name: 'Voidforged Mail', sprite: { x: 264, y: 968, w: 159, h: 111 } }, { skin: 'blood_plate', name: 'Bloodsteel Aegis', sprite: { x: 609, y: 968, w: 151, h: 113 } }, { skin: 'shadow_guard', name: 'Shadow Juggernaut', sprite: { x: 795, y: 968, w: 193, h: 113 } }],
        7: [{ skin: 'celestial_plate', name: 'Celestial Warplate', sprite: { x: 46, y: 1160, w: 194, h: 98 } }, { skin: 'divine_guard', name: 'Divine Bulwark', sprite: { x: 264, y: 1160, w: 158, h: 97 } }, { skin: 'holy_cuirass', name: 'Seraphic Bastion', sprite: { x: 609, y: 1160, w: 151, h: 95 } }, { skin: 'astral_armor', name: 'Astral Fortress', sprite: { x: 799, y: 1160, w: 186, h: 100 } }],
    },
    necklace: {
        1: [{ skin: 'iron_torque', name: 'Iron Torque', sprite: { x: 66, y: 94, w: 176, h: 80 } }, { skin: 'silver_pendant', name: 'Pewter Pendant', sprite: { x: 289, y: 92, w: 187, h: 92 } }, { skin: 'leather_cord', name: 'Leather Talisman', sprite: { x: 527, y: 94, w: 192, h: 90 } }, { skin: 'bone_choker', name: 'Bone Choker', sprite: { x: 776, y: 92, w: 190, h: 92 } }],
        2: [{ skin: 'fang_pendant', name: 'Wolf Fang', sprite: { x: 63, y: 270, w: 185, h: 73 } }, { skin: 'clover_amulet', name: 'Lucky Charm', sprite: { x: 288, y: 265, w: 194, h: 111 } }, { skin: 'jade_pendant', name: 'Jade Pendant', sprite: { x: 533, y: 268, w: 195, h: 108 } }, { skin: 'tribal_band', name: 'Tribal Circlet', sprite: { x: 776, y: 269, w: 192, h: 95 } }],
        3: [{ skin: 'crystal_tear', name: 'Crystal Tear', sprite: { x: 64, y: 462, w: 183, h: 106 } }, { skin: 'sapphire_locket', name: 'Sapphire Locket', sprite: { x: 287, y: 461, w: 197, h: 107 } }, { skin: 'frost_choker', name: 'Frostgem Choker', sprite: { x: 526, y: 461, w: 201, h: 107 } }, { skin: 'azure_gaze', name: 'Azure Gaze', sprite: { x: 776, y: 461, w: 191, h: 107 } }],
        4: [{ skin: 'amethyst_heart', name: 'Amethyst Heart', sprite: { x: 64, y: 667, w: 184, h: 93 } }, { skin: 'twilight_medal', name: 'Twilight Medallion', sprite: { x: 287, y: 665, w: 194, h: 95 } }, { skin: 'arcane_focus', name: 'Arcane Focus', sprite: { x: 525, y: 664, w: 206, h: 96 } }, { skin: 'voidstone', name: 'Voidstone Pendant', sprite: { x: 776, y: 666, w: 193, h: 94 } }],
        5: [{ skin: 'fire_pendant', name: 'Inferno Pendant', sprite: { x: 63, y: 862, w: 184, h: 90 } }, { skin: 'sun_medallion', name: 'Sun Medallion', sprite: { x: 291, y: 860, w: 195, h: 92 } }, { skin: 'arclight_core', name: 'Arclight Core', sprite: { x: 524, y: 860, w: 203, h: 92 } }, { skin: 'pumpkin_amulet', name: 'Hallowed Talisman', sprite: { x: 776, y: 860, w: 190, h: 92 } }],
        6: [{ skin: 'demon_gaze', name: "Demon's Gaze", sprite: { x: 63, y: 1051, w: 185, h: 93 } }, { skin: 'blood_amulet', name: 'Bloodstone Heart', sprite: { x: 286, y: 1050, w: 190, h: 94 } }, { skin: 'oni_visage', name: 'Oni Visage', sprite: { x: 524, y: 1049, w: 199, h: 95 } }, { skin: 'corsair_mark', name: "Corsair's Mark", sprite: { x: 776, y: 1048, w: 188, h: 96 } }],
        7: [{ skin: 'lunar_crescent', name: 'Lunar Crescent', sprite: { x: 61, y: 1241, w: 187, h: 95 } }, { skin: 'solar_radiance', name: 'Solar Radiance', sprite: { x: 287, y: 1241, w: 190, h: 95 } }, { skin: 'stellaris_neck', name: 'Stellaris Pendant', sprite: { x: 524, y: 1240, w: 197, h: 96 } }, { skin: 'divine_light', name: 'Celestial Gleam', sprite: { x: 776, y: 1241, w: 189, h: 95 } }],
    },
    ring: {
        1: [{ skin: 'plain_band', name: 'Plain Band', sprite: { x: 71, y: 76, w: 148, h: 91 } }, { skin: 'crystal_signet', name: 'Crystal Signet', sprite: { x: 280, y: 76, w: 152, h: 102 } }, { skin: 'silver_ring', name: 'Silver Ring', sprite: { x: 520, y: 76, w: 121, h: 97 } }, { skin: 'iron_ring', name: 'Iron Ring', sprite: { x: 776, y: 76, w: 68, h: 93 } }],
        2: [{ skin: 'emerald_ring', name: 'Emerald Ring', sprite: { x: 71, y: 228, w: 160, h: 93 } }, { skin: 'jade_signet', name: 'Jade Signet', sprite: { x: 278, y: 228, w: 161, h: 106 } }, { skin: 'verdant_band', name: 'Verdant Band', sprite: { x: 520, y: 227, w: 124, h: 96 } }, { skin: 'peridot_ring', name: 'Peridot Ring', sprite: { x: 776, y: 227, w: 80, h: 92 } }],
        3: [{ skin: 'sapphire_ring', name: 'Sapphire Ring', sprite: { x: 68, y: 392, w: 162, h: 102 } }, { skin: 'azure_band', name: 'Azure Band', sprite: { x: 271, y: 392, w: 166, h: 88 } }, { skin: 'aqua_ring', name: 'Aquamarine Ring', sprite: { x: 520, y: 392, w: 127, h: 87 } }, { skin: 'frostfire_ring', name: 'Frostfire Ring', sprite: { x: 776, y: 392, w: 78, h: 81 } }],
        4: [{ skin: 'amethyst_ring', name: 'Amethyst Ring', sprite: { x: 70, y: 687, w: 168, h: 73 } }, { skin: 'rune_band', name: 'Runic Band', sprite: { x: 272, y: 698, w: 174, h: 62 } }, { skin: 'teardrop_ring', name: 'Teardrop Gem', sprite: { x: 520, y: 687, w: 128, h: 73 } }, { skin: 'twilight_ring', name: 'Twilight Signet', sprite: { x: 776, y: 685, w: 80, h: 75 } }],
        5: [{ skin: 'inferno_gem', name: 'Inferno Gem', sprite: { x: 67, y: 838, w: 168, h: 114 } }, { skin: 'lion_signet', name: "Lion's Signet", sprite: { x: 274, y: 845, w: 174, h: 107 } }, { skin: 'arclight_ring', name: 'Arclight Ring', sprite: { x: 520, y: 847, w: 129, h: 105 } }, { skin: 'pumpkin_ring', name: 'Hallowed Band', sprite: { x: 776, y: 847, w: 82, h: 105 } }],
        6: [{ skin: 'demon_eye_ring', name: 'Demon Eye Ring', sprite: { x: 67, y: 996, w: 180, h: 115 } }, { skin: 'bloodruby', name: 'Bloodruby Signet', sprite: { x: 273, y: 984, w: 173, h: 135 } }, { skin: 'hellhorn_band', name: 'Hellhorn Band', sprite: { x: 520, y: 991, w: 132, h: 131 } }, { skin: 'skull_ring', name: "Corsair's Ring", sprite: { x: 776, y: 993, w: 78, h: 113 } }],
        7: [{ skin: 'seraph_ring', name: "Seraph's Ring", sprite: { x: 70, y: 1160, w: 175, h: 105 } }, { skin: 'solar_ring', name: 'Solar Ring', sprite: { x: 273, y: 1160, w: 172, h: 109 } }, { skin: 'stellaris_ring', name: 'Stellaris Band', sprite: { x: 520, y: 1160, w: 131, h: 106 } }, { skin: 'divine_ring', name: 'Celestial Ring', sprite: { x: 776, y: 1160, w: 79, h: 92 } }],
    },
    gloves: {
        1: [{ skin: 'cloth_wraps', name: 'Cloth Wraps', sprite: { x: 30, y: 94, w: 159, h: 90 } }, { skin: 'leather_grips', name: 'Leather Grips', sprite: { x: 236, y: 95, w: 148, h: 89 } }, { skin: 'dark_gloves', name: "Worker's Gloves", sprite: { x: 428, y: 94, w: 159, h: 90 } }, { skin: 'green_mitts', name: 'Forester Mitts', sprite: { x: 624, y: 93, w: 161, h: 91 } }, { skin: 'worn_gauntlets', name: 'Worn Gauntlets', sprite: { x: 827, y: 94, w: 161, h: 90 } }],
        2: [{ skin: 'studded_grips', name: 'Studded Grips', sprite: { x: 31, y: 304, w: 165, h: 72 } }, { skin: 'mystic_gloves', name: 'Mystic Gloves', sprite: { x: 227, y: 302, w: 160, h: 74 } }, { skin: 'steel_gauntlets', name: 'Steel Gauntlets', sprite: { x: 424, y: 302, w: 160, h: 74 } }, { skin: 'reinforced_mitts', name: 'Reinforced Mitts', sprite: { x: 622, y: 303, w: 159, h: 73 } }, { skin: 'frost_gauntlets', name: 'Frost Gauntlets', sprite: { x: 827, y: 305, w: 161, h: 71 } }],
        3: [{ skin: 'fur_grips', name: 'Fur-Lined Grips', sprite: { x: 28, y: 508, w: 168, h: 60 } }, { skin: 'gilded_gauntlets', name: 'Gilded Gauntlets', sprite: { x: 229, y: 506, w: 161, h: 62 } }, { skin: 'emblem_gloves', name: 'Royal Gloves', sprite: { x: 422, y: 507, w: 163, h: 61 } }, { skin: 'crimson_fists', name: 'Crimson Fists', sprite: { x: 622, y: 508, w: 161, h: 60 } }, { skin: 'silver_vambrace', name: 'Silver Vambrace', sprite: { x: 827, y: 506, w: 160, h: 62 } }],
        4: [{ skin: 'shadow_grips', name: 'Shadow Grips', sprite: { x: 30, y: 584, w: 162, h: 46 } }, { skin: 'warden_gauntlets', name: "Warden's Gauntlets", sprite: { x: 230, y: 584, w: 156, h: 49 } }, { skin: 'arcane_gauntlets', name: 'Arcane Gauntlets', sprite: { x: 424, y: 584, w: 155, h: 48 } }, { skin: 'crimson_guard', name: 'Crimson Guard', sprite: { x: 622, y: 584, w: 157, h: 47 } }, { skin: 'voidtouch', name: 'Voidtouch Gloves', sprite: { x: 827, y: 584, w: 155, h: 46 } }],
        5: [{ skin: 'obsidian_claws', name: 'Obsidian Claws', sprite: { x: 30, y: 776, w: 167, h: 61 } }, { skin: 'inferno_claws', name: 'Inferno Claws', sprite: { x: 231, y: 776, w: 167, h: 66 } }, { skin: 'titan_fists', name: 'Titan Fists', sprite: { x: 422, y: 776, w: 168, h: 64 } }, { skin: 'arclight_gaunt', name: 'Arclight Gauntlets', sprite: { x: 622, y: 776, w: 166, h: 64 } }, { skin: 'pumpkin_grips', name: 'Hallowed Grips', sprite: { x: 827, y: 776, w: 165, h: 64 } }],
        6: [{ skin: 'abyssal_claws', name: 'Abyssal Claws', sprite: { x: 28, y: 968, w: 169, h: 91 } }, { skin: 'bloodsteel_fists', name: 'Bloodsteel Fists', sprite: { x: 225, y: 968, w: 175, h: 89 } }, { skin: 'deathgrip', name: 'Deathgrip Gauntlets', sprite: { x: 423, y: 968, w: 175, h: 90 } }, { skin: 'corsair_gloves', name: "Corsair's Gauntlets", sprite: { x: 622, y: 968, w: 170, h: 91 } }, { skin: 'mythic_vambrace', name: 'Mythic Vambrace', sprite: { x: 827, y: 968, w: 164, h: 87 } }],
        7: [{ skin: 'celestial_grips', name: 'Celestial Grips', sprite: { x: 29, y: 1160, w: 168, h: 126 } }, { skin: 'solar_gauntlets', name: 'Solar Gauntlets', sprite: { x: 229, y: 1160, w: 170, h: 117 } }, { skin: 'stellaris_fists', name: 'Stellaris Fists', sprite: { x: 420, y: 1160, w: 177, h: 120 } }, { skin: 'divine_vambrace', name: 'Divine Vambrace', sprite: { x: 622, y: 1160, w: 171, h: 120 } }, { skin: 'seraphic_gaunt', name: 'Seraphic Gauntlets', sprite: { x: 827, y: 1160, w: 158, h: 115 } }],
    },
    belt: {
        1: [{ skin: 'leather_strap', name: 'Leather Strap', sprite: { x: 57, y: 107, w: 185, h: 77 } }, { skin: 'iron_buckle', name: 'Iron Buckle Belt', sprite: { x: 286, y: 107, w: 195, h: 77 } }, { skin: 'dark_cinch', name: 'Worn Cinch', sprite: { x: 531, y: 107, w: 201, h: 77 } }, { skin: 'rope_cord', name: 'Rope Cord', sprite: { x: 782, y: 107, w: 191, h: 77 } }],
        2: [{ skin: 'ranger_belt', name: "Ranger's Belt", sprite: { x: 51, y: 261, w: 197, h: 78 } }, { skin: 'verdant_sash', name: 'Verdant Sash', sprite: { x: 281, y: 261, w: 202, h: 79 } }, { skin: 'studded_girdle', name: 'Studded Girdle', sprite: { x: 527, y: 261, w: 211, h: 82 } }, { skin: 'brass_buckle', name: 'Brass Buckle', sprite: { x: 776, y: 262, w: 204, h: 76 } }],
        3: [{ skin: 'warden_girdle', name: "Warden's Girdle", sprite: { x: 49, y: 415, w: 199, h: 91 } }, { skin: 'silver_cincture', name: 'Silver Cincture', sprite: { x: 282, y: 412, w: 208, h: 87 } }, { skin: 'emerald_sash', name: 'Emerald Sash', sprite: { x: 522, y: 412, w: 221, h: 90 } }, { skin: 'starweave_belt', name: 'Starweave Belt', sprite: { x: 776, y: 413, w: 203, h: 86 } }],
        4: [{ skin: 'amethyst_girdle', name: 'Amethyst Girdle', sprite: { x: 47, y: 584, w: 201, h: 79 } }, { skin: 'royal_sash', name: 'Royal Sash', sprite: { x: 279, y: 584, w: 219, h: 71 } }, { skin: 'arcane_cincture', name: 'Arcane Cincture', sprite: { x: 522, y: 584, w: 222, h: 66 } }, { skin: 'twilight_belt', name: 'Twilight Belt', sprite: { x: 776, y: 584, w: 206, h: 70 } }],
        5: [{ skin: 'inferno_girdle', name: 'Inferno Girdle', sprite: { x: 29, y: 875, w: 219, h: 77 } }, { skin: 'ember_sash', name: 'Ember Sash', sprite: { x: 282, y: 871, w: 217, h: 81 } }, { skin: 'obsidian_cinch', name: 'Obsidian Cincture', sprite: { x: 520, y: 872, w: 227, h: 80 } }, { skin: 'pumpkin_belt', name: 'Hallowed Girdle', sprite: { x: 776, y: 875, w: 210, h: 77 } }],
        6: [{ skin: 'abyssal_girdle', name: 'Abyssal Girdle', sprite: { x: 29, y: 1023, w: 219, h: 96 } }, { skin: 'bloodforge_belt', name: 'Bloodforge Belt', sprite: { x: 280, y: 1021, w: 219, h: 107 } }, { skin: 'demoneye_sash', name: 'Demon Eye Sash', sprite: { x: 520, y: 1021, w: 226, h: 102 } }, { skin: 'corsair_cinch', name: "Corsair's Cincture", sprite: { x: 776, y: 1023, w: 210, h: 101 } }],
        7: [{ skin: 'solar_girdle', name: 'Solar Girdle', sprite: { x: 41, y: 1175, w: 207, h: 106 } }, { skin: 'celestial_sash', name: 'Celestial Sash', sprite: { x: 279, y: 1175, w: 217, h: 105 } }, { skin: 'stellaris_belt', name: 'Stellaris Belt', sprite: { x: 520, y: 1174, w: 226, h: 100 } }, { skin: 'seraphic_cinch', name: 'Seraphic Cincture', sprite: { x: 776, y: 1175, w: 209, h: 99 } }],
    },
    boots: {
        1: [{ skin: 'worn_sandals', name: 'Worn Sandals', sprite: { x: 85, y: 75, w: 152, h: 109 } }, { skin: 'leather_treads', name: 'Leather Treads', sprite: { x: 292, y: 75, w: 160, h: 109 } }, { skin: 'traveler_boots', name: "Traveler's Boots", sprite: { x: 520, y: 75, w: 134, h: 109 } }, { skin: 'muddy_boots', name: 'Muddy Boots', sprite: { x: 776, y: 75, w: 79, h: 109 } }],
        2: [{ skin: 'fur_boots', name: 'Fur-Lined Boots', sprite: { x: 77, y: 249, w: 162, h: 126 } }, { skin: 'padded_treads', name: 'Padded Treads', sprite: { x: 278, y: 243, w: 175, h: 133 } }, { skin: 'ranger_boots', name: "Ranger's Boots", sprite: { x: 520, y: 245, w: 134, h: 131 } }, { skin: 'buckled_boots', name: 'Buckled Boots', sprite: { x: 776, y: 247, w: 80, h: 128 } }],
        3: [{ skin: 'silver_greaves', name: 'Silver Greaves', sprite: { x: 80, y: 421, w: 168, h: 130 } }, { skin: 'armored_treads', name: 'Armored Treads', sprite: { x: 278, y: 417, w: 179, h: 135 } }, { skin: 'cobalt_sabatons', name: 'Cobalt Sabatons', sprite: { x: 520, y: 418, w: 135, h: 134 } }, { skin: 'emerald_greaves', name: 'Emerald Greaves', sprite: { x: 776, y: 421, w: 81, h: 129 } }],
        4: [{ skin: 'azure_sabatons', name: 'Azure Sabatons', sprite: { x: 79, y: 594, w: 169, h: 131 } }, { skin: 'frost_greaves', name: 'Frost Greaves', sprite: { x: 271, y: 588, w: 181, h: 139 } }, { skin: 'icebound_treads', name: 'Icebound Treads', sprite: { x: 520, y: 591, w: 132, h: 134 } }, { skin: 'shadow_sabatons', name: 'Shadow Sabatons', sprite: { x: 776, y: 591, w: 72, h: 131 } }],
        5: [{ skin: 'gilded_sabatons', name: 'Gilded Sabatons', sprite: { x: 79, y: 776, w: 169, h: 126 } }, { skin: 'inferno_treads', name: 'Inferno Treads', sprite: { x: 267, y: 776, w: 182, h: 124 } }, { skin: 'obsidian_boots', name: 'Obsidian Warboots', sprite: { x: 520, y: 776, w: 126, h: 125 } }, { skin: 'arcane_greaves', name: 'Arcane Greaves', sprite: { x: 776, y: 776, w: 65, h: 121 } }],
        6: [{ skin: 'abyssal_treads', name: 'Abyssal Treads', sprite: { x: 74, y: 968, w: 174, h: 95 } }, { skin: 'hellfire_sabatons', name: 'Hellfire Sabatons', sprite: { x: 271, y: 968, w: 175, h: 94 } }, { skin: 'voidstep_boots', name: 'Voidstep Boots', sprite: { x: 520, y: 968, w: 123, h: 96 } }, { skin: 'deathmarch', name: 'Deathmarch Boots', sprite: { x: 776, y: 968, w: 59, h: 89 } }],
        7: [{ skin: 'celestial_treads', name: 'Celestial Treads', sprite: { x: 73, y: 1239, w: 175, h: 97 } }, { skin: 'solar_sabatons', name: 'Solar Sabatons', sprite: { x: 268, y: 1240, w: 171, h: 96 } }, { skin: 'stellaris_boots', name: 'Stellaris Boots', sprite: { x: 520, y: 1238, w: 113, h: 98 } }, { skin: 'divine_greaves', name: 'Divine Greaves', sprite: { x: 776, y: 1248, w: 54, h: 88 } }],
    },
};

// ── Mutable state: starts with fallback, replaced by API data ─────
export let SPRITE_SHEETS = { ...FALLBACK_SPRITE_SHEETS };
export let EQUIPMENT_TEMPLATES = { ...FALLBACK_TEMPLATES };

/**
 * Load equipment templates from the server API.
 * Replaces the in-memory SPRITE_SHEETS and EQUIPMENT_TEMPLATES with DB data.
 * Falls back silently to hardcoded data on failure.
 */
export async function loadTemplatesFromAPI() {
    try {
        const res = await fetch('/api/equipment/templates');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.spriteSheets && Object.keys(data.spriteSheets).length > 0) {
            SPRITE_SHEETS = data.spriteSheets;
        }
        if (data.templates && Object.keys(data.templates).length > 0) {
            EQUIPMENT_TEMPLATES = data.templates;
        }
        console.log('[Equipment] Loaded templates from database');
    } catch {
        console.log('[Equipment] Using fallback templates (API unavailable)');
    }
}

/**
 * Pick a random template for the given equipment type and tier.
 * Returns { skin, name, sprite } or null if no templates are defined yet.
 */
export function pickTemplate(type, tier) {
    const byType = EQUIPMENT_TEMPLATES[type];
    if (!byType) return null;
    const templates = byType[tier];
    if (!templates || templates.length === 0) return null;
    return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Build inline style for a sprite-sheet background using pixel bounding boxes.
 * The sprite is cropped and scaled to fill the display container.
 * Returns a CSS string or empty string if no sprite data is available.
 */
export function getSpriteStyle(type, sprite) {
    const sheet = SPRITE_SHEETS[type];
    if (!sheet || !sprite) return '';

    // Add padding around the sprite region to avoid tight cropping of artwork edges
    const pad = 8;
    const x = Math.max(0, sprite.x - pad);
    const y = Math.max(0, sprite.y - pad);
    const w = Math.min(sheet.width - x, sprite.w + pad * 2);
    const h = Math.min(sheet.height - y, sprite.h + pad * 2);

    const sizeX = (sheet.width / w) * 100;
    const sizeY = (sheet.height / h) * 100;
    const posX  = w < sheet.width  ? (x / (sheet.width  - w)) * 100 : 0;
    const posY  = h < sheet.height ? (y / (sheet.height - h)) * 100 : 0;

    return `background-image: url(${sheet.file}); background-size: ${sizeX}% ${sizeY}%; background-position: ${posX}% ${posY}%; background-repeat: no-repeat;`;
}
