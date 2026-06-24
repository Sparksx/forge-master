import { EQUIPMENT_TYPES, MAX_TIER, MAX_PLAYER_LEVEL } from '../../shared/stats.js';

export function isValidItem(item) {
    if (item === null) return true;
    if (typeof item !== 'object' || Array.isArray(item)) return false;
    if (typeof item.level !== 'number' || item.level < 1) return false;
    if (typeof item.tier !== 'number' || item.tier < 1 || item.tier > MAX_TIER) return false;
    if (typeof item.type !== 'string' || !EQUIPMENT_TYPES.includes(item.type)) return false;
    if (item.bonuses !== undefined) {
        if (!Array.isArray(item.bonuses)) return false;
        for (const b of item.bonuses) {
            if (typeof b !== 'object' || !b.type || typeof b.value !== 'number') return false;
        }
    }
    return true;
}

export function isValidEquipment(equipment) {
    if (typeof equipment !== 'object' || Array.isArray(equipment) || equipment === null) return false;
    for (const [slot, item] of Object.entries(equipment)) {
        if (!EQUIPMENT_TYPES.includes(slot)) return false;
        if (!isValidItem(item)) return false;
    }
    return true;
}

export function isValidCombat(combat) {
    if (typeof combat !== 'object' || Array.isArray(combat) || combat === null) return false;
    const { currentWave, currentSubWave, highestWave, highestSubWave } = combat;
    if (typeof currentWave !== 'number' || currentWave < 1) return false;
    if (typeof currentSubWave !== 'number' || currentSubWave < 1) return false;
    if (typeof highestWave !== 'number' || highestWave < 1) return false;
    if (typeof highestSubWave !== 'number' || highestSubWave < 1) return false;
    return true;
}

export function isValidForgeUpgrade(forgeUpgrade) {
    if (forgeUpgrade === null) return true;
    if (typeof forgeUpgrade !== 'object' || Array.isArray(forgeUpgrade)) return false;
    if (typeof forgeUpgrade.targetLevel !== 'number' || forgeUpgrade.targetLevel < 2) return false;
    if (typeof forgeUpgrade.startedAt !== 'number' && typeof forgeUpgrade.startedAt !== 'string') return false;
    return true;
}

export function isValidPlayer(player) {
    if (typeof player !== 'object' || Array.isArray(player) || player === null) return false;
    if (typeof player.level !== 'number' || player.level < 1 || player.level > MAX_PLAYER_LEVEL) return false;
    if (typeof player.xp !== 'number' || player.xp < 0) return false;
    if (player.forgeXp !== undefined && (typeof player.forgeXp !== 'number' || player.forgeXp < 0)) return false;
    return true;
}

export function isValidResearch(research) {
    if (typeof research !== 'object' || Array.isArray(research) || research === null) return false;
    if (research.completed && typeof research.completed !== 'object') return false;
    if (research.active !== null && research.active !== undefined) {
        if (typeof research.active !== 'object') return false;
    }
    if (research.queue !== undefined && !Array.isArray(research.queue)) return false;
    return true;
}

export function isValidForgeHighestLevel(forgeHighestLevel) {
    if (typeof forgeHighestLevel !== 'object' || Array.isArray(forgeHighestLevel) || forgeHighestLevel === null) return false;
    return true;
}

export function isValidSkills(skills) {
    if (typeof skills !== 'object' || Array.isArray(skills) || skills === null) return false;
    if (skills.unlocked !== undefined && (typeof skills.unlocked !== 'object' || Array.isArray(skills.unlocked))) return false;
    if (skills.equipped !== undefined && !Array.isArray(skills.equipped)) return false;
    if (skills.equipped && skills.equipped.length > 3) return false;
    return true;
}
