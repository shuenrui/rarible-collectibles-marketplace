FROM --platform=linux/amd64 node:20-alpine AS base

# ── deps stage ──────────────────────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── builder stage ────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
RUN npm install -g pnpm@9
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# prisma generate only reads schema.prisma — no real DB connection needed.
# next build for dynamic routes (lot, search, collection) does not pre-render
# at build time, so no real DB connection needed during build either.
ENV DATABASE_URL="postgresql://build:build@localhost/build"
ENV DIRECT_URL="postgresql://build:build@localhost/build"
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_PRIVY_APP_ID="cmpw34ogf001b0cjrfo5u2qxc"

RUN pnpm prisma generate && pnpm next build

# ── runner stage ─────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next && chown nextjs:nodejs .next && \
    mkdir -p .checkpoints && chown nextjs:nodejs .checkpoints

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
