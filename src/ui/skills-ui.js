import { TIERS } from '../config.js';
import {
    getAllSkills, getSkillById, getSkillDescription, getSkillLevelUpCost,
    MAX_SKILL_LEVEL, MAX_EQUIPPED_SKILLS,
} from '../skills-config.js';
import {
    getSkillsState, getSkillLevel, isSkillUnlocked, isSkillEquipped,
    canUnlockSkill, unlockSkill, levelUpSkill, equipSkill, unequipSkill,
    getEssence, getPlayerLevel, getCombatProgress,
} from '../state.js';
import { gameEvents, EVENTS } from '../events.js';
import { createElement, formatNumber, showToast } from './helpers.js';

// --- Filter state ---
let filterType = 'all';   // 'all' | 'passive' | 'active'
let filterTier = 0;       // 0 = all, 1-6

// --- Public init ---

export function initSkillsUI() {
    renderSkillsPage();

    // Re-render on relevant changes
    gameEvents.on(EVENTS.STATE_CHANGED, renderSkillsPage);
    gameEvents.on(EVENTS.SKILL_UNLOCKED, ({ skillId }) => {
        showToast(`Skill unlocked: ${getSkillById(skillId)?.name}`, 'forge');
        renderSkillsPage();
    });
    gameEvents.on(EVENTS.SKILL_LEVELED, renderSkillsPage);
    gameEvents.on(EVENTS.SKILL_EQUIPPED, renderSkillsPage);
    gameEvents.on(EVENTS.SKILL_UNEQUIPPED, renderSkillsPage);
}

// --- Render the full skills sub-tab ---

function renderSkillsPage() {
    const container = document.getElementById('subtab-skills');
    if (!container) return;
    container.innerHTML = '';

    // Equipped section
    container.appendChild(renderEquippedSection());

    // Filters
    container.appendChild(renderFilters());

    // Collection
    container.appendChild(renderCollection());
}

// --- Equipped slots ---

function renderEquippedSection() {
    const section = createElement('div', 'skills-equipped-section');
    const title = createElement('h3', 'skills-section-title', 'Equipped Skills');
    section.appendChild(title);

    const slotsRow = createElement('div', 'skills-equipped-slots');
    const equipped = getSkillsState().equipped;

    for (let i = 0; i < MAX_EQUIPPED_SKILLS; i++) {
        const skillId = equipped[i];
        const slot = createElement('div', 'skill-equipped-slot');

        if (skillId) {
            const skill = getSkillById(skillId);
            const level = getSkillLevel(skillId);
            const tierDef = TIERS[skill.tier - 1];

            slot.classList.add('skill-equipped-filled');
            slot.style.borderColor = tierDef.color;

            slot.innerHTML = `
                <span class="skill-equipped-icon">${skill.icon}</span>
                <span class="skill-equipped-name">${skill.name}</span>
                <span class="skill-equipped-level">Lv.${level}</span>
                <span class="skill-equipped-badge skill-badge-${skill.type}">${skill.type === 'passive' ? 'P' : 'A'}</span>
            `;

            slot.addEventListener('click', () => openSkillModal(skill.id));
        } else {
            slot.classList.add('skill-equipped-empty');
            slot.innerHTML = '<span class="skill-equipped-plus">+</span>';
        }

        slotsRow.appendChild(slot);
    }

    section.appendChild(slotsRow);
    return section;
}

// --- Filters ---

function renderFilters() {
    const wrap = createElement('div', 'skills-filters');

    // Type filter
    const typeRow = createElement('div', 'skills-filter-row');
    ['all', 'passive', 'active'].forEach(t => {
        const btn = createElement('button', `skills-filter-btn${filterType === t ? ' active' : ''}`,
            t === 'all' ? 'All' : t === 'passive' ? 'Passive' : 'Active');
        btn.addEventListener('click', () => { filterType = t; renderSkillsPage(); });
        typeRow.appendChild(btn);
    });
    wrap.appendChild(typeRow);

    // Tier filter
    const tierRow = createElement('div', 'skills-filter-row');
    const allBtn = createElement('button', `skills-filter-btn skills-tier-btn${filterTier === 0 ? ' active' : ''}`, 'All');
    allBtn.addEventListener('click', () => { filterTier = 0; renderSkillsPage(); });
    tierRow.appendChild(allBtn);
    TIERS.forEach(tier => {
        const btn = createElement('button', `skills-filter-btn skills-tier-btn${filterTier === tier.id ? ' active' : ''}`);
        btn.innerHTML = `<span class="tier-dot" style="background:${tier.color}"></span>${tier.name}`;
        btn.addEventListener('click', () => { filterTier = tier.id; renderSkillsPage(); });
        tierRow.appendChild(btn);
    });
    wrap.appendChild(tierRow);

    return wrap;
}

