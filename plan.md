# Architecture: Game Localization System

## Context

Forge Master is a vanilla JS game (no framework) with a custom EventEmitter-based state system, Vite build, and settings already persisted via `User.settings` (JSON in DB) + localStorage. Text is currently hardcoded across ~15 JS files and `index.html`. Some French text is already mixed in with English.

---

## Proposed Architecture

### Option A: Lightweight custom i18n module (Recommended)

Build a small `i18n` module (~100 lines) that integrates natively with the existing EventEmitter system. No external dependency.

### Option B: i18next library

Use the `i18next` library (framework-agnostic). Powerful but adds a dependency and abstractions that don't align with the project's vanilla approach.

**Recommendation: Option A** - the project avoids frameworks deliberately, the translation needs are straightforward (short UI strings, no complex pluralization rules, no ICU message format needed), and integrating with the custom EventEmitter is trivial with a custom module.

---

## File Structure

```
src/
  i18n/
    i18n.js              # Core i18n manager (singleton)
    locales/
      en.js              # English translations (default)
      fr.js              # French translations
      de.js              # German translations
      es.js              # Spanish translations
```

Using `.js` exports (not JSON) to stay consistent with the rest of the codebase and allow Vite tree-shaking. Each locale file exports a flat-ish nested object.

---

## Core API: `src/i18n/i18n.js`

```js
// Singleton i18n manager
import { gameEvents, EVENTS } from '../events.js';
import en from './locales/en.js';

const locales = { en };
let currentLocale = 'en';
let translations = en;

// Lazy-load other locales on demand
const loaders = {
  fr: () => import('./locales/fr.js'),
  de: () => import('./locales/de.js'),
  es: () => import('./locales/es.js'),
};

// Core translation function
export function t(key, params = {}) {
  // Resolve dot-notation: t('forge.upgrade.title')
  const value = key.split('.').reduce((obj, k) => obj?.[k], translations);
  if (value == null) return key; // Fallback: show key itself

  // Interpolation: t('combat.damage', { amount: 42 }) → "You dealt 42 damage"
  return value.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? '');
}

// Change locale (async, emits event for UI refresh)
export async function setLocale(locale) {
  if (locale === currentLocale) return;
  if (!locales[locale] && loaders[locale]) {
    const mod = await loaders[locale]();
    locales[locale] = mod.default;
  }
  currentLocale = locale;
  translations = locales[locale] || en;
  gameEvents.emit(EVENTS.LOCALE_CHANGED, locale);
}

export function getLocale() { return currentLocale; }
```

**Key design decisions:**
- **Lazy loading**: Only English is bundled upfront. FR/DE/ES are loaded on demand via dynamic `import()`, so they don't bloat the initial bundle.
- **Event-driven refresh**: `EVENTS.LOCALE_CHANGED` triggers all UI to re-render with new translations - no page refresh needed.
- **Interpolation**: Simple `{{var}}` syntax covers all current needs (damage numbers, player names, item names, etc.).
- **Fallback**: If a key is missing, the key string itself is shown (easy to spot untranslated strings during dev).

---

## Translation File Format

```js
// src/i18n/locales/en.js
export default {
  nav: {
    pvp: 'PvP',
    dungeon: 'Dungeon',
    home: 'Home',
    upgrade: 'Upgrade',
    shop: 'Shop',
  },
  auth: {
    title: 'Anvil Legends',
    subtitle: 'Jump in and start forging!',
    playNow: 'Play Now',
    login: 'Login',
    register: 'Register',
    guest: 'Play as Guest',
    // ...
  },
  forge: {
    empty: 'Empty',
    maxLevel: 'Max level reached!',
    upgrade: 'Upgrade Forge',
    // ...
  },
  combat: {
    victory: 'Victory!',
    defeated: 'Defeated',
    damage: '{{amount}} damage',
    wave: 'Wave {{current}}/{{total}}',
    // ...
  },
  tiers: {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
    mythic: 'Mythic',
    divine: 'Divine',
  },
  settings: {
    language: 'Language',
    theme: 'Theme',
    // ...
  },
  // ... other namespaces
};
```

Namespaces mirror the UI sections: `nav`, `auth`, `forge`, `combat`, `shop`, `pvp`, `profile`, `chat`, `settings`, `tiers`, `stats`.

---

## HTML Static Content: `data-i18n` Attributes

For text that lives in `index.html` (nav labels, auth screen, headings):

```html
<span data-i18n="nav.home">Home</span>
<button data-i18n="auth.playNow">Play Now</button>
<input data-i18n-placeholder="auth.emailPlaceholder" placeholder="Email">
```

A small DOM updater runs on `LOCALE_CHANGED`:

```js
function updateStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

gameEvents.on(EVENTS.LOCALE_CHANGED, updateStaticTranslations);
```

---

## Dynamic JS Content

In JS files, replace hardcoded strings with `t()` calls:

```js
// Before
el.textContent = 'Victory!';

// After
import { t } from '../i18n/i18n.js';
el.textContent = t('combat.victory');
```

For UI components that build DOM dynamically, they already listen to state events and rebuild. We add `LOCALE_CHANGED` as a trigger for re-render where needed:

```js
// In forge-ui.js
gameEvents.on(EVENTS.LOCALE_CHANGED, () => renderEquipmentSlots());
```

---

## Settings Integration

Add a language selector in the existing Settings tab (`profile-ui.js`):

```js
// Language dropdown in settings
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
];
```

**Persistence chain:**
1. User selects language → `setLocale('fr')` called
2. `setLocale` loads FR translations, emits `LOCALE_CHANGED`
3. All UI re-renders with French text
4. Setting saved to `User.settings.locale` via existing `/api/auth/settings` endpoint
5. On next login, locale is restored from `User.settings.locale`
6. For guests: stored in `localStorage` key `forgemaster_locale`

---

## Implementation Steps

### Step 1 - Core infrastructure
- Add `EVENTS.LOCALE_CHANGED` to event registry
- Create `src/i18n/i18n.js` with `t()`, `setLocale()`, `getLocale()`
- Create `src/i18n/locales/en.js` with all English strings extracted from the codebase

### Step 2 - Extract and replace strings
- Audit every UI file and `index.html` for hardcoded text
- Add `data-i18n` attributes to static HTML
- Replace JS `textContent`/`innerHTML` assignments with `t()` calls
- Hook `LOCALE_CHANGED` in each UI module to trigger re-render

### Step 3 - Translation files
- Create `fr.js`, `de.js`, `es.js` locale files (same structure as `en.js`)
- Translate all keys (can start with machine translation, refine later)

### Step 4 - Settings UI
- Add language dropdown to Settings tab in profile modal
- Wire to `setLocale()` + persist via `/api/auth/settings`
- Restore locale on app init from settings or localStorage

### Step 5 - Shared module translations
- Handle `config.js` constants (tier names, profile picture labels)
- Handle `shared/stats.js` labels (bonus stat names)
- These become functions: `getTierName(tier)` → `t('tiers.' + tier.toLowerCase())`

---

## What stays untranslated
- Player-generated content (chat messages, usernames)
- Item names if they're generated from data (or we translate the components)
- Backend error messages (keep English, translate on client side by error code)
- Admin/moderation panel (English-only for now)

---

## Bundle Impact
- `en.js`: ~2-3 KB (bundled)
- Each additional locale: ~2-3 KB (lazy-loaded on demand)
- `i18n.js` core: ~1 KB
- **Total upfront cost: ~3-4 KB** (negligible)
