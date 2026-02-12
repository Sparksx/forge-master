import { getCombatProgress, getEquippedSkills } from '../state.js';
import { getPlayerCombatState, getAllMonsters, getCurrentMonsterIndex } from '../combat.js';
import { getWaveLabel, getMaxWaveCount, SUB_WAVE_COUNT } from '../monsters.js';
import { createElement, formatNumber } from './helpers.js';
import { getSkillById, getSkillCooldown, getSkillTier } from '../skills-config.js';
import { canActivateSkill, activateSkill, getCooldownRemaining, getSkillLevel, isEffectActive } from '../skills.js';

let renderedMonsterCount = 0;

export function renderMonsters(data) {
    if (!data) return;
    const { monsters, focusIndex } = data;
    const container = document.getElementById('monsters-side');
    if (!container) return;

    container.textContent = '';
    renderedMonsterCount = monsters.length;

    monsters.forEach((m, i) => {
        const row = createElement('div', `monster-row${i === focusIndex ? ' monster-focused' : ''}${m.currentHP <= 0 ? ' monster-dead' : ''}`);
        row.dataset.index = i;

        const emoji = createElement('div', 'monster-row-emoji', m.emoji);
        const info = createElement('div', 'monster-row-info');

        const name = createElement('div', 'monster-row-name', m.name);
        name.style.color = m.color;

        const hpContainer = createElement('div', 'hp-bar-container');
        const hpBar = createElement('div', 'hp-bar hp-bar-monster');
        hpBar.id = `monster-hp-bar-${i}`;
        const hpText = createElement('span', 'hp-text');
        hpText.id = `monster-hp-text-${i}`;
        hpContainer.append(hpBar, hpText);

        const dmgContainer = createElement('div', 'damage-numbers damage-numbers-monster');
        dmgContainer.id = `damage-numbers-monster-${i}`;

        info.append(name, hpContainer);
        row.append(emoji, info, dmgContainer);
        container.appendChild(row);
    });

    updateAllMonstersHP(monsters, focusIndex);
}

export function updateMonsterFocus(data) {
    if (!data) return;
    const { focusIndex, monsters } = data;
    const container = document.getElementById('monsters-side');
    if (!container) return;

    container.querySelectorAll('.monster-row').forEach((row, i) => {
        row.classList.toggle('monster-focused', i === focusIndex);
        row.classList.toggle('monster-dead', monsters[i].currentHP <= 0);
    });
}

export function updateCombatUI() {
    const player = getPlayerCombatState();
    const monsters = getAllMonsters();
    if (!player || monsters.length === 0) return;

    const playerHPBar = document.getElementById('player-hp-bar');
    const playerHPText = document.getElementById('player-hp-text');
    if (playerHPBar && playerHPText) {
        const playerHPPct = Math.max(0, (player.currentHP / player.maxHP) * 100);
        playerHPBar.style.width = `${playerHPPct}%`;
        playerHPBar.className = `hp-bar hp-bar-player ${getHPColorClass(playerHPPct)}`;
        playerHPText.textContent = `${formatNumber(Math.ceil(player.currentHP))} / ${formatNumber(player.maxHP)}`;
    }

    updateAllMonstersHP(monsters, getCurrentMonsterIndex());
}

function updateAllMonstersHP(monsters, focusIndex) {
    monsters.forEach((m, i) => {
        const bar = document.getElementById(`monster-hp-bar-${i}`);
        const text = document.getElementById(`monster-hp-text-${i}`);
        if (!bar || !text) return;

        const pct = Math.max(0, (m.currentHP / m.maxHP) * 100);
        bar.style.width = `${pct}%`;
        bar.className = `hp-bar hp-bar-monster ${getHPColorClass(pct)}`;
        text.textContent = `${formatNumber(Math.max(0, Math.ceil(m.currentHP)))} / ${formatNumber(m.maxHP)}`;

        const row = bar.closest('.monster-row');
        if (row) {
            row.classList.toggle('monster-dead', m.currentHP <= 0);
            row.classList.toggle('monster-focused', i === focusIndex && m.currentHP > 0);
        }
    });
}

