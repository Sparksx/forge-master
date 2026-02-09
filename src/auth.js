/**
 * Auth UI — login/register screen management.
 */

import { setTokens, clearTokens, apiFetch, getStoredRefreshToken, setAuthLostCallback } from './api.js';

let currentUser = null;
let onAuthSuccess = null; // callback(user) when user logs in

export function setAuthSuccessCallback(cb) {
    onAuthSuccess = cb;
}

export function getCurrentUser() {
    return currentUser;
}

export function initAuth() {
    const authScreen = document.getElementById('auth-screen');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');

    // Toggle between login/register
    showRegisterBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    });

    showLoginBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    // Login submit
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
                errorEl.textContent = data.error || data.errors?.[0]?.msg || 'Login failed';
                return;
            }

            setTokens(data.accessToken, data.refreshToken);
            currentUser = data.user;
            hideAuthScreen();
            if (onAuthSuccess) onAuthSuccess(currentUser);
        } catch (err) {
            errorEl.textContent = 'Network error';
        }
    });

    // Register submit
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
                errorEl.textContent = data.error || data.errors?.[0]?.msg || 'Registration failed';
                return;
            }

            setTokens(data.accessToken, data.refreshToken);
            currentUser = data.user;
            hideAuthScreen();
            if (onAuthSuccess) onAuthSuccess(currentUser);
        } catch (err) {
            errorEl.textContent = 'Network error';
        }
    });

    // Logout
    logoutBtn?.addEventListener('click', async () => {
        try {
            await apiFetch('/api/auth/logout', { method: 'POST', body: {} });
        } catch { /* ignore */ }
        currentUser = null;
        clearTokens();
        showAuthScreen();
    });

    // When auth is lost (token refresh failed)
    setAuthLostCallback(() => {
        currentUser = null;
        showAuthScreen();
    });

    // Try to restore session from stored refresh token
    return tryRestoreSession();
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
            clearTokens();
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

        clearTokens();
        showAuthScreen();
        return null;
    } catch {
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
