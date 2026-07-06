# =============================================================================
# TaskForge API — multi-stage production image
# =============================================================================

# ---- deps: install the full workspace once -----------------------------------
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-utils/package.json packages/shared-utils/
COPY packages/shared-ui/package.json packages/shared-ui/
RUN npm ci --no-audit --no-fund

# ---- build: compile shared packages + backend --------------------------------
FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=@taskforge/shared-types \
 && npm run build --workspace=@taskforge/shared-utils \
 && npx prisma generate --schema apps/backend/prisma/schema.prisma \
 && npm run build --workspace=@taskforge/backend

# ---- runtime ------------------------------------------------------------------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo

RUN addgroup -S app && adduser -S app -G app

# Production node_modules only (keeps prisma engines generated above)
COPY --from=deps /repo/package.json /repo/package-lock.json ./
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=build /repo/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /repo/node_modules/@prisma ./node_modules/@prisma

COPY --from=build /repo/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /repo/packages/shared-types/package.json ./packages/shared-types/
COPY --from=build /repo/packages/shared-utils/dist ./packages/shared-utils/dist
COPY --from=build /repo/packages/shared-utils/package.json ./packages/shared-utils/
COPY --from=build /repo/apps/backend/dist ./apps/backend/dist
COPY --from=build /repo/apps/backend/package.json ./apps/backend/
COPY --from=build /repo/apps/backend/prisma ./apps/backend/prisma

USER app
EXPOSE 5000
WORKDIR /repo/apps/backend

# Apply migrations, then start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
