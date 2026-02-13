// Re-export shared constants so existing client imports keep working
export {
    EQUIPMENT_TYPES, HEALTH_ITEMS, DAMAGE_ITEMS,
    BASE_HEALTH, BASE_DAMAGE, HEALTH_PER_LEVEL, DAMAGE_PER_LEVEL,
    GROWTH_EXPONENT, BONUS_STATS, BONUS_STAT_KEYS,
    TIERS, MAX_TIER,
} from '../shared/stats.js';

export const EQUIPMENT_ICONS = {
    hat: '🎩',
    armor: '🛡️',
    belt: '📿',
    boots: '👢',
    gloves: '🧤',
    necklace: '📿',
    ring: '💍',
    weapon: '⚔️'
};

export const LEVEL_RANGE = 10;
export const MAX_LEVEL = 100;
export const INITIAL_LEVEL_MAX = 10;

export const SAVE_KEY = 'forgemaster_save';

// --- Forge level system ---

// Gold per remaining second to instantly complete an upgrade (legacy, kept for reference)
export const SPEED_UP_GOLD_PER_SECOND = 2;

// Diamonds: premium currency for speed-up and shop purchases
export const STARTING_DIAMONDS = 100;
export const SPEED_UP_SECONDS_PER_DIAMOND = 60; // 1 diamond = 60 seconds of acceleration

// Diamond shop offers: buy gold or essence with diamonds
export const DIAMOND_SHOP_OFFERS = [
    { id: 'gold_s',    type: 'gold',    cost: 10,  amount: 5000,   label: 'Gold S' },
    { id: 'gold_m',    type: 'gold',    cost: 50,  amount: 30000,  label: 'Gold M' },
    { id: 'gold_l',    type: 'gold',    cost: 100, amount: 75000,  label: 'Gold L' },
    { id: 'essence_s', type: 'essence', cost: 10,  amount: 100,    label: 'Essence S' },
    { id: 'essence_m', type: 'essence', cost: 50,  amount: 600,    label: 'Essence M' },
    { id: 'essence_l', type: 'essence', cost: 100, amount: 1500,   label: 'Essence L' },
];

// Diamond packs for real-money purchase (mirrors server config, used for UI rendering)
// Actual prices and validation happen server-side — these are display-only
export const DIAMOND_PACKS = [
    { id: 'welcome',  diamonds: 100,  bonus: 0,   priceCents: 299,  label: 'Welcome Pack',  oneTime: true },
    { id: 'starter',  diamonds: 50,   bonus: 0,   priceCents: 499,  label: 'Starter' },
    { id: 'popular',  diamonds: 100,  bonus: 20,  priceCents: 999,  label: 'Popular' },
    { id: 'value',    diamonds: 200,  bonus: 60,  priceCents: 1999, label: 'Value' },
    { id: 'premium',  diamonds: 500,  bonus: 200, priceCents: 4999, label: 'Premium' },
    { id: 'ultimate', diamonds: 1000, bonus: 500, priceCents: 9999, label: 'Ultimate' },
];

// Auto-forge interval in milliseconds
export const AUTO_FORGE_INTERVAL = 3500;

