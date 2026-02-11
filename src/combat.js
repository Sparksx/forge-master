import { BASE_HEALTH, BASE_DAMAGE } from './config.js';
import { getEquipment, getCombatProgress, setCombatWave, getTechEffect } from './state.js';
import { calculateStats, calculatePowerScore } from './forge.js';
import { gameEvents, EVENTS } from './events.js';
import { getMonsterForWave, getMonsterCount, getMaxWaveCount, SUB_WAVE_COUNT } from './monsters.js';

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

    const rawHP = BASE_HEALTH + Math.floor(totalHealth * (1 + (bonuses.healthMulti || 0) / 100));
    const maxHP = Math.floor(rawHP * (1 + vitalityPct / 100));
    const rawDmg = BASE_DAMAGE + Math.floor(totalDamage * (1 + (bonuses.damageMulti || 0) / 100));
    const baseDmg = Math.floor(rawDmg * (1 + strengthPct / 100));
    const totalAttackSpeed = (bonuses.attackSpeed || 0) + swiftPct;
    const attackSpeed = Math.max(400, 1500 - totalAttackSpeed * 15);

    return {
        maxHP,
        damage: baseDmg,
        attackSpeed,
        critChance: bonuses.critChance || 0,
        critMultiplier: bonuses.critMultiplier || 0,
        healthRegen: bonuses.healthRegen || 0,
        lifeSteal: bonuses.lifeSteal || 0,
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

function combatTick() {
    if (!playerState || monstersInWave.length === 0) return;

    lastPlayerAttack += TICK_RATE;

    // Health regen (% of max HP per second)
    if (playerState.healthRegen > 0) {
        const regenAmount = (playerState.maxHP * playerState.healthRegen / 100) * (TICK_RATE / 1000);
        playerState.currentHP = Math.min(playerState.maxHP, playerState.currentHP + regenAmount);
    }

    // Player attacks the focused monster (subtract to preserve overflow from background tabs)
    if (lastPlayerAttack >= playerState.attackSpeed) {
        lastPlayerAttack -= playerState.attackSpeed;
        playerAttack();
    }

    // Each alive monster attacks independently based on its own speed
    for (let i = 0; i < monstersInWave.length; i++) {
        const m = monstersInWave[i];
        if (m.currentHP <= 0) continue;

        lastMonsterAttacks[i] += TICK_RATE;
        if (lastMonsterAttacks[i] >= m.attackSpeed) {
            lastMonsterAttacks[i] -= m.attackSpeed;
            singleMonsterAttack(i);
            if (playerState.currentHP <= 0) break;
        }
    }

    gameEvents.emit(EVENTS.COMBAT_TICK, {
        player: playerState,
        monsters: monstersInWave,
        focusIndex: currentMonsterIndex,
    });
}

function playerAttack() {
    if (!monsterState || monsterState.currentHP <= 0) return;

    let dmg = playerState.damage;
    let isCrit = false;

    if (playerState.critChance > 0 && Math.random() * 100 < playerState.critChance) {
        dmg = Math.floor(dmg * (1 + playerState.critMultiplier / 100));
        isCrit = true;
    }

    const variance = 0.9 + Math.random() * 0.2;
    dmg = Math.max(1, Math.floor(dmg * variance));

    monsterState.currentHP -= dmg;

    if (isCrit) {
        gameEvents.emit(EVENTS.COMBAT_PLAYER_CRIT, { damage: dmg });
    }
    gameEvents.emit(EVENTS.COMBAT_PLAYER_HIT, { damage: dmg, isCrit, monsterIndex: currentMonsterIndex });

    // Life steal
    if (playerState.lifeSteal > 0) {
        const healAmount = Math.floor(dmg * playerState.lifeSteal / 100);
        if (healAmount > 0) {
            playerState.currentHP = Math.min(playerState.maxHP, playerState.currentHP + healAmount);
            gameEvents.emit(EVENTS.COMBAT_PLAYER_LIFESTEAL, { amount: healAmount });
        }
    }

    if (monsterState.currentHP <= 0) {
        monsterState.currentHP = 0;
        aliveMonstersCount--;
        onMonsterDefeated();
    }
}

function singleMonsterAttack(i) {
    const m = monstersInWave[i];
    if (!m || m.currentHP <= 0) return;

    const variance = 0.9 + Math.random() * 0.2;
    const dmg = Math.max(1, Math.floor(m.damage * variance));

    playerState.currentHP -= dmg;
    gameEvents.emit(EVENTS.COMBAT_MONSTER_HIT, { damage: dmg, monsterIndex: i });

    if (playerState.currentHP <= 0) {
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

    // All monsters dead — advance to next sub-wave
    const { currentWave, currentSubWave } = getCombatProgress();

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
