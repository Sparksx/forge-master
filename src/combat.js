import { BASE_HEALTH, BASE_DAMAGE } from './config.js';
import { getEquipment, getCombatProgress, setCombatWave } from './state.js';
import { calculateStats, calculatePowerScore } from './forge.js';
import { gameEvents, EVENTS } from './events.js';
import { getMonsterForWave, getMonsterCount, WAVE_COUNT, SUB_WAVE_COUNT } from './monsters.js';

// Combat tick rate (ms)
const TICK_RATE = 100;

// Combat runtime state (not persisted)
let combatInterval = null;
let playerState = null;
let monsterState = null;
let lastPlayerAttack = 0;
let lastMonsterAttack = 0;
let combatPaused = false;

// Multi-monster state
let monstersInWave = [];     // all monsters for current sub-wave
let currentMonsterIndex = 0; // which monster is currently being fought
let totalMonstersInWave = 0; // total count for UI display

export function getPlayerCombatState() {
    return playerState;
}

export function getMonsterCombatState() {
    return monsterState;
}

export function isCombatRunning() {
    return combatInterval !== null && !combatPaused;
}

export function isCombatPaused() {
    return combatPaused;
}

/** Returns { current, total } for the monster counter UI */
export function getMonsterProgress() {
    return { current: currentMonsterIndex + 1, total: totalMonstersInWave };
}

function getPlayerStats() {
    const equipment = getEquipment();
    const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);
    const maxHP = BASE_HEALTH + Math.floor(totalHealth * (1 + (bonuses.healthMulti || 0) / 100));
    const baseDmg = BASE_DAMAGE + Math.floor(totalDamage * (1 + (bonuses.damageMulti || 0) / 100));
    const attackSpeed = Math.max(400, 1500 - (bonuses.attackSpeed || 0) * 15);
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
    currentMonsterIndex = 0;
    monstersInWave = [];

    for (let i = 0; i < count; i++) {
        const monster = getMonsterForWave(currentWave, currentSubWave);
        monstersInWave.push({
            ...monster,
            currentHP: monster.maxHP,
        });
    }

    // Set the first monster as active
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

export function startCombat() {
    if (combatInterval) return;

    initPlayerState();
    spawnWaveMonsters();
    lastPlayerAttack = 0;
    lastMonsterAttack = 0;
    combatPaused = false;

    gameEvents.emit(EVENTS.COMBAT_START, {
        player: playerState,
        monster: monsterState,
        monsterProgress: getMonsterProgress(),
    });

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
    if (!playerState || !monsterState) return;

    lastPlayerAttack += TICK_RATE;
    lastMonsterAttack += TICK_RATE;

    // Health regen (% of max HP per second)
    if (playerState.healthRegen > 0) {
        const regenAmount = (playerState.maxHP * playerState.healthRegen / 100) * (TICK_RATE / 1000);
        playerState.currentHP = Math.min(playerState.maxHP, playerState.currentHP + regenAmount);
    }

    // Player attacks
    if (lastPlayerAttack >= playerState.attackSpeed) {
        lastPlayerAttack = 0;
        playerAttack();
    }

    // Monster attacks
    if (lastMonsterAttack >= monsterState.attackSpeed) {
        lastMonsterAttack = 0;
        monsterAttack();
    }

    gameEvents.emit(EVENTS.COMBAT_TICK, { player: playerState, monster: monsterState });
}

