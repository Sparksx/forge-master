// ══════════════════════════════════════════════════════════
// Skills Configuration
// ══════════════════════════════════════════════════════════
// 24 skills (12 passive, 12 active) across 6 tiers.
// Each skill has levels that scale its effect.

import { TIERS } from './config.js';

// Max skill levels per tier
export const SKILL_MAX_LEVELS = { 1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3 };

// Max equipped skills at once
export const MAX_EQUIPPED_SKILLS = 3;

// Unlock requirements per tier
export const SKILL_UNLOCK_REQS = [
    { tier: 1, wave: 1,  essenceCost: 50,    goldCost: 100 },
    { tier: 2, wave: 3,  essenceCost: 200,   goldCost: 500 },
    { tier: 3, wave: 5,  essenceCost: 800,   goldCost: 2000 },
    { tier: 4, wave: 7,  essenceCost: 3000,  goldCost: 8000 },
    { tier: 5, wave: 9,  essenceCost: 10000, goldCost: 30000 },
    { tier: 6, wave: 10, essenceCost: 50000, goldCost: 100000 },
];

// Level-up cost: baseCost * LEVEL_COST_SCALE^(level-1), essence only
export const SKILL_LEVEL_BASE_COST = { 1: 30, 2: 120, 3: 500, 4: 2000, 5: 8000, 6: 40000 };
export const SKILL_LEVEL_COST_SCALE = 1.5;

// ── Skill definitions ──────────────────────────────────────

