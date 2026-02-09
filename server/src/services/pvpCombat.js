/**
 * PvP Combat Engine
 *
 * Simulates a turn-based combat between two players based on their equipment stats.
 * Combat is fully server-authoritative to prevent cheating.
 */

const BASE_HEALTH = 100;
const BASE_DAMAGE = 10;
const BASE_ATTACK_SPEED = 1.0; // attacks per second
const MAX_ROUNDS = 50;

export function simulateCombat(player1Stats, player2Stats) {
  const fighter1 = buildFighter('player1', player1Stats);
  const fighter2 = buildFighter('player2', player2Stats);

  const logs = [];
  let round = 0;

  while (fighter1.hp > 0 && fighter2.hp > 0 && round < MAX_ROUNDS) {
    round++;

    // Both fighters attack each turn
    const dmg1 = calculateAttackDamage(fighter1);
    const dmg2 = calculateAttackDamage(fighter2);

    // Apply life steal
    const heal1 = Math.floor(dmg1 * fighter1.lifeSteal / 100);
    const heal2 = Math.floor(dmg2 * fighter2.lifeSteal / 100);

    // Apply health regen
    const regen1 = Math.floor(fighter1.maxHp * fighter1.healthRegen / 100);
    const regen2 = Math.floor(fighter2.maxHp * fighter2.healthRegen / 100);

    fighter2.hp = Math.max(0, fighter2.hp - dmg1);
    fighter1.hp = Math.max(0, fighter1.hp - dmg2);

    // Healing after damage
    fighter1.hp = Math.min(fighter1.maxHp, fighter1.hp + heal1 + regen1);
    fighter2.hp = Math.min(fighter2.maxHp, fighter2.hp + heal2 + regen2);

    logs.push({
      round,
      fighter1: { hp: fighter1.hp, dealt: dmg1, healed: heal1 + regen1 },
      fighter2: { hp: fighter2.hp, dealt: dmg2, healed: heal2 + regen2 },
    });
  }

  let winnerId = null;
  if (fighter1.hp > 0 && fighter2.hp <= 0) {
    winnerId = 'player1';
  } else if (fighter2.hp > 0 && fighter1.hp <= 0) {
    winnerId = 'player2';
  } else if (fighter1.hp > fighter2.hp) {
    winnerId = 'player1';
  } else if (fighter2.hp > fighter1.hp) {
    winnerId = 'player2';
  }
  // null = draw

  return { winnerId, logs, rounds: round };
}

function buildFighter(name, stats) {
  const bonuses = stats.bonuses || {};

  const maxHp = Math.floor(
    (BASE_HEALTH + (stats.totalHealth || 0))
    * (1 + (bonuses.healthMulti || 0) / 100)
  );

  const baseDmg = Math.floor(
    (BASE_DAMAGE + (stats.totalDamage || 0))
    * (1 + (bonuses.damageMulti || 0) / 100)
    * (1 + (bonuses.attackSpeed || 0) / 100)
  );

  return {
    name,
    hp: maxHp,
    maxHp,
    baseDmg,
    critChance: bonuses.critChance || 0,
    critMultiplier: bonuses.critMultiplier || 0,
    lifeSteal: bonuses.lifeSteal || 0,
    healthRegen: bonuses.healthRegen || 0,
  };
}

function calculateAttackDamage(fighter) {
  let damage = fighter.baseDmg;

  // Crit roll
  if (Math.random() * 100 < fighter.critChance) {
    damage = Math.floor(damage * (1 + fighter.critMultiplier / 100));
  }

  // Small random variance (+/- 10%)
  const variance = 0.9 + Math.random() * 0.2;
  damage = Math.floor(damage * variance);

  return Math.max(1, damage);
}

/**
 * Calculate combat stats from equipment array.
 * This mirrors the client-side calculateStats function.
 */
export function calculateCombatStats(equipment) {
  let totalHealth = 0;
  let totalDamage = 0;
  const bonuses = {};

  for (const item of equipment) {
    if (!item) continue;

    if (item.statType === 'health') {
      totalHealth += item.stats;
    } else {
      totalDamage += item.stats;
    }

    if (Array.isArray(item.bonuses)) {
      for (const bonus of item.bonuses) {
        if (bonus.type && bonus.value) {
          bonuses[bonus.type] = (bonuses[bonus.type] || 0) + bonus.value;
        }
      }
    }
  }

  return { totalHealth, totalDamage, bonuses };
}
