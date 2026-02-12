// ══════════════════════════════════════════════════════════
// Skills UI — Skill Forge, collection grid, detail modal
// ══════════════════════════════════════════════════════════

import {
    SKILLS, getSkillById, getSkillMaxLevel,
    getSkillCooldown, getSkillDuration,
    getSkillEffectValue, getSkillTier, MAX_EQUIPPED_SKILLS,
    SKILL_FORGE_COST, getSkillForgeTierChances, getSkillCopiesForLevel,
    getTotalCopiesForLevel,
} from '../skills-config.js';
import { TIERS } from '../config.js';
import {
    getSkillLevel, isSkillEquipped, canForgeSkill, forgeSkill,
    equipSkill, unequipSkill, canUpgradeSkill, upgradeSkill, upgradeAllSkills,
    canActivateSkill, getCooldownRemaining,
} from '../skills.js';
import {
    getSkillsState, getEquippedSkills, getCombatProgress,
    getSkillShards, getSkillCopies,
} from '../state.js';
import { createElement, formatNumber, formatCompact } from './helpers.js';
import { showToast } from './helpers.js';
import { gameEvents, EVENTS } from '../events.js';

let forging = false;

export function initSkillsUI() {
    renderSkillsTab();

    gameEvents.on(EVENTS.STATE_CHANGED, renderSkillsTab);
    gameEvents.on(EVENTS.SKILL_FORGED, ({ skill, isNew }) => {
        if (isNew) {
            showToast(`${skill.icon} ${skill.name} obtenu!`, 'study');
        } else {
            showToast(`${skill.icon} ${skill.name} +1 copie`, 'info');
        }
    });
    gameEvents.on(EVENTS.SKILL_SHARDS_CHANGED, renderSkillsTab);
}

export function renderSkillsTab() {
    const container = document.getElementById('subtab-skills');
    if (!container) return;
    container.textContent = '';

    // Forge section (shards + button + tier chances + upgrade all)
    container.appendChild(buildForgeSection());

    // Equipped skills bar
    container.appendChild(buildEquippedSection());

    // Unlocked skills grid (sorted by tier)
    container.appendChild(buildSkillsGrid());
}

// ── Forge Section ───────────────────────────────────────────

function buildForgeSection() {
    const section = createElement('div', 'skills-forge-section');

    // Shard display
    const shardRow = createElement('div', 'skills-shard-row');
    const shardIcon = createElement('span', 'skills-shard-icon', '\u2B23');
    const shardCount = createElement('span', 'skills-shard-count', `${formatNumber(getSkillShards())} Fragments`);
    const costHint = createElement('span', 'skills-shard-cost', `(${SKILL_FORGE_COST} par forge)`);
    shardRow.append(shardIcon, shardCount, costHint);
    section.appendChild(shardRow);

    // Tier chances
    section.appendChild(buildTierChancesPreview());

    // Forge button
    const canDo = canForgeSkill() && !forging;
    const forgeBtn = createElement('button', `btn skills-forge-btn${canDo ? '' : ' btn-disabled'}`,
        forging ? '\u2728 Forge...' : `\u2728 Forger un Skill (${SKILL_FORGE_COST} \u2B23)`);
    forgeBtn.disabled = !canDo;
    forgeBtn.addEventListener('click', () => {
        if (forging || !canForgeSkill()) return;
        forging = true;
        forgeBtn.classList.add('forging');
        forgeBtn.textContent = '\u2728 Forge...';
        setTimeout(() => {
            forging = false;
            const result = forgeSkill();
            if (result) showForgeResult(result);
        }, 1200);
    });
    section.appendChild(forgeBtn);

    // Upgrade All button
    const hasUpgradable = SKILLS.some(s => canUpgradeSkill(s.id));
    if (hasUpgradable) {
        const upgradeAllBtn = createElement('button', 'btn skills-upgrade-all-btn', '\u2B06 Am\u00e9liorer tout');
        upgradeAllBtn.addEventListener('click', () => {
            const count = upgradeAllSkills();
            if (count > 0) {
                showToast(`\u2B06 ${count} skill(s) am\u00e9lior\u00e9(s)!`, 'study');
            }
        });
        section.appendChild(upgradeAllBtn);
    }

    return section;
}

