// ══════════════════════════════════════════════════════════
// Skills System — unlock, level-up, equip, activate
// ══════════════════════════════════════════════════════════

import {
    SKILLS, getSkillById, getSkillMaxLevel, getSkillUnlockReqs,
    getSkillLevelUpCost, getSkillCooldown, getSkillDuration,
    getSkillEffectValue, MAX_EQUIPPED_SKILLS,
} from './skills-config.js';
import {
    getEssence, getGold, getCombatProgress, getPlayerLevel,
    addGold, spendEssence, saveGame,
} from './state.js';
import { gameEvents, EVENTS } from './events.js';

// ── Runtime state (not persisted — persisted parts are in state.js) ──

// Active skill effects currently running { [skillId]: { expiresAt, effectValue, ... } }
const activeEffects = {};

// Cooldown timers { [skillId]: expiresAt (timestamp) }
const cooldowns = {};

// Power Strike remaining charges { charges: number }
const powerStrikeState = { charges: 0, bonusPct: 0 };

// Soul Harvest wave kill counter
const soulHarvestState = { killCount: 0 };

// Undying Will internal cooldown timestamp
let undyingWillLastProc = 0;

// ── Persisted state accessors (delegated to state.js) ──

// These are imported from state.js after we add the skill state there
import {
    getSkillsState, setSkillUnlocked, setSkillLevel,
    getEquippedSkills, setEquippedSkills,
} from './state.js';

// ── Unlock ─────────────────────────────────────────────────

export function canUnlockSkill(skillId) {
    const skill = getSkillById(skillId);
    if (!skill) return false;

    const state = getSkillsState();
    if (state.unlocked[skillId]) return false; // already unlocked

    const reqs = getSkillUnlockReqs(skill.tier);
    const combat = getCombatProgress();

    if (combat.highestWave < reqs.wave) return false;
    if (getEssence() < reqs.essenceCost) return false;
    if (getGold() < reqs.goldCost) return false;

    return true;
}

