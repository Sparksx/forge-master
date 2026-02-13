import { gameEvents, EVENTS } from '../events.js';
import en from './locales/en.js';

const locales = { en };
let currentLocale = 'en';
let translations = en;

const loaders = {
    fr: () => import('./locales/fr.js'),
    de: () => import('./locales/de.js'),
    es: () => import('./locales/es.js'),
};

/**
 * Translate a key with optional interpolation.
 * @param {string} key - Dot-notation key, e.g. 'combat.victory'
 * @param {Object} [params] - Interpolation params, e.g. { amount: 42 }
 * @returns {string}
 */
export function t(key, params) {
    const value = key.split('.').reduce((obj, k) => obj?.[k], translations);
    if (value == null) return key;
    if (!params) return value;
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? '');
}

/**
 * Change the active locale. Loads the locale file on demand if needed.
 * Emits LOCALE_CHANGED so all UI can re-render.
 */
export async function setLocale(locale) {
    if (locale === currentLocale) return;
    if (!locales[locale] && loaders[locale]) {
        const mod = await loaders[locale]();
        locales[locale] = mod.default;
    }
    if (!locales[locale]) return;
    currentLocale = locale;
    translations = locales[locale];
    updateStaticTranslations();
    gameEvents.emit(EVENTS.LOCALE_CHANGED, locale);
}

export function getLocale() {
    return currentLocale;
}

export const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'es', label: 'Español' },
];

/**
 * Update all elements with data-i18n / data-i18n-placeholder attributes.
 */
function updateStaticTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
    });
}

/**
 * Initialise the locale from saved preference.
 * Call once at app start, before UI renders.
 */
export async function initLocale(savedLocale) {
    if (savedLocale && savedLocale !== 'en') {
        await setLocale(savedLocale);
    } else {
        updateStaticTranslations();
    }
}
