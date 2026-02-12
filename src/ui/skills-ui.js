// ══════════════════════════════════════════════════════════
// Skills UI — Skill Forge, collection, detail modal
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
    equipSkill, unequipSkill,
    canActivateSkill, getCooldownRemaining,
} from '../skills.js';
import {
    getSkillsState, getEquippedSkills, getCombatProgress,
    getSkillShards, getSkillCopies,
} from '../state.js';
import { createElement, formatNumber, formatCompact, formatTime } from './helpers.js';
import { showToast } from './helpers.js';
import { gameEvents, EVENTS } from '../events.js';

let activeFilter = 'all'; // 'all', 'passive', 'active'
let activeTierFilter = 0; // 0 = all, 1-6 = specific tier
let forging = false;

export function initSkillsUI() {
    renderSkillsTab();

    // Re-render on state changes
    gameEvents.on(EVENTS.STATE_CHANGED, renderSkillsTab);
    gameEvents.on(EVENTS.SKILL_FORGED, ({ skill, isNew, didLevelUp, tier }) => {
        const tierDef = TIERS[tier - 1];
        if (isNew) {
            showToast(`${skill.icon} ${skill.name} obtenu!`, 'study');
        } else if (didLevelUp) {
            showToast(`${skill.icon} ${skill.name} monte de niveau!`, 'study');
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

    // Shard counter + Forge button
    const forgeSection = buildForgeSection();
    container.appendChild(forgeSection);

    // Equipped skills bar
    const equippedSection = buildEquippedSection();
    container.appendChild(equippedSection);

    // Filters
    const filterRow = buildFilterRow();
    container.appendChild(filterRow);

    // Skills collection grid
    const grid = buildSkillsGrid();
    container.appendChild(grid);
}

// ── Skill Forge Section ─────────────────────────────────────

function buildForgeSection() {
    const section = createElement('div', 'skills-forge-section');

    // Shard display
    const shardRow = createElement('div', 'skills-shard-row');
    const shardIcon = createElement('span', 'skills-shard-icon', '\uD83D\uDD2E');
    const shardCount = createElement('span', 'skills-shard-count', `${formatNumber(getSkillShards())} Fragments`);
    const costHint = createElement('span', 'skills-shard-cost', `(${SKILL_FORGE_COST} par forge)`);
    shardRow.append(shardIcon, shardCount, costHint);
    section.appendChild(shardRow);

    // Tier chances preview
    const chanceRow = buildTierChancesPreview();
    section.appendChild(chanceRow);

    // Forge button
    const canDo = canForgeSkill() && !forging;
    const forgeBtn = createElement('button', `btn skills-forge-btn${canDo ? '' : ' btn-disabled'}`,
        forging ? '\u2728 Forge...' : `\u2728 Forger un Skill (${SKILL_FORGE_COST} \uD83D\uDD2E)`);
    forgeBtn.disabled = !canDo;
    forgeBtn.addEventListener('click', () => {
        if (forging || !canForgeSkill()) return;
        forging = true;
        forgeBtn.classList.add('forging');
        forgeBtn.textContent = '\u2728 Forge...';

        setTimeout(() => {
            forging = false;
            const result = forgeSkill();
            if (result) {
                showForgeResult(result);
            }
        }, 1200);
    });
    section.appendChild(forgeBtn);

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
    const { skill, tier, copies, level, isNew, didLevelUp } = result;
    const tierDef = TIERS[tier - 1];

    // Create or re-use forge result modal
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

    // Close button
    const closeBtn = createElement('button', 'modal-close-btn', '\u2715');
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    content.appendChild(closeBtn);

    // Result header
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
        const tag = createElement('div', 'skill-forge-result-tag skill-forge-new', 'NOUVEAU!');
        content.appendChild(tag);
    } else if (didLevelUp) {
        const tag = createElement('div', 'skill-forge-result-tag skill-forge-levelup', `NIVEAU ${level}!`);
        content.appendChild(tag);
    } else {
        const maxLevel = getSkillMaxLevel(skill);
        const nextLevelCopies = level < maxLevel ? getTotalCopiesForLevel(level + 1) : null;
        const tag = createElement('div', 'skill-forge-result-tag skill-forge-copy',
            nextLevelCopies !== null
                ? `Copie ${copies} / ${nextLevelCopies}`
                : `MAX (${copies} copies)`);
        content.appendChild(tag);
    }

    // Description
    const desc = createElement('div', 'skill-forge-result-desc', skill.description);
    content.appendChild(desc);

    // Forge again button
    const canDoAgain = canForgeSkill();
    const againBtn = createElement('button', `btn skills-forge-btn${canDoAgain ? '' : ' btn-disabled'}`,
        `\u2728 Forger encore (${SKILL_FORGE_COST} \uD83D\uDD2E)`);
    againBtn.disabled = !canDoAgain;
    againBtn.addEventListener('click', () => {
        if (!canForgeSkill()) return;
        modal.classList.remove('active');
        // Small delay to re-trigger forge
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

// ── Equipped Skills Section ─────────────────────────────────

function buildEquippedSection() {
    const section = createElement('div', 'skills-equipped-section');
    const title = createElement('div', 'skills-equipped-title', 'Skills Equip\u00e9s');
    section.appendChild(title);

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
                const name = createElement('span', 'skills-equipped-name', skill.name);
                name.style.color = tier.color;

                const level = getSkillLevel(skill.id);
                const lvl = createElement('span', 'skills-equipped-level', `Niv.${level}`);

                const typeTag = createElement('span', `skills-type-tag skills-type-${skill.type}`, skill.type === 'passive' ? 'P' : 'A');

                slotDiv.append(icon, name, lvl, typeTag);
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

// ── Filter Row ──────────────────────────────────────────────

function buildFilterRow() {
    const row = createElement('div', 'skills-filter-row');

    // Type filter
    const typeFilters = createElement('div', 'skills-type-filters');
    const types = [
        { key: 'all', label: 'Tous' },
        { key: 'passive', label: 'Passifs' },
        { key: 'active', label: 'Actifs' },
    ];
    types.forEach(({ key, label }) => {
        const btn = createElement('button', `skills-filter-btn${activeFilter === key ? ' active' : ''}`, label);
        btn.addEventListener('click', () => {
            activeFilter = key;
            renderSkillsTab();
        });
        typeFilters.appendChild(btn);
    });
    row.appendChild(typeFilters);

    // Tier filter
    const tierFilters = createElement('div', 'skills-tier-filters');
    const allBtn = createElement('button', `skills-tier-btn${activeTierFilter === 0 ? ' active' : ''}`, 'All');
    allBtn.addEventListener('click', () => {
        activeTierFilter = 0;
        renderSkillsTab();
    });
    tierFilters.appendChild(allBtn);

    TIERS.forEach((tier, idx) => {
        const btn = createElement('button', `skills-tier-btn${activeTierFilter === idx + 1 ? ' active' : ''}`);
        btn.style.color = tier.color;
        btn.textContent = tier.name.charAt(0);
        btn.title = tier.name;
        btn.addEventListener('click', () => {
            activeTierFilter = idx + 1;
            renderSkillsTab();
        });
        tierFilters.appendChild(btn);
    });
    row.appendChild(tierFilters);

    return row;
}

// ── Skills Grid ─────────────────────────────────────────────

function buildSkillsGrid() {
    const grid = createElement('div', 'skills-grid');

    let filteredSkills = [...SKILLS];
    if (activeFilter !== 'all') {
        filteredSkills = filteredSkills.filter(s => s.type === activeFilter);
    }
    if (activeTierFilter > 0) {
        filteredSkills = filteredSkills.filter(s => s.tier === activeTierFilter);
    }

    // Sort by tier then type
    filteredSkills.sort((a, b) => a.tier - b.tier || (a.type === 'passive' ? -1 : 1));

    filteredSkills.forEach(skill => {
        const card = buildSkillCard(skill);
        grid.appendChild(card);
    });

    return grid;
}

function buildSkillCard(skill) {
    const state = getSkillsState();
    const level = state.unlocked[skill.id] || 0;
    const copies = getSkillCopies(skill.id);
    const isUnlocked = level > 0;
    const isEquipped = isSkillEquipped(skill.id);
    const maxLevel = getSkillMaxLevel(skill);
    const tier = getSkillTier(skill);

    let cardClass = 'skill-card';
    if (!isUnlocked) cardClass += ' skill-locked';
    if (isEquipped) cardClass += ' skill-equipped';

    const card = createElement('div', cardClass);
    card.style.borderColor = isUnlocked ? tier.color : '#333';

    // Icon
    const iconDiv = createElement('div', 'skill-card-icon', skill.icon);
    card.appendChild(iconDiv);

    // Info column
    const info = createElement('div', 'skill-card-info');

    const nameRow = createElement('div', 'skill-card-name-row');
    const name = createElement('span', 'skill-card-name', skill.name);
    name.style.color = isUnlocked ? tier.color : '#666';
    nameRow.appendChild(name);

    const typeTag = createElement('span', `skills-type-tag skills-type-${skill.type}`, skill.type === 'passive' ? 'Passif' : 'Actif');
    nameRow.appendChild(typeTag);
    info.appendChild(nameRow);

    const tierLabel = createElement('div', 'skill-card-tier', tier.name);
    tierLabel.style.color = tier.color;
    info.appendChild(tierLabel);

    if (isUnlocked) {
        const levelText = createElement('div', 'skill-card-level', `Niv. ${level}/${maxLevel}`);
        info.appendChild(levelText);

        // Copies progress to next level
        if (level < maxLevel) {
            const nextTotalCopies = getTotalCopiesForLevel(level + 1);
            const currentTotalForLevel = getTotalCopiesForLevel(level);
            const copiesIntoLevel = copies - currentTotalForLevel;
            const copiesNeeded = getSkillCopiesForLevel(level + 1);
            const progressBar = createElement('div', 'skill-level-bar');
            const progressFill = createElement('div', 'skill-level-fill');
            progressFill.style.width = `${(copiesIntoLevel / copiesNeeded) * 100}%`;
            progressFill.style.backgroundColor = tier.color;
            progressBar.appendChild(progressFill);
            info.appendChild(progressBar);

            const copiesText = createElement('div', 'skill-card-copies', `${copiesIntoLevel}/${copiesNeeded} copies`);
            info.appendChild(copiesText);
        } else {
            const maxTag = createElement('div', 'skill-card-copies', 'MAX');
            info.appendChild(maxTag);
        }
    } else if (copies > 0) {
        // Has copies but not yet level 1 (shouldn't happen with 1-copy unlock, but defensive)
        const copiesText = createElement('div', 'skill-card-copies', `${copies}/1 copie`);
        info.appendChild(copiesText);
    } else {
        const lockText = createElement('div', 'skill-card-locked-text', '\uD83D\uDD12 Non obtenu');
        info.appendChild(lockText);
    }

    card.appendChild(info);

    // Click handler -> detail modal
    card.addEventListener('click', () => showSkillDetailModal(skill.id));

    return card;
}

// ── Skill Detail Modal ──────────────────────────────────────

function showSkillDetailModal(skillId) {
    const skill = getSkillById(skillId);
    if (!skill) return;

    // Use a generic modal approach — create/re-use a skill modal
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

    const state = getSkillsState();
    const level = state.unlocked[skill.id] || 0;
    const copies = getSkillCopies(skill.id);
    const isUnlocked = level > 0;
    const equipped = isSkillEquipped(skill.id);
    const maxLevel = getSkillMaxLevel(skill);
    const tier = getSkillTier(skill);

    // Close button
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
    tierRow.appendChild(createElement('span', '', `${tier.name} \u2014 ${skill.type === 'passive' ? 'Passif' : 'Actif'}`));
    titleCol.appendChild(tierRow);
    header.appendChild(titleCol);
    content.appendChild(header);

    // Description
    const desc = createElement('div', 'skill-detail-desc', skill.description);
    content.appendChild(desc);

    if (isUnlocked) {
        // Level info
        const levelSection = createElement('div', 'skill-detail-level-section');

        const levelLabel = createElement('div', 'skill-detail-level-label', `Niveau ${level} / ${maxLevel}`);
        levelSection.appendChild(levelLabel);

        // Copies progress bar
        if (level < maxLevel) {
            const currentTotalForLevel = getTotalCopiesForLevel(level);
            const copiesIntoLevel = copies - currentTotalForLevel;
            const copiesNeeded = getSkillCopiesForLevel(level + 1);

            const progressBar = createElement('div', 'skill-detail-progress-bar');
            const progressFill = createElement('div', 'skill-detail-progress-fill');
            progressFill.style.width = `${(copiesIntoLevel / copiesNeeded) * 100}%`;
            progressFill.style.backgroundColor = tier.color;
            progressBar.appendChild(progressFill);
            levelSection.appendChild(progressBar);

            const copiesLabel = createElement('div', 'skill-detail-copies', `Copies: ${copiesIntoLevel} / ${copiesNeeded} pour le prochain niveau`);
            levelSection.appendChild(copiesLabel);
        } else {
            const progressBar = createElement('div', 'skill-detail-progress-bar');
            const progressFill = createElement('div', 'skill-detail-progress-fill');
            progressFill.style.width = '100%';
            progressFill.style.backgroundColor = tier.color;
            progressBar.appendChild(progressFill);
            levelSection.appendChild(progressBar);

            const maxLabel = createElement('div', 'skill-detail-copies', `Niveau maximum atteint (${copies} copies)`);
            levelSection.appendChild(maxLabel);
        }

        // Current effect
        const effectText = createElement('div', 'skill-detail-effect');
        effectText.innerHTML = `<strong>Effet actuel:</strong> ${formatEffectDescription(skill, level)}`;
        levelSection.appendChild(effectText);

        // Next level preview
        if (level < maxLevel) {
            const nextText = createElement('div', 'skill-detail-next');
            nextText.innerHTML = `<strong>Prochain niveau:</strong> ${formatEffectDescription(skill, level + 1)}`;
            levelSection.appendChild(nextText);
        }

        // Active skill: show cooldown & duration
        if (skill.type === 'active') {
            const cd = getSkillCooldown(skill, level);
            const dur = getSkillDuration(skill, level);
            const timingRow = createElement('div', 'skill-detail-timing');
            if (dur > 0) {
                timingRow.innerHTML = `\u23F1\uFE0F Dur\u00e9e: ${dur}s &nbsp; \uD83D\uDD04 Recharge: ${cd}s`;
            } else {
                timingRow.innerHTML = `\u26A1 Instantan\u00e9 &nbsp; \uD83D\uDD04 Recharge: ${cd}s`;
            }
            levelSection.appendChild(timingRow);
        }

        content.appendChild(levelSection);

        // Action buttons
        const actions = createElement('div', 'skill-detail-actions');

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
    } else {
        // Not yet unlocked - show preview
        const lockSection = createElement('div', 'skill-detail-lock-section');

        const reqTitle = createElement('div', 'skill-detail-req-title', '\uD83D\uDD12 Pas encore obtenu');
        lockSection.appendChild(reqTitle);

        const hint = createElement('div', 'skill-detail-forge-hint', 'Forgez des skills pour obtenir cette comp\u00e9tence al\u00e9atoirement!');
        lockSection.appendChild(hint);

        // Copies progress (if any copies collected)
        if (copies > 0) {
            const copiesLabel = createElement('div', 'skill-detail-copies', `Copies: ${copies} / 1`);
            lockSection.appendChild(copiesLabel);
        }

        // Effect preview at level 1
        const previewText = createElement('div', 'skill-detail-preview');
        previewText.innerHTML = `<strong>Effet (Niv.1):</strong> ${formatEffectDescription(skill, 1)}`;
        lockSection.appendChild(previewText);

        content.appendChild(lockSection);
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
