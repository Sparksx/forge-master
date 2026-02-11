// ══════════════════════════════════════════════════════════
// Skills UI — Collection, detail modal, equip/unequip
// ══════════════════════════════════════════════════════════

import {
    SKILLS, getSkillById, getSkillMaxLevel, getSkillUnlockReqs,
    getSkillLevelUpCost, getSkillCooldown, getSkillDuration,
    getSkillEffectValue, getSkillTier, MAX_EQUIPPED_SKILLS,
} from '../skills-config.js';
import { TIERS } from '../config.js';
import {
    getSkillLevel, isSkillEquipped, canUnlockSkill, unlockSkill,
    canLevelUpSkill, levelUpSkill, equipSkill, unequipSkill,
    canActivateSkill, getCooldownRemaining,
} from '../skills.js';
import { getSkillsState, getEquippedSkills, getCombatProgress, getEssence, getGold } from '../state.js';
import { createElement, formatNumber, formatCompact, formatTime } from './helpers.js';
import { showToast } from './helpers.js';
import { gameEvents, EVENTS } from '../events.js';

let activeFilter = 'all'; // 'all', 'passive', 'active'
let activeTierFilter = 0; // 0 = all, 1-6 = specific tier

export function initSkillsUI() {
    renderSkillsTab();

    // Re-render on state changes
    gameEvents.on(EVENTS.STATE_CHANGED, renderSkillsTab);
    gameEvents.on(EVENTS.SKILL_UNLOCKED, ({ skill }) => {
        showToast(`⚡ ${skill.name} débloqué!`, 'study');
    });
    gameEvents.on(EVENTS.SKILL_LEVELED, ({ skillId, level }) => {
        const skill = getSkillById(skillId);
        if (skill) showToast(`⬆️ ${skill.name} Niv.${level}`, 'study');
    });
}

export function renderSkillsTab() {
    const container = document.getElementById('subtab-skills');
    if (!container) return;
    container.textContent = '';

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

// ── Equipped Skills Section ─────────────────────────────────

function buildEquippedSection() {
    const section = createElement('div', 'skills-equipped-section');
    const title = createElement('div', 'skills-equipped-title', 'Equipped Skills');
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
            slotDiv.textContent = 'Empty';
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
    name.style.color = tier.color;
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

        // Level progress bar
        const progressBar = createElement('div', 'skill-level-bar');
        const progressFill = createElement('div', 'skill-level-fill');
        progressFill.style.width = `${(level / maxLevel) * 100}%`;
        progressFill.style.backgroundColor = tier.color;
        progressBar.appendChild(progressFill);
        info.appendChild(progressBar);
    } else {
        const lockText = createElement('div', 'skill-card-locked-text', '🔒 Locked');
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
    const isUnlocked = level > 0;
    const equipped = isSkillEquipped(skill.id);
    const maxLevel = getSkillMaxLevel(skill);
    const tier = getSkillTier(skill);

    // Close button
    const closeBtn = createElement('button', 'modal-close-btn', '✕');
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
    tierRow.appendChild(createElement('span', '', `${tier.name} — ${skill.type === 'passive' ? 'Passif' : 'Actif'}`));
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

        const progressBar = createElement('div', 'skill-detail-progress-bar');
        const progressFill = createElement('div', 'skill-detail-progress-fill');
        progressFill.style.width = `${(level / maxLevel) * 100}%`;
        progressFill.style.backgroundColor = tier.color;
        progressBar.appendChild(progressFill);
        levelSection.appendChild(progressBar);

        // Current effect
        const currentValue = getSkillEffectValue(skill, level);
        const effectText = createElement('div', 'skill-detail-effect');
        effectText.innerHTML = `<strong>Effet actuel:</strong> ${formatEffectDescription(skill, level)}`;
        levelSection.appendChild(effectText);

        // Next level preview
        if (level < maxLevel) {
            const nextValue = getSkillEffectValue(skill, level + 1);
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
                timingRow.innerHTML = `⏱️ Durée: ${dur}s &nbsp; 🔄 Recharge: ${cd}s`;
            } else {
                timingRow.innerHTML = `⚡ Instantané &nbsp; 🔄 Recharge: ${cd}s`;
            }
            levelSection.appendChild(timingRow);
        }

        content.appendChild(levelSection);

        // Action buttons
        const actions = createElement('div', 'skill-detail-actions');

        // Level up button
        if (level < maxLevel) {
            const cost = getSkillLevelUpCost(skill.tier, level + 1);
            const canAfford = getEssence() >= cost;
            const upgradeBtn = createElement('button', `btn skill-btn-upgrade${canAfford ? '' : ' btn-disabled'}`,
                `⬆️ Upgrade — ${formatCompact(cost)} 🔮`);
            upgradeBtn.disabled = !canAfford;
            upgradeBtn.addEventListener('click', () => {
                if (levelUpSkill(skill.id)) {
                    showSkillDetailModal(skill.id); // refresh
                }
            });
            actions.appendChild(upgradeBtn);
        } else {
            actions.appendChild(createElement('div', 'skill-detail-maxed', 'MAX'));
        }

        // Equip / Unequip
        if (equipped) {
            const unequipBtn = createElement('button', 'btn skill-btn-unequip', '❌ Unequip');
            unequipBtn.addEventListener('click', () => {
                unequipSkill(skill.id);
                showSkillDetailModal(skill.id);
            });
            actions.appendChild(unequipBtn);
        } else {
            const equippedCount = getEquippedSkills().length;
            const canEquip = equippedCount < MAX_EQUIPPED_SKILLS;
            const equipBtn = createElement('button', `btn skill-btn-equip${canEquip ? '' : ' btn-disabled'}`,
                canEquip ? '⚔️ Equip' : 'Slots pleins');
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
        // Locked: show unlock requirements
        const reqs = getSkillUnlockReqs(skill.tier);
        const combat = getCombatProgress();

        const lockSection = createElement('div', 'skill-detail-lock-section');

        const reqTitle = createElement('div', 'skill-detail-req-title', '🔒 Requirements to unlock:');
        lockSection.appendChild(reqTitle);

        const reqList = createElement('div', 'skill-detail-req-list');

        const waveReq = createElement('div', `skill-detail-req ${combat.highestWave >= reqs.wave ? 'req-met' : 'req-unmet'}`);
        waveReq.textContent = `Wave ${reqs.wave} ${combat.highestWave >= reqs.wave ? '✓' : '✗'}`;
        reqList.appendChild(waveReq);

        const essenceReq = createElement('div', `skill-detail-req ${getEssence() >= reqs.essenceCost ? 'req-met' : 'req-unmet'}`);
        essenceReq.textContent = `${formatNumber(reqs.essenceCost)} 🔮 ${getEssence() >= reqs.essenceCost ? '✓' : '✗'}`;
        reqList.appendChild(essenceReq);

        const goldReq = createElement('div', `skill-detail-req ${getGold() >= reqs.goldCost ? 'req-met' : 'req-unmet'}`);
        goldReq.textContent = `${formatNumber(reqs.goldCost)} 💰 ${getGold() >= reqs.goldCost ? '✓' : '✗'}`;
        reqList.appendChild(goldReq);

        lockSection.appendChild(reqList);

        // Effect preview at level 1
        const previewText = createElement('div', 'skill-detail-preview');
        previewText.innerHTML = `<strong>Effet (Niv.1):</strong> ${formatEffectDescription(skill, 1)}`;
        lockSection.appendChild(previewText);

        // Unlock button
        const canDo = canUnlockSkill(skill.id);
        const unlockBtn = createElement('button', `btn skill-btn-unlock${canDo ? '' : ' btn-disabled'}`, '🔓 Unlock');
        unlockBtn.disabled = !canDo;
        unlockBtn.addEventListener('click', () => {
            if (unlockSkill(skill.id)) {
                showSkillDetailModal(skill.id);
            }
        });
        lockSection.appendChild(unlockBtn);

        content.appendChild(lockSection);
    }

    modal.classList.add('active');
}

