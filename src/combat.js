import { BASE_HEALTH, BASE_DAMAGE } from './config.js';
import { getEquipment, getCombatProgress, setCombatWave, getTechEffect, getPlayerLevel, addSkillShards } from './state.js';
import { SKILL_SHARD_PER_SUBWAVE, SKILL_SHARD_BOSS_BONUS } from './skills-config.js';
import { calculateStats, calculatePowerScore } from './forge.js';
import { gameEvents, EVENTS } from './events.js';
import { getMonsterForWave, getMonsterCount, getMaxWaveCount, SUB_WAVE_COUNT } from './monsters.js';
import {
    tickSkillEffects, getPassiveEffects, isEffectActive, getActiveEffect,
    consumePowerStrike, getSoulHarvestBonus, onMonsterKilled, resetSkillsForWave,
    tryUndyingWill, resetAllSkillRuntime, getAllActiveEffects,
} from './skills.js';

// Combat tick rate (ms)
const TICK_RATE = 100;

// Combat runtime state (not persisted)
let combatInterval = null;
let playerState = null;
let monsterState = null; // the focused monster (alias into monstersInWave)
let lastPlayerAttack = 0;
let lastMonsterAttacks = []; // per-monster attack timers
let combatPaused = false;

// Multi-monster state
let monstersInWave = [];     // all monsters for current sub-wave
let currentMonsterIndex = 0; // which monster the player focuses
let totalMonstersInWave = 0;
let aliveMonstersCount = 0;  // track alive count to skip iteration when all dead

export function getPlayerCombatState() {
    return playerState;
}

export function getMonsterCombatState() {
    return monsterState;
}

export function getAllMonsters() {
    return monstersInWave;
}

export function getCurrentMonsterIndex() {
    return currentMonsterIndex;
}

export function isCombatRunning() {
    return combatInterval !== null && !combatPaused;
}

export function isCombatPaused() {
    return combatPaused;
}

export function getMonsterProgress() {
    return { current: currentMonsterIndex + 1, total: totalMonstersInWave };
}

function getPlayerStats() {
    const equipment = getEquipment();
    const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);

    // Tech bonuses
    const vitalityPct = getTechEffect('vitality');       // +2% total health per level
    const strengthPct = getTechEffect('strength');         // +2% total damage per level
    const swiftPct = getTechEffect('swiftStrikes');        // +3% attack speed per level

    // Passive skill bonuses
    const passive = getPassiveEffects();

    // Elemental Mastery: enhance all equipment bonuses
    const bonusEnhancePct = (passive.bonusEnhance || 0);
    const enhancedBonuses = { ...bonuses };
    if (bonusEnhancePct > 0) {
        for (const key of Object.keys(enhancedBonuses)) {
            enhancedBonuses[key] = enhancedBonuses[key] * (1 + bonusEnhancePct / 100);
        }
    }

    // Transcendence: all stats scale with player level
    const transcendPct = (passive.transcendence || 0) * getPlayerLevel();

    const hpMulti = 1 + (passive.maxHPPercent || 0) / 100 + transcendPct / 100;
    const dmgMulti = 1 + (passive.damagePercent || 0) / 100 + transcendPct / 100;

    const rawHP = BASE_HEALTH + Math.floor(totalHealth * (1 + (enhancedBonuses.healthMulti || 0) / 100));
    const maxHP = Math.floor(rawHP * (1 + vitalityPct / 100) * hpMulti);
    const rawDmg = BASE_DAMAGE + Math.floor(totalDamage * (1 + (enhancedBonuses.damageMulti || 0) / 100));
    const baseDmg = Math.floor(rawDmg * (1 + strengthPct / 100) * dmgMulti);
    const totalAttackSpeed = (enhancedBonuses.attackSpeed || 0) + swiftPct + (passive.attackSpeedPercent || 0);
    const attackSpeed = Math.max(400, 1500 - totalAttackSpeed * 15);

    return {
        maxHP,
        damage: baseDmg,
        attackSpeed,
        critChance: (enhancedBonuses.critChance || 0) + (passive.critChanceFlat || 0),
        critMultiplier: enhancedBonuses.critMultiplier || 0,
        healthRegen: enhancedBonuses.healthRegen || 0,
        lifeSteal: (enhancedBonuses.lifeSteal || 0) + (passive.lifeStealFlat || 0),
    };
}

