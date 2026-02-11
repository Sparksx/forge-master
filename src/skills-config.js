// Skills configuration – 24 skills (12 passive, 12 active) across 6 tiers.
// Tier colours / names reuse the equipment tier system from config.js.

/**
 * Skill value at a given level.
 * Linear interpolation: value = base + (max - base) * (level - 1) / 9
 */
export function skillValue(base, max, level) {
    return base + (max - base) * (level - 1) / 9;
}

/**
 * Cooldown / duration at a given level (decreases / increases linearly).
 */
function scaledTime(start, end, level) {
    return start + (end - start) * (level - 1) / 9;
}

// --- Unlock requirement helpers ------------------------------------------------

/**
 * @typedef {{ type: 'playerLevel', level: number } | { type: 'wave', wave: number, subWave: number }} UnlockReq
 */

function reqLevel(level) { return { type: 'playerLevel', level }; }
function reqWave(wave, subWave) { return { type: 'wave', wave, subWave }; }

// --- Skill level-up cost -------------------------------------------------------

const TIER_BASE_COST = [50, 150, 400, 1000, 2500, 7000];
const LEVEL_COST_SCALE = 1.5;

export function getSkillLevelUpCost(tier, currentLevel) {
    const base = TIER_BASE_COST[tier - 1] || TIER_BASE_COST[0];
    return Math.floor(base * Math.pow(LEVEL_COST_SCALE, currentLevel - 1));
}

export const MAX_SKILL_LEVEL = 10;
export const MAX_EQUIPPED_SKILLS = 3;

// --- Skill definitions ---------------------------------------------------------

/**
 * @typedef {Object} SkillDef
 * @property {string}  id
 * @property {string}  name
 * @property {string}  icon
 * @property {number}  tier        1-6
 * @property {'passive'|'active'} type
 * @property {string}  description  Template with {value}, {value2}, {duration}, {cooldown}
 * @property {UnlockReq} unlock
 * @property {(level:number)=>Object} effect   Returns computed values for the given level
 */