function buildTierChancesPreview() {
    const { highestWave } = getCombatProgress();
    const { chances } = getSkillForgeTierChances(highestWave);

    const row = createElement('div', 'skills-tier-chances');
    const label = createElement('span', 'skills-tier-chances-label', 'Chances:');
    row.appendChild(label);

    chances.forEach((chance, idx) => {
        if (chance <= 0) return;
        const tier = TIERS[idx];
        const chip = createElement('span', 'skills-tier-chance-chip');
        chip.style.color = tier.color;
        chip.style.borderColor = tier.color;
        chip.textContent = `${tier.name.charAt(0)} ${chance}%`;
        chip.title = tier.name;
        row.appendChild(chip);
    });

    return row;
}

function showForgeResult(result) {
    const { skill, tier, copies, level, isNew } = result;
    const tierDef = TIERS[tier - 1];

    let modal = document.getElementById('skill-forge-result-modal');
    if (!modal) {
        modal = createElement('div', 'modal');
        modal.id = 'skill-forge-result-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Forge result');
        modal.setAttribute('aria-modal', 'true');
        const content = createElement('div', 'modal-content skill-forge-result-content');
        content.id = 'skill-forge-result-content';
        modal.appendChild(content);
        document.getElementById('game-container').appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    const content = document.getElementById('skill-forge-result-content');
    content.textContent = '';

    const closeBtn = createElement('button', 'modal-close-btn', '\u2715');
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    content.appendChild(closeBtn);

    // Header
    const header = createElement('div', 'skill-forge-result-header');
    const icon = createElement('div', 'skill-forge-result-icon', skill.icon);
    icon.style.borderColor = tierDef.color;
    header.appendChild(icon);

    const titleCol = createElement('div', 'skill-forge-result-title');
    const name = createElement('div', 'skill-forge-result-name', skill.name);
    name.style.color = tierDef.color;
    titleCol.appendChild(name);
    const tierLabel = createElement('div', 'skill-forge-result-tier', tierDef.name);
    tierLabel.style.color = tierDef.color;
    titleCol.appendChild(tierLabel);
    header.appendChild(titleCol);
    content.appendChild(header);

    // Status tag
    if (isNew) {
        content.appendChild(createElement('div', 'skill-forge-result-tag skill-forge-new', 'NOUVEAU!'));
    } else {
        const maxLevel = getSkillMaxLevel(skill);
        const nextLevelCopies = level < maxLevel ? getTotalCopiesForLevel(level + 1) : null;
        const tagText = nextLevelCopies !== null
            ? `Copie ${copies} / ${nextLevelCopies}`
            : `MAX (${copies} copies)`;
        content.appendChild(createElement('div', 'skill-forge-result-tag skill-forge-copy', tagText));
    }

    // Description
    content.appendChild(createElement('div', 'skill-forge-result-desc', skill.description));

    // Forge again
    const canDoAgain = canForgeSkill();
    const againBtn = createElement('button', `btn skills-forge-btn${canDoAgain ? '' : ' btn-disabled'}`,
        `\u2728 Forger encore (${SKILL_FORGE_COST} \u2B23)`);
    againBtn.disabled = !canDoAgain;
    againBtn.addEventListener('click', () => {
        if (!canForgeSkill()) return;
        modal.classList.remove('active');
        setTimeout(() => {
            forging = true;
            setTimeout(() => {
                forging = false;
                const newResult = forgeSkill();
                if (newResult) showForgeResult(newResult);
            }, 1200);
        }, 200);
    });
    content.appendChild(againBtn);

    modal.classList.add('active');
}

// ── Equipped Skills ─────────────────────────────────────────