function spawnWaveMonsters() {
    const { currentWave, currentSubWave } = getCombatProgress();
    const count = getMonsterCount(currentSubWave);
    totalMonstersInWave = count;
    aliveMonstersCount = count;
    currentMonsterIndex = 0;
    monstersInWave = [];

    for (let i = 0; i < count; i++) {
        const monster = getMonsterForWave(currentWave, currentSubWave);
        monstersInWave.push({
            ...monster,
            currentHP: monster.maxHP,
        });
    }

    // Initialize per-monster attack timers
    lastMonsterAttacks = monstersInWave.map(() => 0);

    monsterState = monstersInWave[0];
    return monsterState;
}

function initPlayerState() {
    const stats = getPlayerStats();
    playerState = {
        maxHP: stats.maxHP,
        currentHP: stats.maxHP,
        damage: stats.damage,
        attackSpeed: stats.attackSpeed,
        critChance: stats.critChance,
        critMultiplier: stats.critMultiplier,
        healthRegen: stats.healthRegen,
        lifeSteal: stats.lifeSteal,
    };
    return playerState;
}

function resetPlayerToFull() {
    const stats = getPlayerStats();
    playerState.maxHP = stats.maxHP;
    playerState.currentHP = stats.maxHP;
    playerState.damage = stats.damage;
    playerState.attackSpeed = stats.attackSpeed;
    playerState.critChance = stats.critChance;
    playerState.critMultiplier = stats.critMultiplier;
    playerState.healthRegen = stats.healthRegen;
    playerState.lifeSteal = stats.lifeSteal;
}

export function refreshPlayerStats() {
    if (!playerState) return;
    const stats = getPlayerStats();
    const hpRatio = playerState.currentHP / playerState.maxHP;
    playerState.maxHP = stats.maxHP;
    playerState.currentHP = Math.min(Math.floor(stats.maxHP * hpRatio), stats.maxHP);
    playerState.damage = stats.damage;
    playerState.attackSpeed = stats.attackSpeed;
    playerState.critChance = stats.critChance;
    playerState.critMultiplier = stats.critMultiplier;
    playerState.healthRegen = stats.healthRegen;
    playerState.lifeSteal = stats.lifeSteal;
}

function emitCombatStart() {
    gameEvents.emit(EVENTS.COMBAT_START, {
        player: playerState,
        monster: monsterState,
        monsters: monstersInWave,
        focusIndex: currentMonsterIndex,
        monsterProgress: getMonsterProgress(),
    });
}

export function startCombat() {
    if (combatInterval) return;

    resetAllSkillRuntime();
    initPlayerState();
    spawnWaveMonsters();
    lastPlayerAttack = 0;
    lastMonsterAttacks = monstersInWave.map(() => 0);
    combatPaused = false;

    emitCombatStart();

    combatInterval = setInterval(() => {
        if (combatPaused) return;
        combatTick();
    }, TICK_RATE);
}

export function pauseCombat() {
    combatPaused = true;
}

export function resumeCombat() {
    combatPaused = false;
}

export function stopCombat() {
    if (combatInterval) {
        clearInterval(combatInterval);
        combatInterval = null;
    }
    combatPaused = false;
}

function getActiveSkillModifiers() {
    const mods = {
        damageReduction: 0,
        attackSpeedBurst: 0,
        critChanceBurst: 0,
        critMultiBurst: 0,
        lifeStealBurst: 0,
        damageBurst: 0,
        damageTakenIncrease: 0,
        evasionChance: 0,
        divineShield: false,
        allStatsPct: 0,
    };

    const effects = getAllActiveEffects();
    for (const [skillId, effect] of Object.entries(effects)) {
        if (effect.instant) continue;
        const stat = effect.skill.effect.stat;
        switch (stat) {
            case 'damageReduction':
                mods.damageReduction += effect.effectValue;
                break;
            case 'attackSpeedBurst':
                mods.attackSpeedBurst += effect.effectValue;
                break;
            case 'focusBurst': {
                const skill = effect.skill;
                mods.critChanceBurst += effect.effectValue;
                const critMulti = (skill.effect.baseCritMulti || 0) + (skill.effect.critMultiPerLevel || 0) * (effect.level - 1);
                mods.critMultiBurst += critMulti;
                break;
            }
            case 'enrage': {
                const skill = effect.skill;
                mods.damageBurst += effect.effectValue;
                const taken = (skill.effect.damageTaken || 0) + (skill.effect.damageTakenPerLevel || 0) * (effect.level - 1);
                mods.damageTakenIncrease += Math.max(0, taken);
                break;
            }
            case 'evasion':
                mods.evasionChance += effect.effectValue;
                break;
            case 'lifeStealBurst':
                mods.lifeStealBurst += effect.effectValue;
                break;
            case 'warCry':
                mods.allStatsPct += effect.effectValue;
                break;
            case 'divineShield':
                mods.divineShield = true;
                break;
        }
    }
    return mods;
}