export const FORGE_LEVELS = [
    //                                       Com     Unc     Rar     Epi     Leg     Myt     Div
    { level: 1,  cost: 0,         time: 0,       chances: [100,    0,      0,      0,      0,      0,      0     ] },
    { level: 2,  cost: 200,       time: 60,      chances: [97.5,   2.5,    0,      0,      0,      0,      0     ] },
    { level: 3,  cost: 500,       time: 180,     chances: [95,     5,      0,      0,      0,      0,      0     ] },
    { level: 4,  cost: 1000,      time: 360,     chances: [93,     6.5,    0.5,    0,      0,      0,      0     ] },
    { level: 5,  cost: 1800,      time: 600,     chances: [90.5,   8,      1.5,    0,      0,      0,      0     ] },
    { level: 6,  cost: 3000,      time: 1200,    chances: [87.5,   10,     2.5,    0,      0,      0,      0     ] },
    { level: 7,  cost: 5000,      time: 1800,    chances: [84.5,   12,     3.5,    0,      0,      0,      0     ] },
    { level: 8,  cost: 8000,      time: 3600,    chances: [81,     14,     5,      0,      0,      0,      0     ] },
    { level: 9,  cost: 12000,     time: 5400,    chances: [77.5,   15.5,   6.5,    0.5,    0,      0,      0     ] },
    { level: 10, cost: 18000,     time: 7200,    chances: [74,     17,     8,      1,      0,      0,      0     ] },
    { level: 11, cost: 27000,     time: 14400,   chances: [70,     18.5,   9.5,    2,      0,      0,      0     ] },
    { level: 12, cost: 40000,     time: 21600,   chances: [66,     20,     11,     3,      0,      0,      0     ] },
    { level: 13, cost: 60000,     time: 36000,   chances: [62,     21,     12.5,   4.5,    0,      0,      0     ] },
    { level: 14, cost: 85000,     time: 50400,   chances: [58,     22,     14,     6,      0,      0,      0     ] },
    { level: 15, cost: 120000,    time: 72000,   chances: [54,     22.5,   15,     8,      0.5,    0,      0     ] },
    { level: 16, cost: 170000,    time: 100800,  chances: [50,     23,     16,     9.5,    1.5,    0,      0     ] },
    { level: 17, cost: 250000,    time: 144000,  chances: [46,     23,     17,     11.5,   2.5,    0,      0     ] },
    { level: 18, cost: 360000,    time: 201600,  chances: [42,     22.5,   18,     13.5,   4,      0,      0     ] },
    { level: 19, cost: 500000,    time: 259200,  chances: [38,     22,     19,     15,     6,      0,      0     ] },
    { level: 20, cost: 700000,    time: 345600,  chances: [34,     21,     19.5,   17,     8.5,    0,      0     ] },
    { level: 21, cost: 1000000,   time: 432000,  chances: [30,     20,     20,     18.5,   11,     0.5,    0     ] },
    { level: 22, cost: 1400000,   time: 518400,  chances: [26,     19,     20,     20,     14,     1,      0     ] },
    { level: 23, cost: 2000000,   time: 604800,  chances: [22,     17.5,   19.5,   21.5,   17.5,   2,      0     ] },
    { level: 24, cost: 2800000,   time: 604800,  chances: [18,     16,     19,     23,     21,     3,      0     ] },
    { level: 25, cost: 4000000,   time: 604800,  chances: [14.5,   14.5,   18,     24,     24.5,   4,      0.5   ] },
    { level: 26, cost: 5500000,   time: 604800,  chances: [11,     13,     17,     24.5,   28.5,   5.5,    0.5   ] },
    { level: 27, cost: 7500000,   time: 604800,  chances: [8,      11,     15.5,   24.5,   33,     7,      1     ] },
    { level: 28, cost: 10000000,  time: 604800,  chances: [5,      9,      14,     24,     38,     8.5,    1.5   ] },
    { level: 29, cost: 14000000,  time: 604800,  chances: [2.5,    6.5,    12,     22.5,   44,     10.5,   2     ] },
    { level: 30, cost: 20000000,  time: 604800,  chances: [0,      4,      10,     21,     49,     13,     3     ] },
];

export const MAX_FORGE_LEVEL = FORGE_LEVELS.length;

// --- Player level rewards ---

// Small gold reward per level: base + level * scaling
export const LEVEL_REWARD_BASE_GOLD = 50;
export const LEVEL_REWARD_GOLD_PER_LEVEL = 25;

// Big reward every 10 levels (milestone): multiplier applied to normal reward
export const LEVEL_MILESTONE_INTERVAL = 10;
export const LEVEL_MILESTONE_MULTIPLIER = 10;

// --- Username change (cost in diamonds) ---
export const USERNAME_CHANGE_COST = 50;

// --- Profile pictures (emoji avatars) ---
export const PROFILE_PICTURES = [
    { id: 'wizard', emoji: '\uD83E\uDDD9', label: 'Wizard' },
    { id: 'knight', emoji: '\u2694\uFE0F', label: 'Knight' },
    { id: 'warrior', emoji: '\uD83E\uDDD1\u200D\uD83D\uDD27', label: 'Warrior' },
    { id: 'elf', emoji: '\uD83E\uDDDD', label: 'Elf' },
    { id: 'vampire', emoji: '\uD83E\uDDDB', label: 'Vampire' },
    { id: 'dragon', emoji: '\uD83D\uDC09', label: 'Dragon' },
    { id: 'skull', emoji: '\uD83D\uDC80', label: 'Skull' },
    { id: 'fire', emoji: '\uD83D\uDD25', label: 'Fire' },
    { id: 'crown', emoji: '\uD83D\uDC51', label: 'Crown' },
    { id: 'gem', emoji: '\uD83D\uDC8E', label: 'Gem' },
    { id: 'star', emoji: '\u2B50', label: 'Star' },
    { id: 'shield', emoji: '\uD83D\uDEE1\uFE0F', label: 'Shield' },
    { id: 'wolf', emoji: '\uD83D\uDC3A', label: 'Wolf' },
    { id: 'eagle', emoji: '\uD83E\uDD85', label: 'Eagle' },
    { id: 'lion', emoji: '\uD83E\uDD81', label: 'Lion' },
    { id: 'robot', emoji: '\uD83E\uDD16', label: 'Robot' },
];