function buildEquippedSection() {
    const section = createElement('div', 'skills-equipped-section');
    section.appendChild(createElement('div', 'skills-equipped-title', 'Skills \u00C9quip\u00e9s'));

    const slotsRow = createElement('div', 'skills-equipped-slots');
    const equipped = getEquippedSkills();

    for (let i = 0; i < MAX_EQUIPPED_SKILLS; i++) {
        const slotDiv = createElement('div', 'skills-equipped-slot');
        if (equipped[i]) {
            const skill = getSkillById(equipped[i]);
            if (skill) {
                const tier = getSkillTier(skill);
                slotDiv.style.borderColor = tier.color;
                slotDiv.classList.add('skills-equipped-slot-filled');

                const icon = createElement('span', 'skills-equipped-icon', skill.icon);
                const nameEl = createElement('span', 'skills-equipped-name', skill.name);
                nameEl.style.color = tier.color;
                const lvl = createElement('span', 'skills-equipped-level', `Niv.${getSkillLevel(skill.id)}`);
                const typeIcon = createElement('span', 'skills-equipped-type', skill.type === 'passive' ? '\uD83D\uDEE1\uFE0F' : '\u2694\uFE0F');

                slotDiv.append(icon, nameEl, lvl, typeIcon);
                slotDiv.addEventListener('click', () => showSkillDetailModal(skill.id));
            }
        } else {
            slotDiv.classList.add('skills-equipped-slot-empty');
            slotDiv.textContent = 'Vide';
        }
        slotsRow.appendChild(slotDiv);
    }

    section.appendChild(slotsRow);
    return section;
}

// ── Skills Grid (unlocked only, sorted by tier) ─────────────

function buildSkillsGrid() {
    const wrapper = createElement('div', 'skills-grid-wrapper');
    const state = getSkillsState();

    // Only show unlocked skills
    const unlockedSkills = SKILLS.filter(s => (state.unlocked[s.id] || 0) > 0);

    if (unlockedSkills.length === 0) {
        const empty = createElement('div', 'skills-grid-empty', 'Aucun skill obtenu. Forgez pour en obtenir!');
        wrapper.appendChild(empty);
        return wrapper;
    }

    // Sort by tier (ascending) then passive before active
    unlockedSkills.sort((a, b) => a.tier - b.tier || (a.type === 'passive' ? -1 : 1));

    const grid = createElement('div', 'skills-grid');

    unlockedSkills.forEach(skill => {
        grid.appendChild(buildSkillCard(skill));
    });

    wrapper.appendChild(grid);
    return wrapper;
}

function buildSkillCard(skill) {
    const level = getSkillLevel(skill.id);
    const copies = getSkillCopies(skill.id);
    const isEquipped = isSkillEquipped(skill.id);
    const maxLevel = getSkillMaxLevel(skill);
    const tier = getSkillTier(skill);
    const canUp = canUpgradeSkill(skill.id);

    let cardClass = 'skill-card';
    if (isEquipped) cardClass += ' skill-equipped';
    if (canUp) cardClass += ' skill-upgradable';

    const card = createElement('div', cardClass);
    card.style.borderColor = tier.color;

    // Type icon (shield/sword)
    const typeIcon = createElement('div', 'skill-card-type-icon', skill.type === 'passive' ? '\uD83D\uDEE1\uFE0F' : '\u2694\uFE0F');
    card.appendChild(typeIcon);

    // Name
    const nameEl = createElement('div', 'skill-card-name', skill.name);
    nameEl.style.color = tier.color;
    card.appendChild(nameEl);

    // Level + copies
    const levelRow = createElement('div', 'skill-card-level-row');
    const lvlText = createElement('span', 'skill-card-level', `Niv.${level}`);
    levelRow.appendChild(lvlText);

    if (level < maxLevel) {
        const currentTotal = getTotalCopiesForLevel(level);
        const copiesInto = copies - currentTotal;
        const copiesNeeded = getSkillCopiesForLevel(level + 1);
        const copiesEl = createElement('span', 'skill-card-copies', `${copiesInto}/${copiesNeeded}`);
        if (canUp) copiesEl.classList.add('skill-card-copies-ready');
        levelRow.appendChild(copiesEl);
    } else {
        levelRow.appendChild(createElement('span', 'skill-card-copies skill-card-copies-max', 'MAX'));
    }

    card.appendChild(levelRow);

    // Click -> detail
    card.addEventListener('click', () => showSkillDetailModal(skill.id));

    return card;
}

// ── Skill Detail Modal ──────────────────────────────────────

