// Item presentation: names, icons, rarity helpers.
import { TIERS, BONUS_STATS, SLOT_ICONS, SLOT_LABELS } from './config.js';

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

function pick(arr, seed) {
    return arr[Math.abs(seed) % arr.length];
}

/** Deterministic name from the item's own properties (stable across renders). */
export function itemName(item) {
    if (item?.name) return item.name;
    const tier = item?.tier || 1;
    const seed = (item?.level || 1) * 31 + tier * 7;
    const prefix = pick(TIER_PREFIX[tier - 1] || TIER_PREFIX[0], seed);
    const noun = pick(SLOT_NOUN[item?.type] || ['Relic'], seed >> 1);
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