export const SKILLS = [
    // ═══════════════════ PASSIVE SKILLS ═══════════════════

    // --- Tier 1 (Common) ---
    {
        id: 'toughSkin',
        name: 'Tough Skin',
        icon: '🛡️',
        type: 'passive',
        tier: 1,
        description: '+5% max HP per level',
        effect: {
            stat: 'maxHPPercent',
            base: 5,
            perLevel: 5,
        },
    },
    {
        id: 'sharpBlade',
        name: 'Sharp Blade',
        icon: '🗡️',
        type: 'passive',
        tier: 1,
        description: '+5% damage per level',
        effect: {
            stat: 'damagePercent',
            base: 5,
            perLevel: 5,
        },
    },

    // --- Tier 2 (Uncommon) ---
    {
        id: 'quickReflexes',
        name: 'Quick Reflexes',
        icon: '⚡',
        type: 'passive',
        tier: 2,
        description: '+3% attack speed per level',
        effect: {
            stat: 'attackSpeedPercent',
            base: 3,
            perLevel: 3,
        },
    },
    {
        id: 'luckyStrike',
        name: 'Lucky Strike',
        icon: '🎯',
        type: 'passive',
        tier: 2,
        description: '+2% crit chance per level',
        effect: {
            stat: 'critChanceFlat',
            base: 2,
            perLevel: 2,
        },
    },

    // --- Tier 3 (Rare) ---
    {
        id: 'berserkerRage',
        name: "Berserker's Rage",
        icon: '🔥',
        type: 'passive',
        tier: 3,
        description: 'Attack speed x2 when HP < 20% (+5% threshold/lvl)',
        effect: {
            stat: 'berserkerRage',
            base: 20,      // base HP threshold %
            perLevel: 5,    // +5% threshold per level
        },
    },
    {
        id: 'thornArmor',
        name: 'Thorn Armor',
        icon: '🌵',
        type: 'passive',
        tier: 3,
        description: 'Reflect 10% damage back to attacker (+5%/lvl)',
        effect: {
            stat: 'thornReflect',
            base: 10,
            perLevel: 5,
        },
    },

    // --- Tier 4 (Epic) ---
    {
        id: 'vampiricAura',
        name: 'Vampiric Aura',
        icon: '🧛',
        type: 'passive',
        tier: 4,
        description: '+3% life steal per level',
        effect: {
            stat: 'lifeStealFlat',
            base: 3,
            perLevel: 3,
        },
    },
    {
        id: 'overkill',
        name: 'Overkill',
        icon: '💀',
        type: 'passive',
        tier: 4,
        description: '50% excess damage carries to next monster (+10%/lvl)',
        effect: {
            stat: 'overkill',
            base: 50,
            perLevel: 10,
        },
    },

    // --- Tier 5 (Legendary) ---
    {
        id: 'undyingWill',
        name: 'Undying Will',
        icon: '💫',
        type: 'passive',
        tier: 5,
        description: 'Survive a lethal hit with 1 HP (60s CD, -5s/lvl)',
        effect: {
            stat: 'undyingWill',
            base: 60,       // base internal cooldown in seconds
            perLevel: -5,    // -5s per level
        },
    },
    {
        id: 'elementalMastery',
        name: 'Elemental Mastery',
        icon: '🌀',
        type: 'passive',
        tier: 5,
        description: 'All equipment bonuses +5% per level',
        effect: {
            stat: 'bonusEnhance',
            base: 5,
            perLevel: 5,
        },
    },

    // --- Tier 6 (Mythic) ---
    {
        id: 'soulHarvest',
        name: 'Soul Harvest',
        icon: '👻',
        type: 'passive',
        tier: 6,
        description: '+1% damage per kill in wave (+0.5%/lvl, resets between waves)',
        effect: {
            stat: 'soulHarvest',
            base: 1,
            perLevel: 0.5,
        },
    },
    {
        id: 'transcendence',
        name: 'Transcendence',
        icon: '✨',
        type: 'passive',
        tier: 6,
        description: 'All stats +1% per player level per skill level',
        effect: {
            stat: 'transcendence',
            base: 1,
            perLevel: 1,
        },
    },

    // ═══════════════════ ACTIVE SKILLS ═══════════════════

    // --- Tier 1 (Common) ---
    {
        id: 'shieldWall',
        name: 'Shield Wall',
        icon: '🛡️',
        type: 'active',
        tier: 1,
        description: 'Reduce damage taken by 20% for 5s (+2%/lvl)',
        effect: {
            stat: 'damageReduction',
            base: 20,
            perLevel: 2,
        },
        duration: 5,        // seconds
        cooldown: 30,       // seconds
        cooldownPerLevel: -1, // -1s CD per level
    },
    {
        id: 'powerStrike',
        name: 'Power Strike',
        icon: '💪',
        type: 'active',
        tier: 1,
        description: 'Next 3 attacks deal +50% damage (+10%/lvl)',
        effect: {
            stat: 'powerStrike',
            base: 50,
            perLevel: 10,
        },
        duration: 0,        // instant (charge-based: 3 attacks)
        charges: 3,
        cooldown: 25,
        cooldownPerLevel: 0,
    },

    // --- Tier 2 (Uncommon) ---
    {
        id: 'battleCry',
        name: 'Battle Cry',
        icon: '📯',
        type: 'active',
        tier: 2,
        description: '+30% attack speed for 6s (+5%/lvl)',
        effect: {
            stat: 'attackSpeedBurst',
            base: 30,
            perLevel: 5,
        },
        duration: 6,
        cooldown: 35,
        cooldownPerLevel: -1,
    },
    {
        id: 'healingSurge',
        name: 'Healing Surge',
        icon: '💚',
        type: 'active',
        tier: 2,
        description: 'Instantly heal 20% max HP (+3%/lvl)',
        effect: {
            stat: 'instantHeal',
            base: 20,
            perLevel: 3,
        },
        duration: 0,
        cooldown: 40,
        cooldownPerLevel: -1,
    },

    // --- Tier 3 (Rare) ---
    {
        id: 'focus',
        name: 'Focus',
        icon: '🎯',
        type: 'active',
        tier: 3,
        description: '+15% crit chance & +30% crit multi for 8s',
        effect: {
            stat: 'focusBurst',
            base: 15,       // crit chance
            perLevel: 2,    // +2% crit chance per level
            baseCritMulti: 30,
            critMultiPerLevel: 5,
        },
        duration: 8,
        cooldown: 45,
        cooldownPerLevel: -1,
    },
    {
        id: 'enrage',
        name: 'Enrage',
        icon: '😤',
        type: 'active',
        tier: 3,
        description: '+40% damage but +20% damage taken for 8s',
        effect: {
            stat: 'enrage',
            base: 40,       // damage bonus
            perLevel: 5,    // +5% damage per level
            damageTaken: 20, // starts at +20% damage taken
            damageTakenPerLevel: -2, // -2% per level
        },
        duration: 8,
        cooldown: 30,
        cooldownPerLevel: 0,
    },

    // --- Tier 4 (Epic) ---
    {
        id: 'evasion',
        name: 'Evasion',
        icon: '💨',
        type: 'active',
        tier: 4,
        description: '30% dodge chance for 6s (+5%/lvl)',
        effect: {
            stat: 'evasion',
            base: 30,
            perLevel: 5,
        },
        duration: 6,
        cooldown: 40,
        cooldownPerLevel: -1,
    },
    {
        id: 'lifeDrain',
        name: 'Life Drain',
        icon: '🩸',
        type: 'active',
        tier: 4,
        description: '+25% life steal for 8s (+5%/lvl)',
        effect: {
            stat: 'lifeStealBurst',
            base: 25,
            perLevel: 5,
        },
        duration: 8,
        cooldown: 45,
        cooldownPerLevel: -1,
    },

    // --- Tier 5 (Legendary) ---
    {
        id: 'warCry',
        name: 'War Cry',
        icon: '⚔️',
        type: 'active',
        tier: 5,
        description: '+15% ALL stats for 10s (+2%/lvl)',
        effect: {
            stat: 'warCry',
            base: 15,
            perLevel: 2,
        },
        duration: 10,
        cooldown: 60,
        cooldownPerLevel: -2,
    },
    {
        id: 'execute',
        name: 'Execute',
        icon: '🔪',
        type: 'active',
        tier: 5,
        description: '300% damage to monsters < 30% HP (+50%/lvl)',
        effect: {
            stat: 'execute',
            base: 300,
            perLevel: 50,
            threshold: 30,  // monster HP % threshold
        },
        duration: 0,
        cooldown: 45,
        cooldownPerLevel: -2,
    },

    // --- Tier 6 (Mythic) ---
    {
        id: 'apocalypse',
        name: 'Apocalypse',
        icon: '☄️',
        type: 'active',
        tier: 6,
        description: '500% damage to ALL monsters (+100%/lvl)',
        effect: {
            stat: 'apocalypse',
            base: 500,
            perLevel: 100,
        },
        duration: 0,
        cooldown: 90,
        cooldownPerLevel: -5,
    },
    {
        id: 'divineShield',
        name: 'Divine Shield',
        icon: '🔱',
        type: 'active',
        tier: 6,
        description: 'Immune to all damage for 4s (+0.5s/lvl)',
        effect: {
            stat: 'divineShield',
            base: 4,        // base duration in seconds
            perLevel: 0.5,  // +0.5s per level
        },
        duration: 4,
        durationPerLevel: 0.5,
        cooldown: 120,
        cooldownPerLevel: -5,
    },
];