function showSkillDetailModal(skillId) {
    const skill = getSkillById(skillId);
    if (!skill) return;

    let modal = document.getElementById('skill-detail-modal');
    if (!modal) {
        modal = createElement('div', 'modal');
        modal.id = 'skill-detail-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Skill details');
        modal.setAttribute('aria-modal', 'true');
        const content = createElement('div', 'modal-content');
        content.id = 'skill-detail-content';
        modal.appendChild(content);
        document.getElementById('game-container').appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    const content = document.getElementById('skill-detail-content');
    content.textContent = '';

    const level = getSkillLevel(skill.id);
    const copies = getSkillCopies(skill.id);
    const isUnlocked = level > 0;
    const equipped = isSkillEquipped(skill.id);
    const maxLevel = getSkillMaxLevel(skill);
    const tier = getSkillTier(skill);

    // Close
    const closeBtn = createElement('button', 'modal-close-btn', '\u2715');
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    content.appendChild(closeBtn);

    // Header
    const header = createElement('div', 'skill-detail-header');
    const icon = createElement('div', 'skill-detail-icon', skill.icon);
    header.appendChild(icon);

    const titleCol = createElement('div', 'skill-detail-title-col');
    const titleName = createElement('div', 'skill-detail-name', skill.name);
    titleName.style.color = tier.color;
    titleCol.appendChild(titleName);

    const tierRow = createElement('div', 'skill-detail-tier-row');
    const tierDot = createElement('span', 'skill-detail-tier-dot');
    tierDot.style.backgroundColor = tier.color;
    tierRow.appendChild(tierDot);
    const typeLabel = skill.type === 'passive' ? '\uD83D\uDEE1\uFE0F Passif' : '\u2694\uFE0F Actif';
    tierRow.appendChild(createElement('span', '', `${tier.name} \u2014 ${typeLabel}`));
    titleCol.appendChild(tierRow);
    header.appendChild(titleCol);
    content.appendChild(header);

    // Description
    content.appendChild(createElement('div', 'skill-detail-desc', skill.description));

    if (isUnlocked) {
        const levelSection = createElement('div', 'skill-detail-level-section');

        levelSection.appendChild(createElement('div', 'skill-detail-level-label', `Niveau ${level} / ${maxLevel}`));

        // Copies progress bar
        if (level < maxLevel) {
            const currentTotal = getTotalCopiesForLevel(level);
            const copiesInto = copies - currentTotal;
            const copiesNeeded = getSkillCopiesForLevel(level + 1);

            const progressBar = createElement('div', 'skill-detail-progress-bar');
            const progressFill = createElement('div', 'skill-detail-progress-fill');
            progressFill.style.width = `${(copiesInto / copiesNeeded) * 100}%`;
            progressFill.style.backgroundColor = tier.color;
            progressBar.appendChild(progressFill);
            levelSection.appendChild(progressBar);

            levelSection.appendChild(createElement('div', 'skill-detail-copies', `Copies: ${copiesInto} / ${copiesNeeded} pour le prochain niveau`));
        } else {
            const progressBar = createElement('div', 'skill-detail-progress-bar');
            const progressFill = createElement('div', 'skill-detail-progress-fill');
            progressFill.style.width = '100%';
            progressFill.style.backgroundColor = tier.color;
            progressBar.appendChild(progressFill);
            levelSection.appendChild(progressBar);
            levelSection.appendChild(createElement('div', 'skill-detail-copies', `Niveau maximum atteint (${copies} copies)`));
        }

        // Effect
        const effectText = createElement('div', 'skill-detail-effect');
        effectText.innerHTML = `<strong>Effet actuel:</strong> ${formatEffectDescription(skill, level)}`;
        levelSection.appendChild(effectText);

        if (level < maxLevel) {
            const nextText = createElement('div', 'skill-detail-next');
            nextText.innerHTML = `<strong>Prochain niveau:</strong> ${formatEffectDescription(skill, level + 1)}`;
            levelSection.appendChild(nextText);
        }

        // Active skill timing
        if (skill.type === 'active') {
            const cd = getSkillCooldown(skill, level);
            const dur = getSkillDuration(skill, level);
            const timingRow = createElement('div', 'skill-detail-timing');
            timingRow.innerHTML = dur > 0
                ? `\u23F1\uFE0F Dur\u00e9e: ${dur}s &nbsp; \uD83D\uDD04 Recharge: ${cd}s`
                : `\u26A1 Instantan\u00e9 &nbsp; \uD83D\uDD04 Recharge: ${cd}s`;
            levelSection.appendChild(timingRow);
        }

        content.appendChild(levelSection);

        // Actions
        const actions = createElement('div', 'skill-detail-actions');

        // Upgrade button
        if (canUpgradeSkill(skill.id)) {
            const upgradeBtn = createElement('button', 'btn skill-btn-upgrade', '\u2B06 Am\u00e9liorer');
            upgradeBtn.addEventListener('click', () => {
                if (upgradeSkill(skill.id)) {
                    showToast(`\u2B06 ${skill.name} Niv.${getSkillLevel(skill.id)}`, 'study');
                    showSkillDetailModal(skill.id);
                }
            });
            actions.appendChild(upgradeBtn);
        }

        // Equip / Unequip
        if (equipped) {
            const unequipBtn = createElement('button', 'btn skill-btn-unequip', '\u274C D\u00e9s\u00e9quiper');
            unequipBtn.addEventListener('click', () => {
                unequipSkill(skill.id);
                showSkillDetailModal(skill.id);
            });
            actions.appendChild(unequipBtn);
        } else {
            const equippedCount = getEquippedSkills().length;
            const canEquip = equippedCount < MAX_EQUIPPED_SKILLS;
            const equipBtn = createElement('button', `btn skill-btn-equip${canEquip ? '' : ' btn-disabled'}`,
                canEquip ? '\u2694\uFE0F \u00C9quiper' : 'Slots pleins');
            equipBtn.disabled = !canEquip;
            equipBtn.addEventListener('click', () => {
                if (equipSkill(skill.id)) {
                    showSkillDetailModal(skill.id);
                }
            });
            actions.appendChild(equipBtn);
        }

        content.appendChild(actions);
    }

    modal.classList.add('active');
}

