import { BONUS_STATS, BONUS_STAT_KEYS, PROFILE_PICTURES, USERNAME_CHANGE_COST } from '../config.js';
import {
    getForgeLevel, getPlayerLevel, getPlayerXP, getXPToNextLevel,
    getProfilePicture, setProfilePicture, getProfileEmoji,
    getGold, addGold, getLevelReward, getDiamonds, spendDiamonds,
} from '../state.js';
import { apiFetch } from '../api.js';
import { createElement, formatNumber } from './helpers.js';
import { startDiscordLink, linkGoogle, getCurrentUser } from '../auth.js';
import { t, getLocale, setLocale, LANGUAGES } from '../i18n/i18n.js';
import { gameEvents, EVENTS } from '../events.js';

// Lazy import to break circular dependency with forge-ui
let _getCachedStats = null;
export function _setCachedStatsGetter(fn) { _getCachedStats = fn; }

/** Initialize profile tab switching (call once) */
let profileTabsInitialized = false;
function initProfileTabs() {
    if (profileTabsInitialized) return;
    profileTabsInitialized = true;

    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.profileTab;
            // Update tab buttons
            document.querySelectorAll('.profile-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.profileTab === targetTab);
                t.setAttribute('aria-selected', t.dataset.profileTab === targetTab);
            });
            // Update tab content
            document.querySelectorAll('.profile-tab-content').forEach(c => {
                c.classList.toggle('active', c.id === `profile-tab-${targetTab}`);
            });
            // Render settings content when switching to it
            if (targetTab === 'settings') {
                renderSettingsContent();
            }
        });
    });
}

export function showProfileModal(user, onLogout) {
    initProfileTabs();
    // Reset to Profile tab
    document.querySelectorAll('.profile-tab').forEach(t => {
        const isProfile = t.dataset.profileTab === 'profile';
        t.classList.toggle('active', isProfile);
        t.setAttribute('aria-selected', isProfile);
    });
    document.querySelectorAll('.profile-tab-content').forEach(c => {
        c.classList.toggle('active', c.id === 'profile-tab-profile');
    });
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

    // Clickable avatar — opens avatar picker modal
    const avatarWrapper = createElement('div', 'profile-avatar-wrapper');
    const avatarDisplay = createElement('div', 'profile-avatar-display profile-avatar-clickable', avatarEmoji);
    avatarDisplay.title = t('profile.changeAvatar');
    avatarDisplay.addEventListener('click', () => {
        showAvatarPickerModal(avatarDisplay);
    });
    avatarWrapper.appendChild(avatarDisplay);
    profileHeader.appendChild(avatarWrapper);

    const levelBadge = createElement('div', 'profile-level-badge', `${t('header.lv')} ${getPlayerLevel()}`);
    profileHeader.appendChild(levelBadge);

    // Username under avatar with pencil edit icon
    if (currentUser) {
        const nameRow = createElement('div', 'profile-username-row');
        nameRow.appendChild(createElement('span', 'profile-username-display', currentUser.username || 'Unknown'));

        const editBtn = createElement('button', 'profile-edit-name-btn', '\u270F\uFE0F');
        editBtn.title = t('profile.changeUsernameCost', { cost: formatNumber(USERNAME_CHANGE_COST) });
        editBtn.addEventListener('click', () => {
            showUsernameChangeUI(info, currentUser);
        });
        nameRow.appendChild(editBtn);
        profileHeader.appendChild(nameRow);
    }

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
        xpLabel.textContent = t('profile.maxLevel');
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

    // --- Stats section ---
    const statsSection = createElement('div', 'profile-section');
    statsSection.appendChild(createElement('div', 'profile-section-title', t('profile.stats')));

    const statsGrid = createElement('div', 'profile-stats-grid');

    const powerCard = createElement('div', 'profile-stat-card');
    powerCard.append(
        createElement('span', 'profile-stat-icon', '\uD83D\uDD25'),
        createElement('div', 'profile-stat-value', formatNumber(cachedStats.power)),
        createElement('div', 'profile-stat-label', t('profile.power'))
    );

    const healthCard = createElement('div', 'profile-stat-card');
    healthCard.append(
        createElement('span', 'profile-stat-icon', '\u2764\uFE0F'),
        createElement('div', 'profile-stat-value', formatNumber(cachedStats.health)),
        createElement('div', 'profile-stat-label', t('profile.health'))
    );

    const damageCard = createElement('div', 'profile-stat-card');
    damageCard.append(
        createElement('span', 'profile-stat-icon', '\u2694\uFE0F'),
        createElement('div', 'profile-stat-value', formatNumber(cachedStats.damage)),
        createElement('div', 'profile-stat-label', t('profile.damage'))
    );

    const forgeLvlCard = createElement('div', 'profile-stat-card');
    forgeLvlCard.append(
        createElement('span', 'profile-stat-icon', '\u2692\uFE0F'),
        createElement('div', 'profile-stat-value', String(getForgeLevel())),
        createElement('div', 'profile-stat-label', t('profile.forgeLevel'))
    );

    statsGrid.append(powerCard, healthCard, damageCard, forgeLvlCard);
    statsSection.appendChild(statsGrid);
    info.appendChild(statsSection);

    // --- Bonus stats section ---
    const bonuses = cachedStats.bonuses || {};
    const hasAnyBonus = BONUS_STAT_KEYS.some(key => bonuses[key] > 0);
    if (hasAnyBonus) {
        const bonusSection = createElement('div', 'profile-section');
        bonusSection.appendChild(createElement('div', 'profile-section-title', t('profile.bonuses')));

        const bonusList = createElement('div', 'profile-bonus-list');
        BONUS_STAT_KEYS.forEach(key => {
            if (bonuses[key] <= 0) return;
            const cfg = BONUS_STATS[key];
            bonusList.appendChild(createElement('span', 'profile-bonus-tag', `${cfg.icon} ${t('stats.' + key)}: ${bonuses[key]}${cfg.unit}`));
        });
        bonusSection.appendChild(bonusList);
        info.appendChild(bonusSection);
    }

    // --- Logout button ---
    if (currentLogout) {
        const logoutBtn = createElement('button', 'profile-logout-btn', t('profile.logout'));
        logoutBtn.addEventListener('click', () => {
            document.getElementById('profile-modal').classList.remove('active');
            currentLogout();
        });
        info.appendChild(logoutBtn);
    }
}

