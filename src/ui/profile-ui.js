import { BONUS_STATS, BONUS_STAT_KEYS, PROFILE_PICTURES, USERNAME_CHANGE_COST } from '../config.js';
import {
    getForgeLevel, getPlayerLevel, getPlayerXP, getXPToNextLevel,
    getProfilePicture, setProfilePicture, getProfileEmoji,
    getGold, addGold, getLevelReward,
} from '../state.js';
import { apiFetch } from '../api.js';
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

    // --- Avatar & Level header ---
    const profileHeader = createElement('div', 'profile-header-section');
    const avatarEmoji = getProfileEmoji();
    const avatarDisplay = createElement('div', 'profile-avatar-display', avatarEmoji);
    profileHeader.appendChild(avatarDisplay);

    const levelBadge = createElement('div', 'profile-level-badge', `Lv. ${getPlayerLevel()}`);
    profileHeader.appendChild(levelBadge);

    info.appendChild(profileHeader);

    // --- XP Progress Bar ---
    const xpSection = createElement('div', 'profile-xp-section');

    const playerLevel = getPlayerLevel();
    const xpCurrent = getPlayerXP();
    const xpNeeded = getXPToNextLevel();
    const pct = xpNeeded > 0 ? Math.min(100, (xpCurrent / xpNeeded) * 100) : 100;

    const xpBarContainer = createElement('div', 'profile-xp-bar');
    const xpBarFill = createElement('div', 'profile-xp-fill');
    xpBarFill.style.width = `${pct}%`;
    xpBarContainer.appendChild(xpBarFill);
    xpSection.appendChild(xpBarContainer);

    const xpLabel = createElement('div', 'profile-xp-label');
    if (xpNeeded > 0) {
        xpLabel.textContent = `${formatNumber(xpCurrent)} / ${formatNumber(xpNeeded)} XP`;
    } else {
        xpLabel.textContent = 'Max Level!';
    }
    xpSection.appendChild(xpLabel);

    // Next reward preview
    if (playerLevel < 100) {
        const nextReward = getLevelReward(playerLevel + 1);
        const rewardLabel = createElement('div', 'profile-next-reward');
        const prefix = nextReward.isMilestone ? '\uD83C\uDF1F' : '\u2B50';
        rewardLabel.textContent = `${prefix} Next: Lv.${playerLevel + 1} \u2192 +${formatNumber(nextReward.gold)}g`;
        if (nextReward.isMilestone) rewardLabel.classList.add('profile-milestone-reward');
        xpSection.appendChild(rewardLabel);
    }

    info.appendChild(xpSection);

    // --- Account section with username change ---
    if (currentUser) {
        const infoSection = createElement('div', 'profile-section');
        infoSection.appendChild(createElement('div', 'profile-section-title', 'Account'));

        // Username row with change button
        const nameRow = createElement('div', 'profile-info-row');
        nameRow.appendChild(createElement('span', 'profile-info-label', 'Username'));
        const nameRight = createElement('div', 'profile-name-right');
        nameRight.appendChild(createElement('span', 'profile-info-value', currentUser.username || 'Unknown'));

        const changeNameBtn = createElement('button', 'profile-change-name-btn', `\u270F\uFE0F ${formatNumber(USERNAME_CHANGE_COST)}g`);
        changeNameBtn.title = `Change username (${formatNumber(USERNAME_CHANGE_COST)} gold)`;
        changeNameBtn.addEventListener('click', () => {
            showUsernameChangeUI(info, currentUser);
        });
        nameRight.appendChild(changeNameBtn);
        nameRow.appendChild(nameRight);
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

    // --- Avatar Picker ---
    const avatarSection = createElement('div', 'profile-section');
    avatarSection.appendChild(createElement('div', 'profile-section-title', 'Profile Picture'));

    const avatarGrid = createElement('div', 'profile-avatar-grid');
    const currentPicId = getProfilePicture();

    PROFILE_PICTURES.forEach(pic => {
        const avatarOption = createElement('button', 'profile-avatar-option', pic.emoji);
        avatarOption.title = pic.label;
        avatarOption.dataset.id = pic.id;
        if (pic.id === currentPicId) {
            avatarOption.classList.add('profile-avatar-selected');
        }
        avatarOption.addEventListener('click', () => {
            setProfilePicture(pic.id);
            // Update selection visually
            avatarGrid.querySelectorAll('.profile-avatar-option').forEach(el => {
                el.classList.remove('profile-avatar-selected');
            });
            avatarOption.classList.add('profile-avatar-selected');
            avatarDisplay.textContent = pic.emoji;
        });
        avatarGrid.appendChild(avatarOption);
    });

    avatarSection.appendChild(avatarGrid);
    info.appendChild(avatarSection);

    // --- Stats section ---
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

    // --- Bonus stats section ---
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

    // --- Logout button ---
    if (currentLogout) {
        const logoutBtn = createElement('button', 'profile-logout-btn', 'Logout');
        logoutBtn.addEventListener('click', () => {
            document.getElementById('profile-modal').classList.remove('active');
            currentLogout();
        });
        info.appendChild(logoutBtn);
    }
}

