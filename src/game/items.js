// Item presentation: names, icons, rarity helpers.
import { TIERS, BONUS_STATS, SLOT_ICONS, SLOT_LABELS, weaponStyle } from './config.js';
import { pickBySeed } from '../../shared/utils.js';

// Ranged weapons get their own icon so the gear grid reads at a glance.
export const RANGED_WEAPON_ICON = '🏹';

export function tierDef(tier) {
    return TIERS[(tier || 1) - 1] || TIERS[0];
}

export function rarityName(tier) {
    return tierDef(tier).name;
}

export function rarityColor(tier) {
    return tierDef(tier).color;
}

export function slotIcon(type) {
    return SLOT_ICONS[type] || '❔';
}

/** Icon for a concrete item — ranged weapons swap the blade for a bow. */
export function itemIcon(item) {
    if (item?.type === 'weapon' && weaponStyle(item) === 'ranged') return RANGED_WEAPON_ICON;
    return slotIcon(item?.type);
}

export function slotLabel(type) {
    return SLOT_LABELS[type] || type;
}

// Flavorful name pools. A name is rolled once at forge time and stored on the item.
const TIER_PREFIX = [
    ['Worn', 'Plain', 'Chipped', 'Rough'],            // Common
    ['Sturdy', 'Polished', 'Keen', 'Fine'],            // Uncommon
    ['Gleaming', 'Tempered', 'Vicious', 'Runed'],      // Rare
    ['Ancient', 'Stormforged', 'Dread', 'Radiant'],    // Epic
    ['Legendary', 'Mythril', 'Soulbound', 'Eternal'],  // Legendary
    ['Godslayer', 'Voidforged', 'Celestial', 'Apex'],  // Mythic
    ['Divine', 'Astral', 'Worldforged', 'Primordial'], // Divine
];

const SLOT_NOUN = {
    weapon: ['Blade', 'Cleaver', 'Maul', 'Edge', 'Fang'],
    armor: ['Plate', 'Cuirass', 'Aegis', 'Mail', 'Carapace'],
    hat: ['Helm', 'Crown', 'Visor', 'Coif', 'Hood'],
    gloves: ['Gauntlets', 'Grips', 'Claws', 'Handguards'],
    boots: ['Treads', 'Greaves', 'Striders', 'Sabatons'],
    belt: ['Girdle', 'Sash', 'Cinch', 'Waistguard'],
    necklace: ['Amulet', 'Pendant', 'Choker', 'Talisman'],
    ring: ['Band', 'Signet', 'Loop', 'Seal'],
};

// Ranged weapons draw from their own noun pool so the name matches the bow icon.
const RANGED_WEAPON_NOUN = ['Bow', 'Longbow', 'Crossbow', 'Sling', 'Recurve'];

/** Deterministic name from the item's own properties (stable across renders). */
export function itemName(item) {
    if (item?.name) return item.name;
    const tier = item?.tier || 1;
    const seed = (item?.level || 1) * 31 + tier * 7;
    const prefix = pickBySeed(TIER_PREFIX[tier - 1] || TIER_PREFIX[0], seed);
    const nouns = item?.type === 'weapon' && weaponStyle(item) === 'ranged'
        ? RANGED_WEAPON_NOUN
        : (SLOT_NOUN[item?.type] || ['Relic']);
    const noun = pickBySeed(nouns, seed >> 1);
    return `${prefix} ${noun}`;
}

export function bonusDef(key) {
    return BONUS_STATS[key];
}

/** Human-readable bonus, e.g. "⚡ +8% Attack Speed". */
export function bonusLabel(bonus) {
    const def = BONUS_STATS[bonus.type];
    if (!def) return '';
    return `${def.icon} +${bonus.value}${def.unit} ${def.label}`;
}
