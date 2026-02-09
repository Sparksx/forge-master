/**
 * API client for Forge Master server.
 * Handles authentication, game state persistence, and token management.
 */

const TOKEN_KEY = 'forgemaster_token';
const PLAYER_KEY = 'forgemaster_player';

let serverUrl = import.meta.env.VITE_SERVER_URL || '';

export function setServerUrl(url) {
  serverUrl = url;
}

// --- Token management ---

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredPlayer() {
  try {
    const data = localStorage.getItem(PLAYER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function saveAuth(token, player) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PLAYER_KEY);
}

export function isLoggedIn() {
  return !!getToken();
}

// --- HTTP helpers ---

async function apiRequest(path, options = {}) {
  if (!serverUrl) throw new Error('Server URL not configured');

  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${serverUrl}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

// --- Auth API ---

export async function register(username, password) {
  const data = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  saveAuth(data.token, data.player);
  return data;
}

export async function login(username, password) {
  const data = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  saveAuth(data.token, data.player);
  return data;
}

export async function fetchMe() {
  return apiRequest('/api/auth/me');
}

// --- Game state API ---

export async function loadGameFromServer() {
  return apiRequest('/api/game/state');
}

export async function saveGameToServer(state) {
  return apiRequest('/api/game/save', {
    method: 'POST',
    body: JSON.stringify(state),
  });
}

export async function fetchLeaderboard() {
  return apiRequest('/api/game/leaderboard');
}
