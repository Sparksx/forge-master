# ── Stage 1: Install ALL dependencies + build ──────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (cached layer)
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install all dependencies (including devDeps for vite build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code and build frontend
COPY . .
RUN npm run build

# ── Stage 2: Production image (no devDeps) ─────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy server code and shared modules FIRST
COPY server ./server
COPY shared ./shared

# Copy generated Prisma client from builder AFTER (overwrites server/generated)
COPY --from=builder /app/server/generated ./server/generated

# Copy built frontend
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "server/index.js"]