function getHPColorClass(pct) {
    if (pct > 60) return 'hp-high';
    if (pct > 30) return 'hp-mid';
    return 'hp-low';
}

export function updateCombatInfo(data) {
    if (!data) return;
    renderMonsters(data);
    updateWaveDisplay();

    // Trigger entrance animations
    const playerEl = document.getElementById('combatant-player');
    const monstersEl = document.getElementById('monsters-side');
    if (playerEl) {
        playerEl.classList.remove('combat-enter');
        void playerEl.offsetWidth; // force reflow
        playerEl.classList.add('combat-enter');
    }
    if (monstersEl) {
        monstersEl.classList.remove('combat-enter');
        void monstersEl.offsetWidth;
        monstersEl.classList.add('combat-enter');
    }
}

export function updateWaveDisplay() {
    const { currentWave, currentSubWave } = getCombatProgress();
    const waveLabel = document.getElementById('wave-label');
    if (waveLabel) waveLabel.textContent = `Wave ${getWaveLabel(currentWave, currentSubWave)}`;

    const progressFill = document.getElementById('wave-progress-fill');
    if (progressFill) {
        const total = getMaxWaveCount() * SUB_WAVE_COUNT;
        const current = (currentWave - 1) * SUB_WAVE_COUNT + currentSubWave;
        progressFill.style.width = `${(current / total) * 100}%`;
    }
}

export function showDamageNumber(damage, type, isCrit, monsterIndex) {
    let container;

    if (type === 'monster') {
        const idx = monsterIndex !== undefined ? monsterIndex : getCurrentMonsterIndex();
        container = document.getElementById(`damage-numbers-monster-${idx}`);
    } else {
        container = document.getElementById('damage-numbers-player');
    }
    if (!container) return;

    if (container.children.length >= 4) {
        container.firstChild?.remove();
    }

    const dmgEl = createElement('div', `damage-number damage-${type}${isCrit ? ' damage-crit' : ''}`,
        `${type === 'heal' ? '+' : '-'}${formatNumber(damage)}`);

    const offsetX = (Math.random() - 0.5) * 30;
    dmgEl.style.setProperty('--offset-x', `${offsetX}px`);
    const offsetY = Math.random() * -12;
    dmgEl.style.setProperty('--offset-y', `${offsetY}px`);

    container.appendChild(dmgEl);
    dmgEl.addEventListener('animationend', () => dmgEl.remove());
}

export function showCombatResult(text, type) {
    const el = document.getElementById('combat-result');
    if (!el) return;

    el.textContent = text;
    el.className = `combat-result combat-result-${type} combat-result-show`;

    setTimeout(() => { el.classList.remove('combat-result-show'); }, 1200);
}

export function showDeathAnimation() {
    const playerEl = document.getElementById('combatant-player');
    if (!playerEl) return;
    playerEl.classList.add('death-animation');
    setTimeout(() => {
        playerEl.classList.remove('death-animation');
    }, 1500);
}

export function triggerAttackAnimation(side) {
    if (side === 'player') {
        const el = document.getElementById('combatant-player');
        if (!el) return;
        el.classList.add('attacking');
        setTimeout(() => el.classList.remove('attacking'), 300);
    } else {
        const idx = getCurrentMonsterIndex();
        const row = document.querySelector(`.monster-row[data-index="${idx}"]`);
        if (!row) return;
        row.classList.add('attacking');
        setTimeout(() => row.classList.remove('attacking'), 300);
    }
}

export function triggerHitAnimation(side) {
    if (side === 'player') {
        const el = document.getElementById('combatant-player');
        if (!el) return;
        el.classList.add('hit');
        setTimeout(() => el.classList.remove('hit'), 300);
    } else {
        const idx = getCurrentMonsterIndex();
        const row = document.querySelector(`.monster-row[data-index="${idx}"]`);
        if (!row) return;
        row.classList.add('hit');
        setTimeout(() => row.classList.remove('hit'), 300);
    }
}