export function unlockSkill(skillId) {
    if (!canUnlockSkill(skillId)) return false;

    const skill = getSkillById(skillId);
    const reqs = getSkillUnlockReqs(skill.tier);

    // Spend resources
    spendEssence(reqs.essenceCost);
    addGold(-reqs.goldCost);

    setSkillUnlocked(skillId, 1);
    saveGame();
    gameEvents.emit(EVENTS.SKILL_UNLOCKED, { skillId, skill });
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

// ── Level-up ───────────────────────────────────────────────

export function canLevelUpSkill(skillId) {
    const skill = getSkillById(skillId);
    if (!skill) return false;

    const state = getSkillsState();
    const currentLevel = state.unlocked[skillId] || 0;
    if (currentLevel <= 0) return false; // not unlocked

    const maxLevel = getSkillMaxLevel(skill);
    if (currentLevel >= maxLevel) return false;

    const cost = getSkillLevelUpCost(skill.tier, currentLevel + 1);
    if (getEssence() < cost) return false;

    return true;
}

export function levelUpSkill(skillId) {
    if (!canLevelUpSkill(skillId)) return false;

    const skill = getSkillById(skillId);
    const state = getSkillsState();
    const currentLevel = state.unlocked[skillId];
    const cost = getSkillLevelUpCost(skill.tier, currentLevel + 1);

    spendEssence(cost);
    setSkillLevel(skillId, currentLevel + 1);
    saveGame();
    gameEvents.emit(EVENTS.SKILL_LEVELED, { skillId, level: currentLevel + 1 });
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

// ── Equip / Unequip ────────────────────────────────────────

export function getSkillLevel(skillId) {
    const state = getSkillsState();
    return state.unlocked[skillId] || 0;
}

export function isSkillEquipped(skillId) {
    return getEquippedSkills().includes(skillId);
}

export function equipSkill(skillId) {
    const state = getSkillsState();
    if (!state.unlocked[skillId]) return false;

    const equipped = [...getEquippedSkills()];
    if (equipped.includes(skillId)) return false; // already equipped
    if (equipped.length >= MAX_EQUIPPED_SKILLS) return false;

    equipped.push(skillId);
    setEquippedSkills(equipped);
    saveGame();
    gameEvents.emit(EVENTS.SKILL_EQUIPPED, { skillId });
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

export function unequipSkill(skillId) {
    const equipped = [...getEquippedSkills()];
    const idx = equipped.indexOf(skillId);
    if (idx === -1) return false;

    equipped.splice(idx, 1);
    setEquippedSkills(equipped);

    // Clear any active effect or cooldown
    delete activeEffects[skillId];
    delete cooldowns[skillId];

    saveGame();
    gameEvents.emit(EVENTS.SKILL_UNEQUIPPED, { skillId });
    gameEvents.emit(EVENTS.STATE_CHANGED);
    return true;
}

// ── Active skill activation ────────────────────────────────

export function canActivateSkill(skillId) {
    const skill = getSkillById(skillId);
    if (!skill || skill.type !== 'active') return false;
    if (!isSkillEquipped(skillId)) return false;

    // Check cooldown
    if (cooldowns[skillId] && Date.now() < cooldowns[skillId]) return false;

    return true;
}

export function activateSkill(skillId) {
    if (!canActivateSkill(skillId)) return false;

    const skill = getSkillById(skillId);
    const level = getSkillLevel(skillId);
    const effectValue = getSkillEffectValue(skill, level);
    const duration = getSkillDuration(skill, level);
    const cd = getSkillCooldown(skill, level);
    const now = Date.now();

    // Set cooldown
    cooldowns[skillId] = now + cd * 1000;

    // Handle charge-based skills (Power Strike)
    if (skill.effect.stat === 'powerStrike') {
        powerStrikeState.charges = skill.charges || 3;
        powerStrikeState.bonusPct = effectValue;
        gameEvents.emit(EVENTS.SKILL_ACTIVATED, { skillId, skill, effectValue, duration: 0 });
        return true;
    }

    // Handle instant skills
    if (duration === 0) {
        applyInstantSkill(skill, level, effectValue);
        gameEvents.emit(EVENTS.SKILL_ACTIVATED, { skillId, skill, effectValue, duration: 0 });
        return true;
    }

    // Duration-based active effects
    activeEffects[skillId] = {
        expiresAt: now + duration * 1000,
        effectValue,
        skill,
        level,
    };

    gameEvents.emit(EVENTS.SKILL_ACTIVATED, { skillId, skill, effectValue, duration });
    return true;
}

function applyInstantSkill(skill, level, effectValue) {
    // Handled via combat integration — the combat tick checks for these
    // For Healing Surge, Execute, Apocalypse: we store a one-frame flag
    activeEffects[skill.id] = {
        expiresAt: Date.now() + 100, // expire next tick
        effectValue,
        skill,
        level,
        instant: true,
    };
}

// ── Combat integration helpers ─────────────────────────────

/** Called every combat tick to expire effects */
export function tickSkillEffects() {
    const now = Date.now();
    for (const [skillId, effect] of Object.entries(activeEffects)) {
        if (now >= effect.expiresAt) {
            delete activeEffects[skillId];
            gameEvents.emit(EVENTS.SKILL_EXPIRED, { skillId });
        }
    }
}

/** Check if an active effect is running */
export function isEffectActive(skillId) {
    return !!activeEffects[skillId];
}

/** Get the active effect data for a skill */
export function getActiveEffect(skillId) {
    return activeEffects[skillId] || null;
}

/** Get cooldown remaining in ms (0 = ready) */
export function getCooldownRemaining(skillId) {
    if (!cooldowns[skillId]) return 0;
    return Math.max(0, cooldowns[skillId] - Date.now());
}

/** Get all active effects (for combat system) */
export function getAllActiveEffects() {
    return { ...activeEffects };
}

/** Get all cooldowns */
export function getAllCooldowns() {
    return { ...cooldowns };
}

// ── Passive skill effect queries (used in combat) ──────────

export function getPassiveEffects() {
    const equipped = getEquippedSkills();
    const effects = {};

    for (const skillId of equipped) {
        const skill = getSkillById(skillId);
        if (!skill || skill.type !== 'passive') continue;
        const level = getSkillLevel(skillId);
        if (level <= 0) continue;

        const value = getSkillEffectValue(skill, level);
        effects[skill.effect.stat] = (effects[skill.effect.stat] || 0) + value;
    }

    return effects;
}

// ── Soul Harvest ───────────────────────────────────────────

export function onMonsterKilled() {
    soulHarvestState.killCount++;
}

export function getSoulHarvestBonus() {
    const equipped = getEquippedSkills();
    if (!equipped.includes('soulHarvest')) return 0;
    const level = getSkillLevel('soulHarvest');
    if (level <= 0) return 0;
    const perKill = getSkillEffectValue(getSkillById('soulHarvest'), level);
    return soulHarvestState.killCount * perKill;
}

export function resetSoulHarvest() {
    soulHarvestState.killCount = 0;
}

// ── Power Strike ───────────────────────────────────────────

export function consumePowerStrike() {
    if (powerStrikeState.charges <= 0) return 0;
    powerStrikeState.charges--;
    return powerStrikeState.bonusPct;
}

export function getPowerStrikeCharges() {
    return powerStrikeState.charges;
}

// ── Undying Will ───────────────────────────────────────────

export function tryUndyingWill() {
    const equipped = getEquippedSkills();
    if (!equipped.includes('undyingWill')) return false;

    const level = getSkillLevel('undyingWill');
    if (level <= 0) return false;

    const skill = getSkillById('undyingWill');
    const cd = getSkillEffectValue(skill, level); // cooldown in seconds
    const now = Date.now();

    if (now - undyingWillLastProc < cd * 1000) return false;

    undyingWillLastProc = now;
    return true;
}

// ── Reset on wave change ───────────────────────────────────

export function resetSkillsForWave() {
    resetSoulHarvest();
}

/** Clear all runtime state (when combat restarts) */
export function resetAllSkillRuntime() {
    Object.keys(activeEffects).forEach(k => delete activeEffects[k]);
    Object.keys(cooldowns).forEach(k => delete cooldowns[k]);
    powerStrikeState.charges = 0;
    powerStrikeState.bonusPct = 0;
    soulHarvestState.killCount = 0;
    undyingWillLastProc = 0;
}