// --- Avatar Picker Modal ---
function showAvatarPickerModal(avatarDisplayEl) {
    // Remove existing modal if any
    document.querySelector('.avatar-picker-overlay')?.remove();

    const overlay = createElement('div', 'avatar-picker-overlay');
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    const modal = createElement('div', 'avatar-picker-modal');

    const title = createElement('div', 'avatar-picker-title', t('profile.chooseAvatar'));
    modal.appendChild(title);

    const closeBtn = createElement('button', 'modal-close-btn', '\u2715');
    closeBtn.addEventListener('click', () => overlay.remove());
    modal.appendChild(closeBtn);

    const grid = createElement('div', 'avatar-picker-grid');
    const currentPicId = getProfilePicture();

    PROFILE_PICTURES.forEach(pic => {
        const option = createElement('button', 'profile-avatar-option', pic.emoji);
        option.title = pic.label;
        option.dataset.id = pic.id;
        if (pic.id === currentPicId) {
            option.classList.add('profile-avatar-selected');
        }
        option.addEventListener('click', () => {
            setProfilePicture(pic.id);
            avatarDisplayEl.textContent = pic.emoji;
            // Update selection visually
            grid.querySelectorAll('.profile-avatar-option').forEach(el => {
                el.classList.remove('profile-avatar-selected');
            });
            option.classList.add('profile-avatar-selected');
            overlay.remove();
        });
        grid.appendChild(option);
    });

    modal.appendChild(grid);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function showUsernameChangeUI(container, currentUser) {
    // Check diamonds
    if (getDiamonds() < USERNAME_CHANGE_COST) {
        const existingError = container.querySelector('.profile-rename-error-msg');
        if (existingError) existingError.remove();
        const error = createElement('div', 'profile-rename-error-msg', t('profile.notEnoughDiamonds', { cost: formatNumber(USERNAME_CHANGE_COST) }));
        container.insertBefore(error, container.querySelector('.profile-header-section'));
        setTimeout(() => error.remove(), 3000);
        return;
    }

    // Check if already showing
    if (container.querySelector('.profile-rename-overlay')) return;

    const overlay = createElement('div', 'profile-rename-overlay');

    overlay.appendChild(createElement('div', 'profile-rename-title', t('profile.changeUsername')));
    overlay.appendChild(createElement('div', 'profile-rename-cost', `Cost: \uD83D\uDC8E ${formatNumber(USERNAME_CHANGE_COST)}`));

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

    const cancelBtn = createElement('button', 'btn profile-rename-cancel', t('profile.cancel'));
    cancelBtn.addEventListener('click', () => overlay.remove());

    const confirmBtn = createElement('button', 'btn profile-rename-confirm', t('profile.confirm'));
    confirmBtn.addEventListener('click', async () => {
        const newName = input.value.trim();
        if (newName.length < 3 || newName.length > 30) {
            errorEl.textContent = t('profile.usernameLengthError');
            return;
        }
        if (newName === currentUser.username) {
            errorEl.textContent = t('profile.sameUsername');
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
                confirmBtn.textContent = t('profile.confirm');
                return;
            }

            // Success: deduct diamonds and update UI
            spendDiamonds(USERNAME_CHANGE_COST);
            currentUser.username = newName;
            showProfileModal._user = currentUser;
            overlay.remove();
            renderProfileContent();
        } catch (err) {
            errorEl.textContent = t('auth.networkError');
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

// ─── Settings Tab ──────────────────────────────────────────────

function renderSettingsContent() {
    const container = document.getElementById('settings-info');
    if (!container) return;
    container.textContent = '';

    // Close button
    const closeBtn = createElement('button', 'modal-close-btn', '\u2715');
    closeBtn.addEventListener('click', () => {
        document.getElementById('profile-modal').classList.remove('active');
    });
    container.appendChild(closeBtn);

    // --- Theme section ---
    const themeSection = createElement('div', 'settings-section');
    themeSection.appendChild(createElement('div', 'settings-section-title', t('settings.appearance')));

    const themeRow = createElement('div', 'settings-row');

    const label = createElement('div', 'settings-row-label');
    label.appendChild(createElement('div', 'settings-row-title', t('settings.theme')));
    themeRow.appendChild(label);

    const toggle = createElement('div', 'theme-toggle');
    const currentTheme = getCurrentTheme();

    const darkBtn = createElement('button', `theme-toggle-option${currentTheme === 'dark' ? ' active' : ''}`, t('settings.dark'));
    const lightBtn = createElement('button', `theme-toggle-option${currentTheme === 'light' ? ' active' : ''}`, t('settings.light'));

    darkBtn.addEventListener('click', () => {
        applyTheme('dark');
        saveThemePreference('dark');
        darkBtn.classList.add('active');
        lightBtn.classList.remove('active');
    });

    lightBtn.addEventListener('click', () => {
        applyTheme('light');
        saveThemePreference('light');
        lightBtn.classList.add('active');
        darkBtn.classList.remove('active');
    });

    toggle.append(darkBtn, lightBtn);
    themeRow.appendChild(toggle);
    themeSection.appendChild(themeRow);

    // --- Language section (inside theme/appearance section) ---
    const langRow = createElement('div', 'settings-row');
    const langLabel = createElement('div', 'settings-row-label');
    langLabel.appendChild(createElement('div', 'settings-row-title', t('settings.language')));
    langRow.appendChild(langLabel);

    const langToggle = createElement('div', 'lang-toggle');
    const currentLang = getLocale();

    LANGUAGES.forEach(lang => {
        const btn = createElement('button', `lang-toggle-option${currentLang === lang.code ? ' active' : ''}`, lang.label);
        btn.dataset.lang = lang.code;
        btn.addEventListener('click', async () => {
            await setLocale(lang.code);
            saveLocalePreference(lang.code);
            // Re-render settings to update active state
            renderSettingsContent();
        });
        langToggle.appendChild(btn);
    });

    langRow.appendChild(langToggle);
    themeSection.appendChild(langRow);

    container.appendChild(themeSection);

    // --- Account linking section ---
    const currentUser = getCurrentUser();
    if (currentUser) {
        const linkSection = createElement('div', 'settings-section');
        linkSection.appendChild(createElement('div', 'settings-section-title', t('settings.linkedAccounts')));

        const linkButtons = createElement('div', 'profile-link-buttons');

        if (!currentUser.hasDiscord) {
            const discordBtn = createElement('button', 'profile-link-btn profile-link-discord');
            discordBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg> ${t('settings.linkDiscord')}`;
            discordBtn.addEventListener('click', () => startDiscordLink());
            linkButtons.appendChild(discordBtn);
        } else {
            const discordLinked = createElement('div', 'profile-link-status profile-link-discord-linked');
            discordLinked.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg> ${t('settings.discordLinked')}`;
            linkButtons.appendChild(discordLinked);
        }

        if (!currentUser.hasGoogle) {
            const googleBtn = createElement('button', 'profile-link-btn profile-link-google');
            googleBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> ${t('settings.linkGoogle')}`;
            googleBtn.addEventListener('click', async () => {
                googleBtn.disabled = true;
                const result = await linkGoogle();
                if (result.ok) {
                    renderSettingsContent();
                } else {
                    googleBtn.disabled = false;
                }
            });
            linkButtons.appendChild(googleBtn);
        } else {
            const googleLinked = createElement('div', 'profile-link-status profile-link-google-linked');
            googleLinked.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> ${t('settings.googleLinked')}`;
            linkButtons.appendChild(googleLinked);
        }

        linkSection.appendChild(linkButtons);
        container.appendChild(linkSection);
    }
}

// ─── Theme Helpers ─────────────────────────────────────────────

export function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
}

export function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

async function saveLocalePreference(locale) {
    // Save to localStorage for guests
    localStorage.setItem('forgemaster_locale', locale);
    // Update user settings object
    const user = getCurrentUser();
    if (user) {
        if (!user.settings) user.settings = {};
        user.settings.locale = locale;
    }
    // Persist to server
    try {
        await apiFetch('/api/auth/settings', {
            method: 'PUT',
            body: { settings: { locale } },
        });
    } catch {
        // Silently fail — locale is already applied locally
    }
}

async function saveThemePreference(theme) {
    // Update user object locally
    const user = getCurrentUser();
    if (user) {
        if (!user.settings) user.settings = {};
        user.settings.theme = theme;
    }

    // Persist to server
    try {
        await apiFetch('/api/auth/settings', {
            method: 'PUT',
            body: { settings: { theme } },
        });
    } catch {
        // Silently fail — theme is already applied locally
    }
}