function combatTick() {
    if (!playerState || monstersInWave.length === 0) return;

    // Tick skill effect timers
    tickSkillEffects();

    // Handle instant active skills (Healing Surge, Execute, Apocalypse)
    handleInstantActiveSkills();

    lastPlayerAttack += TICK_RATE;

    const mods = getActiveSkillModifiers();
    const passive = getPassiveEffects();

    // Berserker's Rage: double attack speed when low HP
    let berserkerActive = false;
    if (passive.berserkerRage) {
        const hpPct = (playerState.currentHP / playerState.maxHP) * 100;
        if (hpPct < passive.berserkerRage) {
            berserkerActive = true;
        }
    }

    // Health regen (% of max HP per second)
    if (playerState.healthRegen > 0) {
        const regenAmount = (playerState.maxHP * playerState.healthRegen / 100) * (TICK_RATE / 1000);
        playerState.currentHP = Math.min(playerState.maxHP, playerState.currentHP + regenAmount);
    }

    // Calculate effective attack speed with active skill modifiers
    let effectiveAttackSpeed = playerState.attackSpeed;
    if (mods.attackSpeedBurst > 0 || mods.allStatsPct > 0) {
        const speedBonus = mods.attackSpeedBurst + mods.allStatsPct;
        effectiveAttackSpeed = Math.max(400, effectiveAttackSpeed * (1 - speedBonus / 100));
    }
    if (berserkerActive) {
        effectiveAttackSpeed = Math.max(400, effectiveAttackSpeed / 2);
    }

    // Player attacks the focused monster
    if (lastPlayerAttack >= effectiveAttackSpeed) {
        lastPlayerAttack -= effectiveAttackSpeed;
        playerAttack(mods, passive);
    }

    // Each alive monster attacks independently based on its own speed
    for (let i = 0; i < monstersInWave.length; i++) {
        const m = monstersInWave[i];
        if (m.currentHP <= 0) continue;

        lastMonsterAttacks[i] += TICK_RATE;
        if (lastMonsterAttacks[i] >= m.attackSpeed) {
            lastMonsterAttacks[i] -= m.attackSpeed;
            singleMonsterAttack(i, mods, passive);
            if (playerState.currentHP <= 0) break;
        }
    }

    gameEvents.emit(EVENTS.COMBAT_TICK, {
        player: playerState,
        monsters: monstersInWave,
        focusIndex: currentMonsterIndex,
    });
}

function handleInstantActiveSkills() {
    const effects = getAllActiveEffects();

    // Healing Surge
    const healEffect = effects.healingSurge;
    if (healEffect && healEffect.instant && playerState) {
        const healPct = healEffect.effectValue;
        const healAmount = Math.floor(playerState.maxHP * healPct / 100);
        playerState.currentHP = Math.min(playerState.maxHP, playerState.currentHP + healAmount);
        gameEvents.emit(EVENTS.COMBAT_PLAYER_LIFESTEAL, { amount: healAmount });
    }

    // Execute: massive damage to focused monster if below threshold
    const execEffect = effects.execute;
    if (execEffect && execEffect.instant && monsterState && monsterState.currentHP > 0) {
        const threshold = execEffect.skill.effect.threshold || 30;
        const monsterHpPct = (monsterState.currentHP / monsterState.maxHP) * 100;
        if (monsterHpPct <= threshold) {
            const dmg = Math.floor(playerState.damage * execEffect.effectValue / 100);
            monsterState.currentHP -= dmg;
            gameEvents.emit(EVENTS.COMBAT_PLAYER_HIT, { damage: dmg, isCrit: false, monsterIndex: currentMonsterIndex });
            if (monsterState.currentHP <= 0) {
                monsterState.currentHP = 0;
                aliveMonstersCount--;
                onMonsterKilled();
                onMonsterDefeated();
            }
        }
    }

    // Apocalypse: massive damage to ALL monsters
    const apoEffect = effects.apocalypse;
    if (apoEffect && apoEffect.instant) {
        for (let i = 0; i < monstersInWave.length; i++) {
            const m = monstersInWave[i];
            if (m.currentHP <= 0) continue;
            const dmg = Math.floor(playerState.damage * apoEffect.effectValue / 100);
            m.currentHP -= dmg;
            gameEvents.emit(EVENTS.COMBAT_PLAYER_HIT, { damage: dmg, isCrit: false, monsterIndex: i });
            if (m.currentHP <= 0) {
                m.currentHP = 0;
                aliveMonstersCount--;
                onMonsterKilled();
            }
        }
        // Check if all dead
        if (aliveMonstersCount <= 0) {
            onMonsterDefeated();
        }
    }
}