function formatEffectDescription(skill, level) {
    const value = getSkillEffectValue(skill, level);
    const stat = skill.effect.stat;

    switch (stat) {
        case 'maxHPPercent': return `+${value}% max HP`;
        case 'damagePercent': return `+${value}% dégâts`;
        case 'attackSpeedPercent': return `+${value}% vitesse d'attaque`;
        case 'critChanceFlat': return `+${value}% chance de critique`;
        case 'berserkerRage': return `Vitesse d'attaque x2 quand HP < ${value}%`;
        case 'thornReflect': return `Renvoie ${value}% des dégâts reçus`;
        case 'lifeStealFlat': return `+${value}% life steal`;
        case 'overkill': return `${value}% du surplus de dégâts passe au monstre suivant`;
        case 'undyingWill': return `Survit un coup fatal (CD interne: ${value}s)`;
        case 'bonusEnhance': return `Bonus d'équipement +${value}%`;
        case 'soulHarvest': return `+${value}% dégâts par monstre tué dans la wave`;
        case 'transcendence': return `+${value}% tous les stats par niveau du joueur`;
        case 'damageReduction': return `-${value}% dégâts reçus`;
        case 'powerStrike': return `3 prochaines attaques +${value}% dégâts`;
        case 'attackSpeedBurst': return `+${value}% vitesse d'attaque`;
        case 'instantHeal': return `Soin instantané ${value}% HP max`;
        case 'focusBurst': {
            const critMulti = (skill.effect.baseCritMulti || 0) + (skill.effect.critMultiPerLevel || 0) * (level - 1);
            return `+${value}% crit chance, +${critMulti}% crit multi`;
        }
        case 'enrage': {
            const taken = (skill.effect.damageTaken || 0) + (skill.effect.damageTakenPerLevel || 0) * (level - 1);
            return `+${value}% dégâts, +${Math.max(0, taken)}% dégâts reçus`;
        }
        case 'evasion': return `${value}% chance d'esquiver`;
        case 'lifeStealBurst': return `+${value}% life steal`;
        case 'warCry': return `+${value}% TOUS les stats`;
        case 'execute': return `${value}% dégâts aux monstres < ${skill.effect.threshold || 30}% HP`;
        case 'apocalypse': return `${value}% dégâts à TOUS les monstres`;
        case 'divineShield': return `Immunité totale aux dégâts pendant ${getSkillDuration(skill, level)}s`;
        default: return `${value}`;
    }
}
