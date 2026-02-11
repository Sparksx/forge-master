import { BASE_HEALTH, BASE_DAMAGE } from './config.js';
import { getEquipment, getCombatProgress, setCombatWave, getTechEffect, getEquippedSkills, getSkillLevel } from './state.js';
import { calculateStats, calculatePowerScore } from './forge.js';
import { gameEvents, EVENTS } from './events.js';
import { getMonsterForWave, getMonsterCount, getMaxWaveCount, SUB_WAVE_COUNT } from './monsters.js';
import { getSkillById } from './skills-config.js';

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

// --- Skill runtime state (reset per combat / per wave) -------------------------
let activeSkillTimers = {};   // { [skillId]: { remaining, duration, effect } }
let skillCooldowns = {};      // { [skillId]: remaining (seconds) }
let phoenixUsed = false;      // Phoenix Spirit: once per wave
let shieldHP = 0;             // Frozen Shield absorb

export function getActiveSkillTimers() { return activeSkillTimers; }
export function getSkillCooldowns() { return skillCooldowns; }
export function getShieldHP() { return shieldHP; }

// --- Helpers to gather equipped skill effects ----------------------------------

function getEquippedSkillEffects() {
    const equipped = getEquippedSkills();
    const results = [];
    for (const skillId of equipped) {
        if (!skillId) continue;
        const skill = getSkillById(skillId);
        if (!skill) continue;
        const level = getSkillLevel(skillId);
        if (level < 1) continue;
        results.push({ skill, level, effect: skill.effect(level) });
    }
    return results;
}

function getPassiveEffects() {
    return getEquippedSkillEffects().filter(e => e.skill.type === 'passive');
}

function getActiveEffects() {
    return getEquippedSkillEffects().filter(e => e.skill.type === 'active');
}

// ---- Existing exports ---------------------------------------------------------

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

// ---- Player stats with passive skill bonuses ----------------------------------

function getPlayerStats() {
    const equipment = getEquipment();
    const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);

    // Tech bonuses
    const vitalityPct = getTechEffect('vitality');
    const strengthPct = getTechEffect('strength');
    const swiftPct = getTechEffect('swiftStrikes');

    // --- Passive skill: godslayer amplifies all equipment bonuses ---
    const passives = getPassiveEffects();
    let allBonusPct = 0;
    for (const p of passives) {
        if (p.effect.stat === 'allBonusPercent') allBonusPct += p.effect.value;
    }
    if (allBonusPct > 0) {
        for (const key of Object.keys(bonuses)) {
            bonuses[key] = bonuses[key] * (1 + allBonusPct / 100);
        }
    }

    // --- Passive skill: titanGrip ---
    let titanDmgPct = 0;
    let titanHpPct = 0;
    for (const p of passives) {
        if (p.effect.stat === 'titanGrip') {
            titanDmgPct += p.effect.value;
            titanHpPct += p.effect.value2;
        }
    }

    // --- Passive skill: swiftBlade ---
    let skillAttackSpeedPct = 0;
    for (const p of passives) {
        if (p.effect.stat === 'attackSpeedPercent') skillAttackSpeedPct += p.effect.value;
    }

    // --- Passive skill: critMastery ---
    let skillCritChance = 0;
    let skillCritMulti = 0;
    for (const p of passives) {
        if (p.effect.stat === 'critBoost') {
            skillCritChance += p.effect.value;
            skillCritMulti += p.effect.value2;
        }
    }

    // --- Passive skill: vampiricAura ---
    let skillLifeSteal = 0;
    for (const p of passives) {
        if (p.effect.stat === 'lifeStealFlat') skillLifeSteal += p.effect.value;
    }

    const rawHP = BASE_HEALTH + Math.floor(totalHealth * (1 + (bonuses.healthMulti || 0) / 100));
    const maxHP = Math.floor(rawHP * (1 + vitalityPct / 100) * (1 + titanHpPct / 100));
    const rawDmg = BASE_DAMAGE + Math.floor(totalDamage * (1 + (bonuses.damageMulti || 0) / 100));
    const baseDmg = Math.floor(rawDmg * (1 + strengthPct / 100) * (1 + titanDmgPct / 100));
    const totalAttackSpeed = (bonuses.attackSpeed || 0) + swiftPct + skillAttackSpeedPct;
    const attackSpeed = Math.max(400, 1500 - totalAttackSpeed * 15);

    return {
        maxHP,
        damage: baseDmg,
        attackSpeed,
        critChance: (bonuses.critChance || 0) + skillCritChance,
        critMultiplier: (bonuses.critMultiplier || 0) + skillCritMulti,
        healthRegen: bonuses.healthRegen || 0,
        lifeSteal: (bonuses.lifeSteal || 0) + skillLifeSteal,
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
            poisonTimer: 0,
            poisonDPS: 0,
            burnTimer: 0,
            burnDPS: 0,
        });
    }

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