function playerAttack() {
    let dmg = playerState.damage;
    let isCrit = false;

    // Crit roll
    if (playerState.critChance > 0 && Math.random() * 100 < playerState.critChance) {
        dmg = Math.floor(dmg * (1 + playerState.critMultiplier / 100));
        isCrit = true;
    }

    // Add small variance (±10%)
    const variance = 0.9 + Math.random() * 0.2;
    dmg = Math.max(1, Math.floor(dmg * variance));

    monsterState.currentHP -= dmg;

    if (isCrit) {
        gameEvents.emit(EVENTS.COMBAT_PLAYER_CRIT, { damage: dmg });
    }
    gameEvents.emit(EVENTS.COMBAT_PLAYER_HIT, { damage: dmg, isCrit });

    // Life steal
    if (playerState.lifeSteal > 0) {
        const healAmount = Math.floor(dmg * playerState.lifeSteal / 100);
        if (healAmount > 0) {
            playerState.currentHP = Math.min(playerState.maxHP, playerState.currentHP + healAmount);
            gameEvents.emit(EVENTS.COMBAT_PLAYER_LIFESTEAL, { amount: healAmount });
        }
    }

    // Check monster death
    if (monsterState.currentHP <= 0) {
        monsterState.currentHP = 0;
        onMonsterDefeated();
    }
}

function monsterAttack() {
    // Add small variance (±10%)
    const variance = 0.9 + Math.random() * 0.2;
    const dmg = Math.max(1, Math.floor(monsterState.damage * variance));

    playerState.currentHP -= dmg;
    gameEvents.emit(EVENTS.COMBAT_MONSTER_HIT, { damage: dmg });

    // Check player death
    if (playerState.currentHP <= 0) {
        playerState.currentHP = 0;
        onPlayerDefeated();
    }
}

function onMonsterDefeated() {
    gameEvents.emit(EVENTS.COMBAT_MONSTER_DEFEATED, {
        monster: { ...monsterState },
        monsterProgress: getMonsterProgress(),
    });

    // Check if there are more monsters in this sub-wave
    if (currentMonsterIndex < monstersInWave.length - 1) {
        // Next monster — player HP does NOT reset
        currentMonsterIndex++;
        monsterState = monstersInWave[currentMonsterIndex];
        lastMonsterAttack = 0;

        // Brief pause before next monster appears
        combatPaused = true;
        setTimeout(() => {
            combatPaused = false;
            gameEvents.emit(EVENTS.COMBAT_START, {
                player: playerState,
                monster: monsterState,
                monsterProgress: getMonsterProgress(),
            });
        }, 600);
        return;
    }

    // All monsters in sub-wave defeated — advance to next sub-wave
    const { currentWave, currentSubWave } = getCombatProgress();

    let nextWave = currentWave;
    let nextSubWave = currentSubWave + 1;

    if (nextSubWave > SUB_WAVE_COUNT) {
        nextSubWave = 1;
        nextWave = currentWave + 1;
    }

    if (nextWave > WAVE_COUNT) {
        // Player beat the final wave! Stay at max
        nextWave = WAVE_COUNT;
        nextSubWave = SUB_WAVE_COUNT;
    }

    setCombatWave(nextWave, nextSubWave);

    // Reset player HP for next sub-wave
    resetPlayerToFull();

    // Spawn all monsters for next sub-wave
    spawnWaveMonsters();
    lastPlayerAttack = 0;
    lastMonsterAttack = 0;

    gameEvents.emit(EVENTS.COMBAT_START, {
        player: playerState,
        monster: monsterState,
        monsterProgress: getMonsterProgress(),
    });
}

function onPlayerDefeated() {
    gameEvents.emit(EVENTS.COMBAT_PLAYER_DEFEATED);

    const { currentWave, currentSubWave } = getCombatProgress();

    // Go back one sub-wave, but never below X-1
    let nextWave = currentWave;
    let nextSubWave = currentSubWave - 1;

    if (nextSubWave < 1) {
        nextSubWave = 1;
    }

    setCombatWave(nextWave, nextSubWave);

    // Reset player HP
    resetPlayerToFull();

    // Spawn monsters for the wave we're sent back to
    spawnWaveMonsters();
    lastPlayerAttack = 0;
    lastMonsterAttack = 0;

    // Small delay before restarting
    combatPaused = true;
    setTimeout(() => {
        combatPaused = false;
        gameEvents.emit(EVENTS.COMBAT_START, {
            player: playerState,
            monster: monsterState,
            monsterProgress: getMonsterProgress(),
        });
    }, 1500);
}
