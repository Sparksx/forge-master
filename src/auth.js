/**
 * Auth UI — login/register/guest/OAuth screen management.
 */

import { setTokens, clearTokens, apiFetch, getStoredRefreshToken, setAuthLostCallback } from './api.js';
import { t } from './i18n/i18n.js';

let currentUser = null;
let onAuthSuccess = null; // callback(user) when user logs in

export function setAuthSuccessCallback(cb) {
    onAuthSuccess = cb;
}

export function getCurrentUser() {
    return currentUser;
}

export async function performLogout() {
    try {
        const token = getStoredRefreshToken();
        await apiFetch('/api/auth/logout', { method: 'POST', body: { refreshToken: token } });
    } catch { /* ignore */ }
    currentUser = null;
    clearTokens();
    showAuthScreen();
}

// ─── OAuth config (injected from env at build time via Vite) ────
const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const DISCORD_REDIRECT_URI = import.meta.env.VITE_DISCORD_REDIRECT_URI || `${window.location.origin}/auth/discord/callback`;

export function initAuth() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authOneclick = document.getElementById('auth-oneclick');

    // ── Panel switching ───────────────────────────────────────────
    function showPanel(panel) {
        [loginForm, registerForm, authOneclick].forEach(el => {
            if (el) el.classList.add('hidden');
        });
        if (panel) panel.classList.remove('hidden');
    }

    // Show login form
    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        showPanel(loginForm);
    });

    document.getElementById('show-login-from-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        showPanel(loginForm);
    });

    // Show register form
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        showPanel(registerForm);
    });

    // Back to one-click view
    document.getElementById('show-oneclick')?.addEventListener('click', (e) => {
        e.preventDefault();
        showPanel(authOneclick);
    });

    document.getElementById('show-oneclick-from-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        showPanel(authOneclick);
    });

    // ── Guest play ────────────────────────────────────────────────
    document.getElementById('guest-play-btn')?.addEventListener('click', async () => {
        const errorEl = document.getElementById('guest-error');
        errorEl.textContent = '';

        const btn = document.getElementById('guest-play-btn');
        btn.disabled = true;
        btn.textContent = t('auth.creatingAccount');

        try {
            const res = await fetch('/api/auth/guest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();

            if (!res.ok) {
                errorEl.textContent = data.error || t('auth.failedGuest');
                btn.disabled = false;
                btn.textContent = t('auth.playNow');
                return;
            }

            setTokens(data.accessToken, data.refreshToken);
            currentUser = data.user;
            hideAuthScreen();
            if (onAuthSuccess) onAuthSuccess(currentUser);
        } catch (err) {
            errorEl.textContent = t('auth.networkError');
            btn.disabled = false;
            btn.textContent = t('auth.playNow');
        }
    });

    // ── Discord OAuth ─────────────────────────────────────────────
    document.getElementById('discord-login-btn')?.addEventListener('click', () => {
        if (!DISCORD_CLIENT_ID) {
            const errorEl = document.getElementById('guest-error');
            errorEl.textContent = t('auth.discordNotConfigured');
            return;
        }
        const params = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            redirect_uri: DISCORD_REDIRECT_URI,
            response_type: 'code',
            scope: 'identify email',
        });
        window.location.href = `https://discord.com/api/oauth2/authorize?${params}`;
    });

    // ── Google Sign-In ────────────────────────────────────────────
    // Uses Google Identity Services (GSI) One Tap / button
    if (GOOGLE_CLIENT_ID) {
        loadGoogleGSI();
    }

    document.getElementById('google-login-btn')?.addEventListener('click', () => {
        if (!GOOGLE_CLIENT_ID) {
            const errorEl = document.getElementById('guest-error');
            errorEl.textContent = t('auth.googleNotConfigured');
            return;
        }
        // If GSI is loaded, trigger the prompt; otherwise redirect with standard OAuth
        if (window.google?.accounts?.id) {
            window.google.accounts.id.prompt();
        } else {
            // Fallback: redirect to Google OAuth (authorization code flow)
            const params = new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                redirect_uri: `${window.location.origin}/auth/google/callback`,
                response_type: 'code',
                scope: 'openid email profile',
            });
            window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
        }
    });

    // ── Login submit ──────────────────────────────────────────────
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const login = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        errorEl.textContent = '';

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, password }),
            });
            const data = await res.json();

            if (!res.ok) {
                errorEl.textContent = data.error || data.errors?.[0]?.msg || t('auth.loginFailed');
                return;
            }

            setTokens(data.accessToken, data.refreshToken);
            currentUser = data.user;
            hideAuthScreen();
            if (onAuthSuccess) onAuthSuccess(currentUser);
        } catch (err) {
            errorEl.textContent = t('auth.networkError');
        }
    });

    // ── Register submit ───────────────────────────────────────────
    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const errorEl = document.getElementById('register-error');
        errorEl.textContent = '';

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }),
            });
            const data = await res.json();

            if (!res.ok) {
                errorEl.textContent = data.error || data.errors?.[0]?.msg || t('auth.registrationFailed');
                return;
            }

            setTokens(data.accessToken, data.refreshToken);
            currentUser = data.user;
            hideAuthScreen();
            if (onAuthSuccess) onAuthSuccess(currentUser);
        } catch (err) {
            errorEl.textContent = t('auth.networkError');
        }
    });

    // When auth is lost (token refresh failed)
    setAuthLostCallback(() => {
        currentUser = null;
        showAuthScreen();
    });

    // Handle OAuth callback if we're on a callback URL
    const callbackResult = handleOAuthCallback();
    if (callbackResult) {
        return callbackResult;
    }

    // Try to restore session from stored refresh token
    return tryRestoreSession();
}