function formatEffectDescription(skill, level) {
    const value = getSkillEffectValue(skill, level);
    const stat = skill.effect.stat;

    switch (stat) {
        case 'maxHPPercent': return `+${value}% max HP`;
        case 'damagePercent': return `+${value}% d\u00e9g\u00e2ts`;
        case 'attackSpeedPercent': return `+${value}% vitesse d'attaque`;
        case 'critChanceFlat': return `+${value}% chance de critique`;
        case 'berserkerRage': return `Vitesse d'attaque x2 quand HP < ${value}%`;
        case 'thornReflect': return `Renvoie ${value}% des d\u00e9g\u00e2ts re\u00e7us`;
        case 'lifeStealFlat': return `+${value}% life steal`;
        case 'overkill': return `${value}% du surplus de d\u00e9g\u00e2ts passe au monstre suivant`;
        case 'undyingWill': return `Survit un coup fatal (CD interne: ${value}s)`;
        case 'bonusEnhance': return `Bonus d'\u00e9quipement +${value}%`;
        case 'soulHarvest': return `+${value}% d\u00e9g\u00e2ts par monstre tu\u00e9 dans la wave`;
        case 'transcendence': return `+${value}% tous les stats par niveau du joueur`;
        case 'damageReduction': return `-${value}% d\u00e9g\u00e2ts re\u00e7us`;
        case 'powerStrike': return `3 prochaines attaques +${value}% d\u00e9g\u00e2ts`;
        case 'attackSpeedBurst': return `+${value}% vitesse d'attaque`;
        case 'instantHeal': return `Soin instantan\u00e9 ${value}% HP max`;
        case 'focusBurst': {
            const critMulti = (skill.effect.baseCritMulti || 0) + (skill.effect.critMultiPerLevel || 0) * (level - 1);
            return `+${value}% crit chance, +${critMulti}% crit multi`;
        }
        case 'enrage': {
            const taken = (skill.effect.damageTaken || 0) + (skill.effect.damageTakenPerLevel || 0) * (level - 1);
            return `+${value}% d\u00e9g\u00e2ts, +${Math.max(0, taken)}% d\u00e9g\u00e2ts re\u00e7us`;
        }
        case 'evasion': return `${value}% chance d'esquiver`;
        case 'lifeStealBurst': return `+${value}% life steal`;
        case 'warCry': return `+${value}% TOUS les stats`;
        case 'execute': return `${value}% d\u00e9g\u00e2ts aux monstres < ${skill.effect.threshold || 30}% HP`;
        case 'apocalypse': return `${value}% d\u00e9g\u00e2ts \u00e0 TOUS les monstres`;
        case 'divineShield': return `Immunit\u00e9 totale aux d\u00e9g\u00e2ts pendant ${getSkillDuration(skill, level)}s`;
        default: return `${value}`;
    }
}