// --- Collection ---

function renderCollection() {
    const list = createElement('div', 'skills-collection');
    let skills = getAllSkills();

    if (filterType !== 'all') skills = skills.filter(s => s.type === filterType);
    if (filterTier > 0) skills = skills.filter(s => s.tier === filterTier);

    for (const skill of skills) {
        list.appendChild(renderSkillCard(skill));
    }

    if (skills.length === 0) {
        list.appendChild(createElement('div', 'skills-empty', 'No skills match this filter.'));
    }

    return list;
}

function renderSkillCard(skill) {
    const unlocked = isSkillUnlocked(skill.id);
    const canUnlock = canUnlockSkill(skill.id);
    const level = getSkillLevel(skill.id);
    const equipped = isSkillEquipped(skill.id);
    const tierDef = TIERS[skill.tier - 1];

    const card = createElement('div', `skill-card${unlocked ? '' : ' skill-locked'}${equipped ? ' skill-equipped-highlight' : ''}`);
    card.style.borderLeftColor = tierDef.color;

    if (!unlocked) {
        // Locked card
        const req = skill.unlock;
        let reqText = '';
        if (req.type === 'playerLevel') reqText = `Player Level ${req.level}`;
        else if (req.type === 'wave') reqText = `Wave ${req.wave}-${req.subWave}`;

        card.innerHTML = `
            <div class="skill-card-header">
                <span class="skill-card-icon">${skill.icon}</span>
                <span class="skill-card-name">${skill.name}</span>
                <span class="skill-card-tier" style="color:${tierDef.color}">${tierDef.name}</span>
            </div>
            <div class="skill-card-locked">
                🔒 Requires: ${reqText}
                ${canUnlock ? '<button class="skill-unlock-btn">Unlock</button>' : ''}
            </div>
        `;

        if (canUnlock) {
            card.querySelector('.skill-unlock-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                unlockSkill(skill.id);
            });
        }
        return card;
    }

    // Unlocked card
    const desc = getSkillDescription(skill, level);
    const equippedSkills = getSkillsState().equipped;
    const hasEmptySlot = equippedSkills.includes(null);

    card.innerHTML = `
        <div class="skill-card-header">
            <span class="skill-card-icon">${skill.icon}</span>
            <div class="skill-card-title-col">
                <span class="skill-card-name">${skill.name}</span>
                <span class="skill-card-desc">${desc}</span>
            </div>
            <div class="skill-card-meta">
                <span class="skill-card-tier" style="color:${tierDef.color}">${tierDef.name}</span>
                <span class="skill-badge-${skill.type}">${skill.type === 'passive' ? 'Passive' : 'Active'}</span>
                <span class="skill-card-level">Lv.${level}</span>
            </div>
        </div>
        <div class="skill-card-actions"></div>
    `;

    const actions = card.querySelector('.skill-card-actions');

    // Equip / Unequip button
    if (equipped) {
        const unBtn = createElement('button', 'skill-action-btn skill-unequip-btn', 'Unequip');
        unBtn.addEventListener('click', (e) => { e.stopPropagation(); unequipSkill(skill.id); });
        actions.appendChild(unBtn);
    } else if (hasEmptySlot) {
        const eqBtn = createElement('button', 'skill-action-btn skill-equip-btn', 'Equip');
        eqBtn.addEventListener('click', (e) => { e.stopPropagation(); equipSkill(skill.id); });
        actions.appendChild(eqBtn);
    } else {
        const fullBtn = createElement('button', 'skill-action-btn skill-full-btn', 'Slots full');
        fullBtn.disabled = true;
        actions.appendChild(fullBtn);
    }

    // Level up button
    if (level < MAX_SKILL_LEVEL) {
        const cost = getSkillLevelUpCost(skill.tier, level);
        const canAfford = getEssence() >= cost;
        const lvlBtn = createElement('button',
            `skill-action-btn skill-levelup-btn${canAfford ? '' : ' skill-btn-disabled'}`,
            `Level Up (${formatNumber(cost)} 🔮)`);
        if (canAfford) {
            lvlBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                levelUpSkill(skill.id);
            });
        }
        actions.appendChild(lvlBtn);
    } else {
        actions.appendChild(createElement('span', 'skill-max-level', 'MAX'));
    }

    // Click card to open detail
    card.addEventListener('click', () => openSkillModal(skill.id));

    return card;
}

