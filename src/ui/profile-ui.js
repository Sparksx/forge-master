import { BONUS_STATS, BONUS_STAT_KEYS } from '../config.js';
import { getForgeLevel } from '../state.js';
import { createElement, formatNumber } from './helpers.js';

// Lazy import to break circular dependency with forge-ui
let _getCachedStats = null;
export function _setCachedStatsGetter(fn) { _getCachedStats = fn; }

export function showProfileModal(user, onLogout) {
    renderProfileContent(user, onLogout);
    document.getElementById('profile-modal').classList.add('active');
}

export function renderProfileContent(user, onLogout) {
    if (user) showProfileModal._user = user;
    if (onLogout) showProfileModal._onLogout = onLogout;
    const currentUser = user || showProfileModal._user;
    const currentLogout = onLogout || showProfileModal._onLogout;

    const info = document.getElementById('profile-info');
    if (!info) return;
    info.textContent = '';

    const cachedStats = _getCachedStats ? _getCachedStats() : { health: 0, damage: 0, bonuses: {}, power: 0 };

    // Close button
    const closeBtn = createElement('button', 'modal-close-btn', '\u2715');
    closeBtn.addEventListener('click', () => {
        document.getElementById('profile-modal').classList.remove('active');
    });
    info.appendChild(closeBtn);

    // Player info section
    if (currentUser) {
        const infoSection = createElement('div', 'profile-section');
        infoSection.appendChild(createElement('div', 'profile-section-title', 'Account'));

        const nameRow = createElement('div', 'profile-info-row');
        nameRow.append(
            createElement('span', 'profile-info-label', 'Username'),
            createElement('span', 'profile-info-value', currentUser.username || 'Unknown')
        );
        infoSection.appendChild(nameRow);

        if (currentUser.email) {
            const emailRow = createElement('div', 'profile-info-row');
            emailRow.append(
                createElement('span', 'profile-info-label', 'Email'),
                createElement('span', 'profile-info-value', currentUser.email)
            );
            infoSection.appendChild(emailRow);
        }

        info.appendChild(infoSection);
    }

    // Stats section
    const statsSection = createElement('div', 'profile-section');
    statsSection.appendChild(createElement('div', 'profile-section-title', 'Stats'));

    const statsGrid = createElement('div', 'profile-stats-grid');

    const powerCard = createElement('div', 'profile-stat-card');
    powerCard.append(
        createElement('span', 'profile-stat-icon', '\uD83D\uDD25'),
        createElement('div', 'profile-stat-value', formatNumber(cachedStats.power)),
        createElement('div', 'profile-stat-label', 'Power')
    );

    const healthCard = createElement('div', 'profile-stat-card');
    healthCard.append(
        createElement('span', 'profile-stat-icon', '\u2764\uFE0F'),
        createElement('div', 'profile-stat-value', formatNumber(cachedStats.health)),
        createElement('div', 'profile-stat-label', 'Health')
    );

    const damageCard = createElement('div', 'profile-stat-card');
    damageCard.append(
        createElement('span', 'profile-stat-icon', '\u2694\uFE0F'),
        createElement('div', 'profile-stat-value', formatNumber(cachedStats.damage)),
        createElement('div', 'profile-stat-label', 'Damage')
    );

    const forgeLvlCard = createElement('div', 'profile-stat-card');
    forgeLvlCard.append(
        createElement('span', 'profile-stat-icon', '\u2692\uFE0F'),
        createElement('div', 'profile-stat-value', String(getForgeLevel())),
        createElement('div', 'profile-stat-label', 'Forge Level')
    );

    statsGrid.append(powerCard, healthCard, damageCard, forgeLvlCard);
    statsSection.appendChild(statsGrid);
    info.appendChild(statsSection);

    // Bonus stats section
    const bonuses = cachedStats.bonuses || {};
    const hasAnyBonus = BONUS_STAT_KEYS.some(key => bonuses[key] > 0);
    if (hasAnyBonus) {
        const bonusSection = createElement('div', 'profile-section');
        bonusSection.appendChild(createElement('div', 'profile-section-title', 'Bonuses'));

        const bonusList = createElement('div', 'profile-bonus-list');
        BONUS_STAT_KEYS.forEach(key => {
            if (bonuses[key] <= 0) return;
            const cfg = BONUS_STATS[key];
            bonusList.appendChild(createElement('span', 'profile-bonus-tag', `${cfg.icon} ${cfg.label}: ${bonuses[key]}${cfg.unit}`));
        });
        bonusSection.appendChild(bonusList);
        info.appendChild(bonusSection);
    }

    // Logout button
    if (currentLogout) {
        const logoutBtn = createElement('button', 'profile-logout-btn', 'Logout');
        logoutBtn.addEventListener('click', () => {
            document.getElementById('profile-modal').classList.remove('active');
            currentLogout();
        });
        info.appendChild(logoutBtn);
    }
}