function showUsernameChangeUI(container, currentUser) {
    // Check gold
    if (getGold() < USERNAME_CHANGE_COST) {
        const existingError = container.querySelector('.profile-rename-error-msg');
        if (existingError) existingError.remove();
        const error = createElement('div', 'profile-rename-error-msg', `Not enough gold! Need ${formatNumber(USERNAME_CHANGE_COST)}g`);
        container.insertBefore(error, container.querySelector('.profile-header-section'));
        setTimeout(() => error.remove(), 3000);
        return;
    }

    // Check if already showing
    if (container.querySelector('.profile-rename-overlay')) return;

    const overlay = createElement('div', 'profile-rename-overlay');

    overlay.appendChild(createElement('div', 'profile-rename-title', 'Change Username'));
    overlay.appendChild(createElement('div', 'profile-rename-cost', `Cost: ${formatNumber(USERNAME_CHANGE_COST)}g`));

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'profile-rename-input';
    input.placeholder = 'New username (3-30 chars)';
    input.maxLength = 30;
    input.minLength = 3;
    input.value = currentUser.username;
    overlay.appendChild(input);

    const errorEl = createElement('div', 'profile-rename-error', '');
    overlay.appendChild(errorEl);

    const btnRow = createElement('div', 'profile-rename-buttons');

    const cancelBtn = createElement('button', 'btn profile-rename-cancel', 'Cancel');
    cancelBtn.addEventListener('click', () => overlay.remove());

    const confirmBtn = createElement('button', 'btn profile-rename-confirm', 'Confirm');
    confirmBtn.addEventListener('click', async () => {
        const newName = input.value.trim();
        if (newName.length < 3 || newName.length > 30) {
            errorEl.textContent = 'Username must be 3-30 characters';
            return;
        }
        if (newName === currentUser.username) {
            errorEl.textContent = 'Same as current username';
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.textContent = '...';

        try {
            const res = await apiFetch('/api/auth/change-username', {
                method: 'POST',
                body: { username: newName },
            });
            const data = await res.json();

            if (!res.ok) {
                errorEl.textContent = data.error || 'Failed to change username';
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirm';
                return;
            }

            // Success: deduct gold and update UI
            addGold(-USERNAME_CHANGE_COST);
            currentUser.username = newName;
            showProfileModal._user = currentUser;
            overlay.remove();
            renderProfileContent();
        } catch (err) {
            errorEl.textContent = 'Network error';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirm';
        }
    });

    btnRow.append(cancelBtn, confirmBtn);
    overlay.appendChild(btnRow);

    // Insert after close button
    const firstSection = container.querySelector('.profile-header-section');
    if (firstSection) {
        container.insertBefore(overlay, firstSection);
    } else {
        container.appendChild(overlay);
    }

    input.focus();
    input.select();
}