function playerAttack(mods, passive) {
    if (!monsterState || monsterState.currentHP <= 0) return;

    let dmg = playerState.damage;
    let isCrit = false;

    // Soul Harvest bonus (stacking damage per kill)
    const soulBonus = getSoulHarvestBonus();
    if (soulBonus > 0) {
        dmg = Math.floor(dmg * (1 + soulBonus / 100));
    }

    // Active skill damage modifiers
    if (mods.damageBurst > 0 || mods.allStatsPct > 0) {
        dmg = Math.floor(dmg * (1 + (mods.damageBurst + mods.allStatsPct) / 100));
    }

    // Power Strike charges
    const powerStrikeBonus = consumePowerStrike();
    if (powerStrikeBonus > 0) {
        dmg = Math.floor(dmg * (1 + powerStrikeBonus / 100));
    }

    // Crit (with active skill bonuses)
    const effectiveCritChance = playerState.critChance + (mods.critChanceBurst || 0) + (mods.allStatsPct || 0);
    const effectiveCritMulti = playerState.critMultiplier + (mods.critMultiBurst || 0) + (mods.allStatsPct || 0);
    if (effectiveCritChance > 0 && Math.random() * 100 < effectiveCritChance) {
        dmg = Math.floor(dmg * (1 + effectiveCritMulti / 100));
        isCrit = true;
    }

    const variance = 0.9 + Math.random() * 0.2;
    dmg = Math.max(1, Math.floor(dmg * variance));

    // Overkill tracking
    const overkillPct = passive.overkill || 0;
    const prevHP = monsterState.currentHP;
    monsterState.currentHP -= dmg;

    if (isCrit) {
        gameEvents.emit(EVENTS.COMBAT_PLAYER_CRIT, { damage: dmg });
    }
    gameEvents.emit(EVENTS.COMBAT_PLAYER_HIT, { damage: dmg, isCrit, monsterIndex: currentMonsterIndex });

    // Life steal (with active skill bonuses)
    const effectiveLifeSteal = playerState.lifeSteal + (mods.lifeStealBurst || 0) + (mods.allStatsPct || 0);
    if (effectiveLifeSteal > 0) {
        const healAmount = Math.floor(dmg * effectiveLifeSteal / 100);
        if (healAmount > 0) {
            playerState.currentHP = Math.min(playerState.maxHP, playerState.currentHP + healAmount);
            gameEvents.emit(EVENTS.COMBAT_PLAYER_LIFESTEAL, { amount: healAmount });
        }
    }

    if (monsterState.currentHP <= 0) {
        monsterState.currentHP = 0;
        aliveMonstersCount--;
        onMonsterKilled();

        // Overkill: carry excess damage to next alive monster
        if (overkillPct > 0 && prevHP > 0) {
            const excessDmg = Math.abs(prevHP - dmg);
            const carryDmg = Math.floor(excessDmg * overkillPct / 100);
            if (carryDmg > 0 && aliveMonstersCount > 0) {
                applyOverkillDamage(carryDmg);
            }
        }

        onMonsterDefeated();
    }
}

function applyOverkillDamage(dmg) {
    for (let i = 0; i < monstersInWave.length; i++) {
        if (monstersInWave[i].currentHP > 0) {
            monstersInWave[i].currentHP -= dmg;
            gameEvents.emit(EVENTS.COMBAT_PLAYER_HIT, { damage: dmg, isCrit: false, monsterIndex: i });
            if (monstersInWave[i].currentHP <= 0) {
                monstersInWave[i].currentHP = 0;
                aliveMonstersCount--;
                onMonsterKilled();
            }
            break;
        }
    }
}