export function triggerMonsterHitAnimation(monsterIndex) {
    const row = document.querySelector(`.monster-row[data-index="${monsterIndex}"]`);
    if (!row) return;
    row.classList.add('attacking');
    setTimeout(() => row.classList.remove('attacking'), 300);
}

// ── Skill HUD (shown during combat) ────────────────────────

export function renderSkillHUD() {
    const container = document.getElementById('skill-hud');
    if (!container) return;
    container.textContent = '';

    const equipped = getEquippedSkills();
    if (equipped.length === 0) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');

    equipped.forEach(skillId => {
        const skill = getSkillById(skillId);
        if (!skill) return;

        const tier = getSkillTier(skill);
        const btn = createElement('div', 'skill-hud-btn');
        btn.dataset.skillId = skillId;
        btn.style.borderColor = tier.color;

        const icon = createElement('span', 'skill-hud-icon', skill.icon);
        btn.appendChild(icon);

        if (skill.type === 'active') {
            const cdRemaining = getCooldownRemaining(skillId);
            const isActive = isEffectActive(skillId);

            if (isActive) {
                btn.classList.add('skill-hud-active');
            } else if (cdRemaining > 0) {
                btn.classList.add('skill-hud-cooldown');
                const cdText = createElement('span', 'skill-hud-cd', `${Math.ceil(cdRemaining / 1000)}s`);
                btn.appendChild(cdText);
                // Cooldown overlay
                const level = getSkillLevel(skillId);
                const totalCd = getSkillCooldown(skill, level);
                const pct = (cdRemaining / (totalCd * 1000)) * 100;
                const overlay = createElement('div', 'skill-hud-cd-overlay');
                overlay.style.height = `${pct}%`;
                btn.appendChild(overlay);
            } else {
                btn.classList.add('skill-hud-ready');
            }

            btn.addEventListener('click', () => {
                if (canActivateSkill(skillId)) {
                    activateSkill(skillId);
                }
            });
        } else {
            // Passive: just show a subtle indicator
            btn.classList.add('skill-hud-passive');
            const tag = createElement('span', 'skill-hud-passive-tag', 'P');
            btn.appendChild(tag);
        }

        container.appendChild(btn);
    });
}

export function updateSkillHUD() {
    const container = document.getElementById('skill-hud');
    if (!container) return;

    const equipped = getEquippedSkills();
    if (equipped.length === 0) return;

    // Update cooldowns/active states in-place
    equipped.forEach(skillId => {
        const skill = getSkillById(skillId);
        if (!skill || skill.type !== 'active') return;

        const btn = container.querySelector(`[data-skill-id="${skillId}"]`);
        if (!btn) return;

        const cdRemaining = getCooldownRemaining(skillId);
        const isActive = isEffectActive(skillId);

        btn.classList.toggle('skill-hud-active', isActive);
        btn.classList.toggle('skill-hud-cooldown', !isActive && cdRemaining > 0);
        btn.classList.toggle('skill-hud-ready', !isActive && cdRemaining <= 0);

        // Update cooldown text
        let cdText = btn.querySelector('.skill-hud-cd');
        let overlay = btn.querySelector('.skill-hud-cd-overlay');

        if (cdRemaining > 0 && !isActive) {
            if (!cdText) {
                cdText = createElement('span', 'skill-hud-cd');
                btn.appendChild(cdText);
            }
            cdText.textContent = `${Math.ceil(cdRemaining / 1000)}s`;

            if (!overlay) {
                overlay = createElement('div', 'skill-hud-cd-overlay');
                btn.appendChild(overlay);
            }
            const level = getSkillLevel(skillId);
            const totalCd = getSkillCooldown(skill, level);
            const pct = (cdRemaining / (totalCd * 1000)) * 100;
            overlay.style.height = `${pct}%`;
        } else {
            if (cdText) cdText.remove();
            if (overlay) overlay.remove();
        }
    });
}