/** Load Google Identity Services script */
function loadGoogleGSI() {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
        window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredential,
            auto_select: true,
        });
    };
    document.head.appendChild(script);
}

/** Handle Google GSI credential response */
async function handleGoogleCredential(response) {
    const errorEl = document.getElementById('guest-error');
    if (errorEl) errorEl.textContent = '';

    try {
        const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential }),
        });
        const data = await res.json();

        if (!res.ok) {
            if (errorEl) errorEl.textContent = data.error || t('auth.loginFailed');
            return;
        }

        setTokens(data.accessToken, data.refreshToken);
        currentUser = data.user;
        hideAuthScreen();
        if (onAuthSuccess) onAuthSuccess(currentUser);
    } catch (err) {
        if (errorEl) errorEl.textContent = t('auth.networkError');
    }
}

/** Handle OAuth redirect callbacks (Discord code in URL) */
function handleOAuthCallback() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const path = url.pathname;

    if (code && path.includes('/auth/discord/callback')) {
        // Clean URL
        window.history.replaceState({}, '', '/');
        if (state === 'link') {
            return handleDiscordLinkCallback(code);
        }
        return handleDiscordCallback(code);
    }

    return null;
}

async function handleDiscordCallback(code) {
    const errorEl = document.getElementById('guest-error');

    try {
        const res = await fetch('/api/auth/discord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        const data = await res.json();

        if (!res.ok) {
            if (errorEl) errorEl.textContent = data.error || t('auth.loginFailed');
            showAuthScreen();
            return null;
        }

        setTokens(data.accessToken, data.refreshToken);
        currentUser = data.user;
        hideAuthScreen();
        if (onAuthSuccess) onAuthSuccess(currentUser);
        return currentUser;
    } catch (err) {
        if (errorEl) errorEl.textContent = t('auth.networkError');
        showAuthScreen();
        return null;
    }
}

async function handleDiscordLinkCallback(code) {
    try {
        const res = await apiFetch('/api/auth/link-discord', {
            method: 'POST',
            body: { code },
        });
        const data = await res.json();

        if (!res.ok) {
            console.error('Discord link failed:', data.error);
            return null;
        }

        // Update current user with linked info
        if (currentUser) {
            currentUser.hasDiscord = true;
            currentUser.isGuest = false;
            if (data.user?.email) currentUser.email = data.user.email;
        }
        return currentUser;
    } catch (err) {
        console.error('Discord link error:', err);
        return null;
    }
}

/** Start Discord OAuth flow for account linking */
export function startDiscordLink() {
    if (!DISCORD_CLIENT_ID) return;
    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: DISCORD_REDIRECT_URI,
        response_type: 'code',
        scope: 'identify email',
        state: 'link',
    });
    window.location.href = `https://discord.com/api/oauth2/authorize?${params}`;
}

/** Link Google account to current user via GSI credential */
export async function linkGoogle() {
    if (!GOOGLE_CLIENT_ID) return { ok: false, error: t('auth.googleNotConfigured') };

    return new Promise((resolve) => {
        if (window.google?.accounts?.id) {
            // Re-initialize with a link-specific callback
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: async (response) => {
                    try {
                        const res = await apiFetch('/api/auth/link-google', {
                            method: 'POST',
                            body: { credential: response.credential },
                        });
                        const data = await res.json();
                        if (!res.ok) {
                            resolve({ ok: false, error: data.error || t('auth.loginFailed') });
                            return;
                        }
                        if (currentUser) {
                            currentUser.hasGoogle = true;
                            currentUser.isGuest = false;
                            if (data.user?.email) currentUser.email = data.user.email;
                        }
                        resolve({ ok: true });
                    } catch {
                        resolve({ ok: false, error: t('auth.networkError') });
                    }
                },
                auto_select: false,
            });
            window.google.accounts.id.prompt();
        } else {
            resolve({ ok: false, error: 'Google Sign-In not loaded' });
        }
    });
}

async function tryRestoreSession() {
    const storedRefresh = getStoredRefreshToken();
    if (!storedRefresh) {
        showAuthScreen();
        return null;
    }

    try {
        const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storedRefresh }),
        });

        if (!res.ok) {
            // Only clear tokens on definitive auth rejection (401/403).
            // Server errors (500) are transient — keep the token for next visit.
            if (res.status === 401 || res.status === 403) {
                clearTokens();
            }
            showAuthScreen();
            return null;
        }

        const data = await res.json();
        setTokens(data.accessToken, data.refreshToken);

        // Fetch user info
        const meRes = await apiFetch('/api/auth/me');
        if (meRes.ok) {
            const meData = await meRes.json();
            currentUser = meData.user;
            hideAuthScreen();
            return currentUser;
        }

        // /me failed but tokens may still be valid — don't clear them
        showAuthScreen();
        return null;
    } catch {
        // Network error — keep tokens intact for next attempt
        showAuthScreen();
        return null;
    }
}

function showAuthScreen() {
    const authScreen = document.getElementById('auth-screen');
    const gameContainer = document.getElementById('game-container');
    if (authScreen) authScreen.classList.remove('hidden');
    if (gameContainer) gameContainer.classList.add('hidden');
}

function hideAuthScreen() {
    const authScreen = document.getElementById('auth-screen');
    const gameContainer = document.getElementById('game-container');
    if (authScreen) authScreen.classList.add('hidden');
    if (gameContainer) gameContainer.classList.remove('hidden');
}
