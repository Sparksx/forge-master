import 'dotenv/config';

export const PORT = process.env.PORT || 3000;
export const NODE_ENV = process.env.NODE_ENV || 'development';

export const JWT_SECRET = process.env.JWT_SECRET || (NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET env var is required in production'); })() : 'dev-jwt-secret-change-in-production');
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (NODE_ENV === 'production' ? (() => { throw new Error('JWT_REFRESH_SECRET env var is required in production'); })() : 'dev-jwt-secret-change-in-production');
export const JWT_ACCESS_EXPIRY = '15m';
export const JWT_REFRESH_EXPIRY = '30d';

export const DATABASE_URL = process.env.DATABASE_URL;

export const CORS_ORIGIN = process.env.CORS_ORIGIN || (NODE_ENV === 'production' ? 'https://web-production-aeea.up.railway.app' : '*');

// OAuth — Discord
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
export const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
export const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || '';

// OAuth — Google
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

// Stripe
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Gold packs available for purchase. Gold is the game's single currency and is
// deliberately scarce — the shop is the sanctioned way to acquire it in bulk
// (it buys forge instant-upgrades and clan founding, never gear directly, so it
// stays out of pay-to-win territory; see CLAUDE.md / REDESIGN.md). Value per
// dollar improves with the tier. `bonus` is extra gold layered on top of `gold`.
export const GOLD_PACKS = [
    { id: 'welcome', gold: 1500,  bonus: 0,     priceCents: 99,   label: 'Welcome Pouch', oneTime: true, tag: 'one-time' },
    { id: 'pouch',   gold: 1000,  bonus: 0,     priceCents: 199,  label: 'Pouch of Gold' },
    { id: 'sack',    gold: 2750,  bonus: 250,   priceCents: 499,  label: 'Sack of Gold' },
    { id: 'chest',   gold: 6000,  bonus: 1000,  priceCents: 999,  label: 'Chest of Gold', tag: 'popular' },
    { id: 'vault',   gold: 13000, bonus: 3000,  priceCents: 1999, label: 'Vault of Gold' },
    { id: 'hoard',   gold: 35000, bonus: 10000, priceCents: 4999, label: "Dragon's Hoard", tag: 'best-value' },
];