function resetSkillState() {
    activeSkillTimers = {};
    skillCooldowns = {};
    phoenixUsed = false;
    shieldHP = 0;
}

function resetSkillCooldownsForWave() {
    // Reset active durations but keep cooldowns running
    activeSkillTimers = {};
    phoenixUsed = false;
    shieldHP = 0;
}

function emitCombatStart() {
    gameEvents.emit(EVENTS.COMBAT_START, {
        player: playerState,
        monster: monsterState,
        monsters: monstersInWave,
        focusIndex: currentMonsterIndex,
        monsterProgress: getMonsterProgress(),
        skillCooldowns,
        activeSkillTimers,
    });
}

export function startCombat() {
    if (combatInterval) return;

    initPlayerState();
    spawnWaveMonsters();
    lastPlayerAttack = 0;
    lastMonsterAttacks = monstersInWave.map(() => 0);
    combatPaused = false;
    resetSkillState();

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

// --- Skill combat logic --------------------------------------------------------

/**
 * Check if an active skill buff is currently running.
 */
function isSkillActive(skillId) {
    return activeSkillTimers[skillId] && activeSkillTimers[skillId].remaining > 0;
}

/**
 * Get the current damage multiplier from all active damage buffs + passive conditional buffs.
 */
function getSkillDamageMultiplier() {
    let mult = 1;

    // Passive conditional damage buffs
    const passives = getPassiveEffects();
    for (const p of passives) {
        if (p.effect.stat === 'damagePercent') {
            if (p.effect.condition === 'lowHP' && playerState) {
                const hpPct = (playerState.currentHP / playerState.maxHP) * 100;
                if (hpPct < p.effect.conditionThreshold) {
                    mult *= (1 + p.effect.value / 100);
                }
            }
        }
    }

    // Active damage buffs (warCry, bloodRitual, immortality)
    for (const [skillId, timer] of Object.entries(activeSkillTimers)) {
        if (timer.remaining <= 0) continue;
        const eff = timer.effect;
        if (eff.stat === 'damagePercent') mult *= (1 + eff.value / 100);
        if (eff.stat === 'immortality') mult *= (1 + eff.value / 100);
    }

    return mult;
}

/**
 * Get the current damage reduction from passive + active skills.
 */
function getSkillDamageReduction() {
    let reduction = 0;

    // Passive: ironSkin
    for (const p of getPassiveEffects()) {
        if (p.effect.stat === 'damageReduction' && p.effect.condition === 'always') {
            reduction += p.effect.value;
        }
    }

    // Active: shieldWall
    for (const [, timer] of Object.entries(activeSkillTimers)) {
        if (timer.remaining <= 0) continue;
        if (timer.effect.stat === 'damageReduction') {
            reduction += timer.effect.value;
        }
    }

    return Math.min(reduction, 90); // cap at 90%
}

/**
 * Get attack speed multiplier from active skills.
 */
function getActiveAttackSpeedMultiplier() {
    let mult = 1;
    for (const [, timer] of Object.entries(activeSkillTimers)) {
        if (timer.remaining <= 0) continue;
        if (timer.effect.stat === 'attackSpeedPercent') {
            mult *= (1 + timer.effect.value / 100);
        }
    }
    return mult;
}

/**
 * Check if player is invincible (immortality skill active).
 */
function isInvincible() {
    for (const [, timer] of Object.entries(activeSkillTimers)) {
        if (timer.remaining <= 0) continue;
        if (timer.effect.stat === 'immortality') return true;
    }
    return false;
}

/**
 * Try to activate all ready active skills.
 */
function tickActiveSkills(dt) {
    const actives = getActiveEffects();

    for (const a of actives) {
        const id = a.skill.id;
        const eff = a.effect;

        // Decrease cooldown
        if (skillCooldowns[id] !== undefined && skillCooldowns[id] > 0) {
            skillCooldowns[id] = Math.max(0, skillCooldowns[id] - dt);
            if (skillCooldowns[id] <= 0) {
                gameEvents.emit(EVENTS.SKILL_READY, { skillId: id });
            }
        }

        // Decrease active duration
        if (activeSkillTimers[id] && activeSkillTimers[id].remaining > 0) {
            activeSkillTimers[id].remaining = Math.max(0, activeSkillTimers[id].remaining - dt);
            if (activeSkillTimers[id].remaining <= 0) {
                // Shield expired → remove shield HP
                if (eff.stat === 'shieldPercent') shieldHP = 0;
                gameEvents.emit(EVENTS.SKILL_EXPIRED, { skillId: id });
            }
            continue; // don't reactivate while still active
        }

        // Try to activate if off cooldown
        if (skillCooldowns[id] === undefined || skillCooldowns[id] <= 0) {
            activateSkill(a);
        }
    }
}

function activateSkill({ skill, level, effect }) {
    const id = skill.id;

    // Special: bloodRitual sacrifices HP
    if (effect.selfDamagePercent && playerState) {
        const selfDmg = Math.floor(playerState.maxHP * effect.selfDamagePercent / 100);
        playerState.currentHP = Math.max(1, playerState.currentHP - selfDmg);
    }

    // Special: heal is instant
    if (effect.stat === 'healPercent' && playerState) {
        const healAmt = Math.floor(playerState.maxHP * effect.value / 100);
        playerState.currentHP = Math.min(playerState.maxHP, playerState.currentHP + healAmt);
        skillCooldowns[id] = effect.cooldown;
        gameEvents.emit(EVENTS.SKILL_ACTIVATED, { skillId: id, effect });
        return;
    }

    // Special: apocalypse is instant AoE
    if (effect.stat === 'aoeBurst' && playerState) {
        const burstDmg = Math.floor(playerState.damage * effect.value / 100);
        for (const m of monstersInWave) {
            if (m.currentHP > 0) {
                m.currentHP = Math.max(0, m.currentHP - burstDmg);
            }
        }
        skillCooldowns[id] = effect.cooldown;
        gameEvents.emit(EVENTS.SKILL_ACTIVATED, { skillId: id, effect });
        checkMonstersAfterAoE();
        return;
    }

    // Special: frozenShield creates absorb
    if (effect.stat === 'shieldPercent' && playerState) {
        shieldHP = Math.floor(playerState.maxHP * effect.value / 100);
    }

    // Duration-based buff
    if (effect.duration > 0) {
        activeSkillTimers[id] = {
            remaining: effect.duration,
            duration: effect.duration,
            effect,
        };
    }

    skillCooldowns[id] = effect.cooldown;
    gameEvents.emit(EVENTS.SKILL_ACTIVATED, { skillId: id, effect });
}

/**
 * Tick poison and burn DoTs on monsters.
 */
function tickDoTs(dt) {
    for (const m of monstersInWave) {
        if (m.currentHP <= 0) continue;
        // Poison
        if (m.poisonTimer > 0) {
            m.poisonTimer -= dt;
            const poisonDmg = Math.floor(m.poisonDPS * dt);
            if (poisonDmg > 0) {
                m.currentHP = Math.max(0, m.currentHP - poisonDmg);
            }
        }
        // Burn (Raging Inferno)
        if (m.burnTimer > 0) {
            m.burnTimer -= dt;
            const burnDmg = Math.floor(m.burnDPS * dt);
            if (burnDmg > 0) {
                m.currentHP = Math.max(0, m.currentHP - burnDmg);
            }
        }
    }
    checkMonstersAfterAoE();
}

/**
 * Tick Raging Inferno burn on all monsters.
 */
function applyBurnFromInferno() {
    for (const [skillId, timer] of Object.entries(activeSkillTimers)) {
        if (timer.remaining <= 0) continue;
        if (timer.effect.stat === 'burnPercent') {
            for (const m of monstersInWave) {
                if (m.currentHP > 0) {
                    m.burnDPS = m.maxHP * timer.effect.value / 100;
                    m.burnTimer = Math.max(m.burnTimer, timer.remaining);
                }
            }
        }
    }
}

function checkMonstersAfterAoE() {
    // Check if focused monster died
    if (monsterState && monsterState.currentHP <= 0) {
        monsterState.currentHP = 0;
        onMonsterDefeated();
    }
}

/**
 * Check passive: Death Mark execute.
 */
function checkExecute(monster) {
    for (const p of getPassiveEffects()) {
        if (p.effect.stat === 'executeThreshold') {
            const hpPct = (monster.currentHP / monster.maxHP) * 100;
            if (hpPct > 0 && hpPct < p.effect.value) {
                monster.currentHP = 0;
                return true;
            }
        }
    }
    return false;
}

/**
 * Apply thorn damage to a monster when player is hit.
 */
function applyThorns(dmgReceived, monsterIndex) {
    for (const p of getPassiveEffects()) {
        if (p.effect.stat === 'thornPercent') {
            const thornDmg = Math.floor(dmgReceived * p.effect.value / 100);
            if (thornDmg > 0 && monstersInWave[monsterIndex]) {
                const m = monstersInWave[monsterIndex];
                m.currentHP = Math.max(0, m.currentHP - thornDmg);
                if (m.currentHP <= 0 && m === monsterState) {
                    onMonsterDefeated();
                }
            }
        }
    }
}

/**
 * Apply poison DoT to monster on player hit.
 */
function applyPoison(monster) {
    for (const p of getPassiveEffects()) {
        if (p.effect.stat === 'poisonPercent') {
            const dps = playerState.damage * p.effect.value / 100;
            monster.poisonDPS = dps;
            monster.poisonTimer = p.effect.poisonDuration;
        }
    }
}

/**
 * Get active regen bonus from divineBlessing.
 */
function getActiveRegenBonus() {
    let bonus = 0;
    for (const [, timer] of Object.entries(activeSkillTimers)) {
        if (timer.remaining <= 0) continue;
        if (timer.effect.stat === 'regenPercent') {
            bonus += timer.effect.value;
        }
    }
    return bonus;
}

// --- Main combat tick ----------------------------------------------------------

function combatTick() {
    if (!playerState || monstersInWave.length === 0) return;

    const dt = TICK_RATE / 1000; // seconds

    // Tick active skill cooldowns and durations
    tickActiveSkills(dt);

    // Apply burn from Raging Inferno
    applyBurnFromInferno();

    // Tick DoTs
    tickDoTs(dt);

    lastPlayerAttack += TICK_RATE;

    // Health regen (base + divine blessing bonus)
    const totalRegen = playerState.healthRegen + getActiveRegenBonus();
    if (totalRegen > 0) {
        const regenAmount = (playerState.maxHP * totalRegen / 100) * dt;
        playerState.currentHP = Math.min(playerState.maxHP, playerState.currentHP + regenAmount);
    }

    // Active attack speed bonus
    const atkSpeedMult = getActiveAttackSpeedMultiplier();
    const effectiveAttackSpeed = Math.max(200, playerState.attackSpeed / atkSpeedMult);

    // Player attacks the focused monster
    if (lastPlayerAttack >= effectiveAttackSpeed) {
        lastPlayerAttack = 0;
        playerAttack();
    }

    // Each alive monster attacks independently based on its own speed
    for (let i = 0; i < monstersInWave.length; i++) {
        const m = monstersInWave[i];
        if (m.currentHP <= 0) continue;

        lastMonsterAttacks[i] += TICK_RATE;
        if (lastMonsterAttacks[i] >= m.attackSpeed) {
            lastMonsterAttacks[i] = 0;
            singleMonsterAttack(i);
            if (playerState.currentHP <= 0) break;
        }
    }

    gameEvents.emit(EVENTS.COMBAT_TICK, {
        player: playerState,
        monsters: monstersInWave,
        focusIndex: currentMonsterIndex,
        skillCooldowns,
        activeSkillTimers,
        shieldHP,
    });
}

function playerAttack() {
    if (!monsterState || monsterState.currentHP <= 0) return;

    let dmg = playerState.damage;
    let isCrit = false;

    // Shadow Strike: guaranteed crit with massive multiplier
    let shadowStrikeActive = false;
    for (const [skillId, timer] of Object.entries(activeSkillTimers)) {
        if (timer.remaining > 0 && timer.effect.stat === 'shadowStrike') {
            dmg = Math.floor(playerState.damage * timer.effect.value / 100);
            isCrit = true;
            // Consume shadow strike (single hit)
            timer.remaining = 0;
            shadowStrikeActive = true;
            gameEvents.emit(EVENTS.SKILL_EXPIRED, { skillId });
            break;
        }
    }

    if (!shadowStrikeActive) {
        if (playerState.critChance > 0 && Math.random() * 100 < playerState.critChance) {
            dmg = Math.floor(dmg * (1 + playerState.critMultiplier / 100));
            isCrit = true;
        }
    }

    // Apply skill damage multiplier (passive conditional + active buffs)
    dmg = Math.floor(dmg * getSkillDamageMultiplier());

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

    // Apply poison
    applyPoison(monsterState);

    // Check execute (Death Mark)
    if (monsterState.currentHP > 0) {
        checkExecute(monsterState);
    }

    if (monsterState.currentHP <= 0) {
        monsterState.currentHP = 0;
        onMonsterDefeated();
    }
}

function singleMonsterAttack(i) {
    const m = monstersInWave[i];
    if (!m || m.currentHP <= 0) return;

    // Invincibility check
    if (isInvincible()) return;

    const variance = 0.9 + Math.random() * 0.2;
    let dmg = Math.max(1, Math.floor(m.damage * variance));

    // Apply damage reduction from skills
    const reduction = getSkillDamageReduction();
    if (reduction > 0) {
        dmg = Math.max(1, Math.floor(dmg * (1 - reduction / 100)));
    }

    // Absorb by frozen shield first
    if (shieldHP > 0) {
        if (dmg <= shieldHP) {
            shieldHP -= dmg;
            dmg = 0;
        } else {
            dmg -= shieldHP;
            shieldHP = 0;
        }
    }

    if (dmg > 0) {
        playerState.currentHP -= dmg;
        gameEvents.emit(EVENTS.COMBAT_MONSTER_HIT, { damage: dmg, monsterIndex: i });

        // Thorns
        applyThorns(dmg, i);
    }

    if (playerState.currentHP <= 0) {
        // Phoenix Spirit check
        if (!phoenixUsed) {
            for (const p of getPassiveEffects()) {
                if (p.effect.stat === 'revivePercent') {
                    playerState.currentHP = Math.floor(playerState.maxHP * p.effect.value / 100);
                    phoenixUsed = true;
                    gameEvents.emit(EVENTS.SKILL_ACTIVATED, { skillId: p.skill.id, effect: p.effect });
                    return;
                }
            }
        }
        playerState.currentHP = 0;
        onPlayerDefeated();
    }
}

function advanceFocus() {
    for (let i = 0; i < monstersInWave.length; i++) {
        if (monstersInWave[i].currentHP > 0) {
            currentMonsterIndex = i;
            monsterState = monstersInWave[i];
            return true;
        }
    }
    return false;
}

function onMonsterDefeated() {
    gameEvents.emit(EVENTS.COMBAT_MONSTER_DEFEATED, {
        monster: { ...monsterState },
        monsterIndex: currentMonsterIndex,
        monsterProgress: getMonsterProgress(),
    });

    const hasAlive = monstersInWave.some(m => m.currentHP > 0);
    if (hasAlive) {
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
    resetSkillCooldownsForWave();

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
    resetSkillCooldownsForWave();

    combatPaused = true;
    setTimeout(() => {
        combatPaused = false;
        emitCombatStart();
    }, 1500);
}
