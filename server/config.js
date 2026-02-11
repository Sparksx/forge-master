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