export const SKILLS = [
    // ── TIER 1 – Common ─────────────────────────────────────────────────────
    {
        id: 'berserkerRage',
        name: 'Berserker Rage',
        icon: '🔥',
        tier: 1,
        type: 'passive',
        description: '+{value}% damage when HP < 30%',
        unlock: reqLevel(3),
        effect: (lvl) => ({
            value: Math.round(skillValue(10, 55, lvl)),
            condition: 'lowHP',
            conditionThreshold: 30,
            stat: 'damagePercent',
        }),
    },
    {
        id: 'ironSkin',
        name: 'Iron Skin',
        icon: '🛡️',
        tier: 1,
        type: 'passive',
        description: '-{value}% damage received',
        unlock: reqLevel(5),
        effect: (lvl) => ({
            value: Math.round(skillValue(5, 25, lvl)),
            condition: 'always',
            stat: 'damageReduction',
        }),
    },
    {
        id: 'warCry',
        name: 'War Cry',
        icon: '📢',
        tier: 1,
        type: 'active',
        description: '+{value}% damage for {duration}s (CD {cooldown}s)',
        unlock: reqLevel(2),
        effect: (lvl) => ({
            value: Math.round(skillValue(15, 60, lvl)),
            duration: Math.round(scaledTime(4, 7, lvl) * 10) / 10,
            cooldown: Math.round(scaledTime(20, 14, lvl) * 10) / 10,
            stat: 'damagePercent',
        }),
    },
    {
        id: 'heal',
        name: 'Heal',
        icon: '💚',
        tier: 1,
        type: 'active',
        description: 'Restore {value}% max HP (CD {cooldown}s)',
        unlock: reqLevel(4),
        effect: (lvl) => ({
            value: Math.round(skillValue(10, 40, lvl)),
            duration: 0,
            cooldown: Math.round(scaledTime(15, 8, lvl) * 10) / 10,
            stat: 'healPercent',
        }),
    },

    // ── TIER 2 – Uncommon ───────────────────────────────────────────────────
    {
        id: 'swiftBlade',
        name: 'Swift Blade',
        icon: '⚡',
        tier: 2,
        type: 'passive',
        description: '+{value}% attack speed',
        unlock: reqWave(2, 1),
        effect: (lvl) => ({
            value: Math.round(skillValue(5, 30, lvl)),
            condition: 'always',
            stat: 'attackSpeedPercent',
        }),
    },
    {
        id: 'poisonEdge',
        name: 'Poison Edge',
        icon: '🧪',
        tier: 2,
        type: 'passive',
        description: 'Attacks poison for {value}% damage over 3s',
        unlock: reqWave(2, 5),
        effect: (lvl) => ({
            value: Math.round(skillValue(2, 10, lvl)),
            condition: 'onHit',
            stat: 'poisonPercent',
            poisonDuration: 3,
        }),
    },
    {
        id: 'shieldWall',
        name: 'Shield Wall',
        icon: '🧱',
        tier: 2,
        type: 'active',
        description: '-{value}% damage received for {duration}s (CD {cooldown}s)',
        unlock: reqWave(1, 5),
        effect: (lvl) => ({
            value: Math.round(skillValue(20, 60, lvl)),
            duration: Math.round(scaledTime(3, 6, lvl) * 10) / 10,
            cooldown: Math.round(scaledTime(18, 12, lvl) * 10) / 10,
            stat: 'damageReduction',
        }),
    },
    {
        id: 'bladeStorm',
        name: 'Blade Storm',
        icon: '🌪️',
        tier: 2,
        type: 'active',
        description: '+{value}% attack speed for {duration}s (CD {cooldown}s)',
        unlock: reqLevel(15),
        effect: (lvl) => ({
            value: Math.round(skillValue(30, 100, lvl)),
            duration: Math.round(scaledTime(3, 5, lvl) * 10) / 10,
            cooldown: Math.round(scaledTime(22, 15, lvl) * 10) / 10,
            stat: 'attackSpeedPercent',
        }),
    },

    // ── TIER 3 – Rare ───────────────────────────────────────────────────────
    {
        id: 'lastStand',
        name: 'Last Stand',
        icon: '💀',
        tier: 3,
        type: 'passive',
        description: '+{value}% damage when HP < 20%',
        unlock: reqWave(3, 1),
        effect: (lvl) => ({
            value: Math.round(skillValue(20, 80, lvl)),
            condition: 'lowHP',
            conditionThreshold: 20,
            stat: 'damagePercent',
        }),
    },
    {
        id: 'vampiricAura',
        name: 'Vampiric Aura',
        icon: '🧛',
        tier: 3,
        type: 'passive',
        description: '+{value}% life steal',
        unlock: reqLevel(25),
        effect: (lvl) => ({
            value: Math.round(skillValue(3, 15, lvl)),
            condition: 'always',
            stat: 'lifeStealFlat',
        }),
    },
    {
        id: 'bloodRitual',
        name: 'Blood Ritual',
        icon: '🩸',
        tier: 3,
        type: 'active',
        description: 'Sacrifice 10% HP, +{value}% damage for {duration}s (CD {cooldown}s)',
        unlock: reqWave(3, 5),
        effect: (lvl) => ({
            value: Math.round(skillValue(25, 80, lvl)),
            duration: Math.round(scaledTime(5, 8, lvl) * 10) / 10,
            cooldown: Math.round(scaledTime(20, 12, lvl) * 10) / 10,
            stat: 'damagePercent',
            selfDamagePercent: 10,
        }),
    },
    {
        id: 'frozenShield',
        name: 'Frozen Shield',
        icon: '❄️',
        tier: 3,
        type: 'active',
        description: 'Absorb shield for {value}% max HP for {duration}s (CD {cooldown}s)',
        unlock: reqLevel(30),
        effect: (lvl) => ({
            value: Math.round(skillValue(15, 50, lvl)),
            duration: Math.round(scaledTime(5, 8, lvl) * 10) / 10,
            cooldown: Math.round(scaledTime(25, 16, lvl) * 10) / 10,
            stat: 'shieldPercent',
        }),
    },

    // ── TIER 4 – Epic ───────────────────────────────────────────────────────
    {
        id: 'critMastery',
        name: 'Critical Mastery',
        icon: '🎯',
        tier: 4,
        type: 'passive',
        description: '+{value}% crit chance & +{value2}% crit multiplier',
        unlock: reqWave(5, 1),
        effect: (lvl) => ({
            value: Math.round(skillValue(5, 25, lvl)),
            value2: Math.round(skillValue(10, 50, lvl)),
            condition: 'always',
            stat: 'critBoost',
        }),
    },
    {
        id: 'thornArmor',
        name: 'Thorn Armor',
        icon: '🌵',
        tier: 4,
        type: 'passive',
        description: 'Reflects {value}% damage received to attacker',
        unlock: reqLevel(40),
        effect: (lvl) => ({
            value: Math.round(skillValue(5, 30, lvl)),
            condition: 'onHurt',
            stat: 'thornPercent',
        }),
    },
    {
        id: 'shadowStrike',
        name: 'Shadow Strike',
        icon: '🗡️',
        tier: 4,
        type: 'active',
        description: 'Next attack deals {value}% damage with guaranteed crit (CD {cooldown}s)',
        unlock: reqWave(5, 5),
        effect: (lvl) => ({
            value: Math.round(skillValue(200, 500, lvl)),
            duration: 0, // single hit
            cooldown: Math.round(scaledTime(18, 10, lvl) * 10) / 10,
            stat: 'shadowStrike',
        }),
    },
    {
        id: 'divineBlessing',
        name: 'Divine Blessing',
        icon: '✨',
        tier: 4,
        type: 'active',
        description: '+{value}% HP regen/s for {duration}s (CD {cooldown}s)',
        unlock: reqLevel(50),
        effect: (lvl) => ({
            value: Math.round(skillValue(8, 30, lvl)),
            duration: Math.round(scaledTime(4, 7, lvl) * 10) / 10,
            cooldown: Math.round(scaledTime(22, 14, lvl) * 10) / 10,
            stat: 'regenPercent',
        }),
    },

    // ── TIER 5 – Legendary ──────────────────────────────────────────────────
    {
        id: 'phoenixSpirit',
        name: 'Phoenix Spirit',
        icon: '🐦‍🔥',
        tier: 5,
        type: 'passive',
        description: 'Revive at {value}% HP once per wave',
        unlock: reqWave(7, 1),
        effect: (lvl) => ({
            value: Math.round(skillValue(10, 50, lvl)),
            condition: 'onDeath',
            stat: 'revivePercent',
        }),
    },
    {
        id: 'titanGrip',
        name: 'Titan Grip',
        icon: '💪',
        tier: 5,
        type: 'passive',
        description: '+{value}% damage & +{value2}% max HP',
        unlock: reqLevel(60),
        effect: (lvl) => ({
            value: Math.round(skillValue(15, 60, lvl)),
            value2: Math.round(skillValue(10, 40, lvl)),
            condition: 'always',
            stat: 'titanGrip',
        }),
    },
    {
        id: 'timeWarp',
        name: 'Time Warp',
        icon: '⏳',
        tier: 5,
        type: 'active',
        description: '2x attack speed for {duration}s (CD {cooldown}s)',
        unlock: reqWave(8, 1),
        effect: (lvl) => ({
            value: 100, // always 2x
            duration: Math.round(scaledTime(3, 6, lvl) * 10) / 10,
            cooldown: Math.round(scaledTime(30, 18, lvl) * 10) / 10,
            stat: 'attackSpeedPercent',
        }),
    },
    {
        id: 'ragingInferno',
        name: 'Raging Inferno',
        icon: '🌋',
        tier: 5,
        type: 'active',
        description: 'Burns all monsters for {value}% max HP/s for {duration}s (CD {cooldown}s)',
        unlock: reqLevel(70),
        effect: (lvl) => ({
            value: Math.round(skillValue(5, 20, lvl)),
            duration: Math.round(scaledTime(3, 5, lvl) * 10) / 10,
            cooldown: Math.round(scaledTime(35, 22, lvl) * 10) / 10,
            stat: 'burnPercent',
        }),
    },

    // ── TIER 6 – Mythic ─────────────────────────────────────────────────────
    {
        id: 'deathMark',
        name: 'Death Mark',
        icon: '☠️',
        tier: 6,
        type: 'passive',
        description: 'Monsters below {value}% HP die instantly',
        unlock: reqWave(9, 1),
        effect: (lvl) => ({
            value: Math.round(skillValue(15, 35, lvl)),
            condition: 'execute',
            stat: 'executeThreshold',
        }),
    },
    {
        id: 'godslayer',
        name: 'Godslayer',
        icon: '⚔️',
        tier: 6,
        type: 'passive',
        description: '+{value}% to ALL equipment bonus stats',
        unlock: reqLevel(80),
        effect: (lvl) => ({
            value: Math.round(skillValue(5, 25, lvl)),
            condition: 'always',
            stat: 'allBonusPercent',
        }),
    },
    {
        id: 'apocalypse',
        name: 'Apocalypse',
        icon: '💥',
        tier: 6,
        type: 'active',
        description: 'Deal {value}% total damage to all monsters (CD {cooldown}s)',
        unlock: reqWave(10, 1),
        effect: (lvl) => ({
            value: Math.round(skillValue(50, 200, lvl)),
            duration: 0,
            cooldown: Math.round(scaledTime(45, 25, lvl) * 10) / 10,
            stat: 'aoeBurst',
        }),
    },
    {
        id: 'immortality',
        name: 'Immortality',
        icon: '👼',
        tier: 6,
        type: 'active',
        description: 'Invincible + {value}% damage for {duration}s (CD {cooldown}s)',
        unlock: reqLevel(90),
        effect: (lvl) => ({
            value: Math.round(skillValue(20, 80, lvl)),
            duration: Math.round(scaledTime(2, 5, lvl) * 10) / 10,
            cooldown: Math.round(scaledTime(60, 35, lvl) * 10) / 10,
            stat: 'immortality',
        }),
    },
];

// --- Lookup helpers ------------------------------------------------------------

const skillMap = new Map(SKILLS.map(s => [s.id, s]));

export function getSkillById(id) {
    return skillMap.get(id) || null;
}

export function getAllSkills() {
    return SKILLS;
}

export function getSkillsByTier(tier) {
    return SKILLS.filter(s => s.tier === tier);
}

export function getSkillsByType(type) {
    return SKILLS.filter(s => s.type === type);
}

/**
 * Build the description string with current level values filled in.
 */
export function getSkillDescription(skill, level) {
    const eff = skill.effect(level);
    let desc = skill.description;
    desc = desc.replace('{value}', eff.value);
    if (eff.value2 !== undefined) desc = desc.replace('{value2}', eff.value2);
    if (eff.duration !== undefined) desc = desc.replace('{duration}', eff.duration);
    if (eff.cooldown !== undefined) desc = desc.replace('{cooldown}', eff.cooldown);
    return desc;
}