// ── Helpers ────────────────────────────────────────────────

export function getSkillById(id) {
    return SKILLS.find(s => s.id === id) || null;
}

export function getSkillsByTier(tier) {
    return SKILLS.filter(s => s.tier === tier);
}

export function getSkillsByType(type) {
    return SKILLS.filter(s => s.type === type);
}

export function getSkillMaxLevel(skill) {
    return SKILL_MAX_LEVELS[skill.tier] || 1;
}

export function getSkillUnlockReqs(tier) {
    return SKILL_UNLOCK_REQS.find(r => r.tier === tier) || SKILL_UNLOCK_REQS[0];
}

/** Calculate the effect value at a given level */
export function getSkillEffectValue(skill, level) {
    return skill.effect.base + skill.effect.perLevel * (level - 1);
}

/** Calculate the level-up cost for a given skill tier and target level */
export function getSkillLevelUpCost(tier, targetLevel) {
    const baseCost = SKILL_LEVEL_BASE_COST[tier] || 30;
    return Math.floor(baseCost * Math.pow(SKILL_LEVEL_COST_SCALE, targetLevel - 1));
}

/** Get the effective cooldown at a given level */
export function getSkillCooldown(skill, level) {
    if (skill.type !== 'active') return 0;
    const cdReduction = (skill.cooldownPerLevel || 0) * (level - 1);
    return Math.max(5, skill.cooldown + cdReduction);
}

/** Get the effective duration at a given level */
export function getSkillDuration(skill, level) {
    if (skill.type !== 'active') return 0;
    const durationBonus = (skill.durationPerLevel || 0) * (level - 1);
    return skill.duration + durationBonus;
}

/** Get tier definition for a skill */
export function getSkillTier(skill) {
    return TIERS[(skill.tier || 1) - 1];
}
