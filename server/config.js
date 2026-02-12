import 'dotenv/config';

export const PORT = process.env.PORT || 3000;
export const NODE_ENV = process.env.NODE_ENV || 'development';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
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

// Diamond packs available for purchase
export const DIAMOND_PACKS = [
    { id: 'welcome',  diamonds: 100,  bonus: 0,   priceCents: 299,  label: 'Welcome Pack',  oneTime: true },
    { id: 'starter',  diamonds: 50,   bonus: 0,   priceCents: 499,  label: 'Starter' },
    { id: 'popular',  diamonds: 100,  bonus: 20,  priceCents: 999,  label: 'Popular' },
    { id: 'value',    diamonds: 200,  bonus: 60,  priceCents: 1999, label: 'Value' },
    { id: 'premium',  diamonds: 500,  bonus: 200, priceCents: 4999, label: 'Premium' },
    { id: 'ultimate', diamonds: 1000, bonus: 500, priceCents: 9999, label: 'Ultimate' },
];
