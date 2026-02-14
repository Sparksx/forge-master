// Player skin templates: loaded from the database via API, with hardcoded fallback.
//
// On startup, loadPlayerTemplatesFromAPI() is called to fetch the latest player
// skin definitions from the server. If the API is unavailable (offline/guest mode),
// the hardcoded fallback data is used instead.

// ── Hardcoded fallback data ──────────────────────────────────────
const FALLBACK_SPRITE_SHEET = {
    file: '/assets/players.png',
    width: 1536,
    height: 1024,
};

const FALLBACK_TEMPLATES = [
    { slug: 'knight',    name: 'Knight',    isDefault: true,  sprite: { x: 0,   y: 0,   w: 384, h: 512 } },
    { slug: 'mage',      name: 'Mage',      isDefault: false, sprite: { x: 384, y: 0,   w: 384, h: 512 } },
    { slug: 'ranger',    name: 'Ranger',    isDefault: false, sprite: { x: 768, y: 0,   w: 384, h: 512 } },
    { slug: 'paladin',   name: 'Paladin',   isDefault: false, sprite: { x: 1152, y: 0,  w: 384, h: 512 } },
    { slug: 'barbarian', name: 'Barbarian', isDefault: false, sprite: { x: 0,   y: 512, w: 384, h: 512 } },
    { slug: 'rogue',     name: 'Rogue',     isDefault: false, sprite: { x: 384, y: 512, w: 384, h: 512 } },
    { slug: 'cleric',    name: 'Cleric',    isDefault: false, sprite: { x: 768, y: 512, w: 384, h: 512 } },
    { slug: 'warlock',   name: 'Warlock',   isDefault: false, sprite: { x: 1152, y: 512, w: 384, h: 512 } },
];

// ── Mutable state ────────────────────────────────────────────────
let playerSpriteSheet = { ...FALLBACK_SPRITE_SHEET };
export let PLAYER_TEMPLATES = [...FALLBACK_TEMPLATES];
let selectedSkin = null; // slug of selected skin, null = use default

/**
 * Load player skin templates from the server API.
 * Replaces in-memory templates with DB data.
 * Falls back silently to hardcoded data on failure.
 */
export async function loadPlayerTemplatesFromAPI() {
    try {
        const res = await fetch('/api/players/templates');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.spriteSheet) {
            playerSpriteSheet = data.spriteSheet;
        }
        if (data.templates && data.templates.length > 0) {
            PLAYER_TEMPLATES = data.templates;
            console.log(`[Players] Loaded ${data.templates.length} player templates from database`);
        }
    } catch {
        console.log('[Players] Using fallback player templates (API unavailable)');
    }
}

/**
 * Set the active player skin by slug.
 * Pass null to revert to the default skin.
 */
export function setPlayerSkin(slug) {
    selectedSkin = slug;
}

/**
 * Get the currently active player template.
 */
export function getActivePlayerTemplate() {
    if (selectedSkin) {
        const match = PLAYER_TEMPLATES.find(t => t.slug === selectedSkin);
        if (match) return match;
    }
    return PLAYER_TEMPLATES.find(t => t.isDefault) || PLAYER_TEMPLATES[0] || null;
}

/**
 * Return inline CSS style for the active player sprite.
 * Used by combat-ui to render the player character.
 */
export function getPlayerSpriteStyle(slug) {
    const tpl = slug
        ? PLAYER_TEMPLATES.find(t => t.slug === slug) || getActivePlayerTemplate()
        : getActivePlayerTemplate();

    if (!tpl || !tpl.sprite) {
        // Absolute fallback: first sprite in the sheet
        return 'background-image:url(/assets/players.png);background-size:400% 200%;background-position:0% 0%;';
    }

    const sheet = playerSpriteSheet;
    const s = tpl.sprite;
    const sizeX = (sheet.width / s.w) * 100;
    const sizeY = (sheet.height / s.h) * 100;
    const posX = s.w < sheet.width ? (s.x / (sheet.width - s.w)) * 100 : 0;
    const posY = s.h < sheet.height ? (s.y / (sheet.height - s.h)) * 100 : 0;

    return `background-image:url(${sheet.file});background-size:${sizeX}% ${sizeY}%;background-position:${posX}% ${posY}%;`;
}