function singleMonsterAttack(i, mods, passive) {
    const m = monstersInWave[i];
    if (!m || m.currentHP <= 0) return;

    // Divine Shield: immune to all damage
    if (mods.divineShield) {
        gameEvents.emit(EVENTS.COMBAT_MONSTER_HIT, { damage: 0, monsterIndex: i, dodged: true });
        return;
    }

    // Evasion: chance to dodge
    if (mods.evasionChance > 0 && Math.random() * 100 < mods.evasionChance) {
        gameEvents.emit(EVENTS.COMBAT_MONSTER_HIT, { damage: 0, monsterIndex: i, dodged: true });
        return;
    }

    const variance = 0.9 + Math.random() * 0.2;
    let dmg = Math.max(1, Math.floor(m.damage * variance));

    // Damage reduction from active skills
    const totalReduction = mods.damageReduction + (mods.allStatsPct || 0);
    if (totalReduction > 0) {
        dmg = Math.max(1, Math.floor(dmg * (1 - totalReduction / 100)));
    }

    // Enrage: increased damage taken
    if (mods.damageTakenIncrease > 0) {
        dmg = Math.floor(dmg * (1 + mods.damageTakenIncrease / 100));
    }

    playerState.currentHP -= dmg;
    gameEvents.emit(EVENTS.COMBAT_MONSTER_HIT, { damage: dmg, monsterIndex: i });

    // Thorn Armor: reflect damage back
    if (passive.thornReflect && passive.thornReflect > 0) {
        const reflectDmg = Math.max(1, Math.floor(dmg * passive.thornReflect / 100));
        m.currentHP -= reflectDmg;
        gameEvents.emit(EVENTS.COMBAT_PLAYER_HIT, { damage: reflectDmg, isCrit: false, monsterIndex: i });
        if (m.currentHP <= 0) {
            m.currentHP = 0;
            aliveMonstersCount--;
            onMonsterKilled();
            onMonsterDefeated();
            return;
        }
    }

    if (playerState.currentHP <= 0) {
        // Undying Will: survive lethal hit
        if (tryUndyingWill()) {
            playerState.currentHP = 1;
            return;
        }
        playerState.currentHP = 0;
        onPlayerDefeated();
    }
}

function advanceFocus() {
    // Move focus to the next alive monster
    for (let i = 0; i < monstersInWave.length; i++) {
        if (monstersInWave[i].currentHP > 0) {
            currentMonsterIndex = i;
            monsterState = monstersInWave[i];
            return true;
        }
    }
    return false; // all dead
}

function onMonsterDefeated() {
    gameEvents.emit(EVENTS.COMBAT_MONSTER_DEFEATED, {
        monster: { ...monsterState },
        monsterIndex: currentMonsterIndex,
        monsterProgress: getMonsterProgress(),
    });

    // Check if any monsters remain alive
    if (aliveMonstersCount > 0) {
        advanceFocus();
        gameEvents.emit(EVENTS.COMBAT_FOCUS_CHANGED, {
            focusIndex: currentMonsterIndex,
            monsters: monstersInWave,
        });
        return;
    }

    // All monsters dead — award skill shards
    const { currentWave, currentSubWave } = getCombatProgress();
    let shardsEarned = SKILL_SHARD_PER_SUBWAVE;
    if (currentSubWave === SUB_WAVE_COUNT) {
        shardsEarned += SKILL_SHARD_BOSS_BONUS;
    }
    addSkillShards(shardsEarned);

    let nextWave = currentWave;
    let nextSubWave = currentSubWave + 1;

    if (nextSubWave > SUB_WAVE_COUNT) {
        nextSubWave = 1;
        nextWave = currentWave + 1;
    }

    const maxWaves = getMaxWaveCount();
    if (nextWave > maxWaves) {
        nextWave = maxWaves;
        nextSubWave = SUB_WAVE_COUNT;
    }

    setCombatWave(nextWave, nextSubWave);

    // Reset soul harvest on wave change
    if (nextWave !== currentWave) {
        resetSkillsForWave();
    }

    resetPlayerToFull();
    spawnWaveMonsters();
    lastPlayerAttack = 0;
    lastMonsterAttacks = monstersInWave.map(() => 0);

    emitCombatStart();
}

function onPlayerDefeated() {
    gameEvents.emit(EVENTS.COMBAT_PLAYER_DEFEATED);

    const { currentWave, currentSubWave } = getCombatProgress();

    let nextWave = currentWave;
    let nextSubWave = currentSubWave - 1;

    if (nextSubWave < 1) {
        nextSubWave = 1;
    }

    setCombatWave(nextWave, nextSubWave);

    resetPlayerToFull();
    spawnWaveMonsters();
    lastPlayerAttack = 0;
    lastMonsterAttacks = monstersInWave.map(() => 0);

    combatPaused = true;
    setTimeout(() => {
        combatPaused = false;
        emitCombatStart();
    }, 1500);
}