// --- Skill detail modal ---

function openSkillModal(skillId) {
    const skill = getSkillById(skillId);
    if (!skill) return;
    const level = getSkillLevel(skillId);
    const tierDef = TIERS[skill.tier - 1];
    const equipped = isSkillEquipped(skillId);
    const equippedSkills = getSkillsState().equipped;
    const hasEmptySlot = equippedSkills.includes(null);

    // Reuse existing modal infrastructure
    const modal = document.getElementById('item-detail-modal');
    const info = document.getElementById('item-detail-info');
    if (!modal || !info) return;

    const desc = getSkillDescription(skill, level);
    let nextDesc = '';
    if (level < MAX_SKILL_LEVEL) {
        nextDesc = getSkillDescription(skill, level + 1);
    }

    let html = `
        <div class="skill-detail">
            <div class="skill-detail-header" style="border-color:${tierDef.color}">
                <span class="skill-detail-icon">${skill.icon}</span>
                <div>
                    <div class="skill-detail-name" style="color:${tierDef.color}">${skill.name}</div>
                    <div class="skill-detail-tier">${tierDef.name} &middot; ${skill.type === 'passive' ? 'Passive' : 'Active'}</div>
                </div>
            </div>
            <div class="skill-detail-level">Level ${level} / ${MAX_SKILL_LEVEL}</div>
            <div class="skill-detail-bar">
                <div class="skill-detail-bar-fill" style="width:${(level / MAX_SKILL_LEVEL) * 100}%"></div>
            </div>
            <div class="skill-detail-desc">
                <div class="skill-detail-current">${desc}</div>
    `;

    if (level < MAX_SKILL_LEVEL) {
        const cost = getSkillLevelUpCost(skill.tier, level);
        html += `<div class="skill-detail-next">Next: ${nextDesc}</div>
                 <div class="skill-detail-cost">Level up cost: ${formatNumber(cost)} 🔮</div>`;
    }

    html += `</div><div class="skill-detail-actions">`;

    if (equipped) {
        html += `<button class="btn btn-sell skill-modal-unequip">Unequip</button>`;
    } else if (hasEmptySlot) {
        html += `<button class="btn btn-equip skill-modal-equip">Equip</button>`;
    } else {
        // Allow swap: show equipped skills to replace
        html += `<div class="skill-swap-label">Replace a skill:</div>`;
        for (let i = 0; i < MAX_EQUIPPED_SKILLS; i++) {
            const sid = equippedSkills[i];
            if (sid) {
                const s = getSkillById(sid);
                html += `<button class="btn btn-sell skill-modal-swap" data-slot="${i}">${s.icon} ${s.name}</button>`;
            }
        }
    }

    if (level < MAX_SKILL_LEVEL) {
        const cost = getSkillLevelUpCost(skill.tier, level);
        const canAfford = getEssence() >= cost;
        html += `<button class="btn btn-equip skill-modal-levelup${canAfford ? '' : ' btn-disabled'}" ${canAfford ? '' : 'disabled'}>Level Up</button>`;
    }

    html += `<button class="btn btn-equip skill-modal-close">Close</button>`;
    html += `</div></div>`;

    info.innerHTML = html;

    // Wire actions
    const closeBtn = info.querySelector('.skill-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));

    const equipBtn = info.querySelector('.skill-modal-equip');
    if (equipBtn) equipBtn.addEventListener('click', () => {
        equipSkill(skillId);
        modal.classList.remove('active');
    });

    const unequipBtn = info.querySelector('.skill-modal-unequip');
    if (unequipBtn) unequipBtn.addEventListener('click', () => {
        unequipSkill(skillId);
        modal.classList.remove('active');
    });

    info.querySelectorAll('.skill-modal-swap').forEach(btn => {
        btn.addEventListener('click', () => {
            const slot = parseInt(btn.dataset.slot);
            const oldId = equippedSkills[slot];
            if (oldId) unequipSkill(oldId);
            equipSkill(skillId, slot);
            modal.classList.remove('active');
        });
    });

    const lvlBtn = info.querySelector('.skill-modal-levelup');
    if (lvlBtn && !lvlBtn.disabled) {
        lvlBtn.addEventListener('click', () => {
            levelUpSkill(skillId);
            openSkillModal(skillId); // refresh
        });
    }

    modal.classList.add('active');
}
