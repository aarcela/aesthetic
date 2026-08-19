# syntax=docker/dockerfile:1
# NestJS API image for container hosts like Render. Build context is the repo root.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
RUN pnpm install --frozen-lockfile

COPY packages/shared/src ./packages/shared/src
COPY apps/api/src ./apps/api/src
COPY scripts/point-shared-to-dist.mjs ./scripts/point-shared-to-dist.mjs

RUN pnpm --filter @aesthetic/shared build \
  && node scripts/point-shared-to-dist.mjs \
  && pnpm --filter @aesthetic/api build \
  && pnpm --filter @aesthetic/api deploy --prod --legacy /out

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN useradd --system --uid 1001 nest
COPY --from=build --chown=nest:nest /out ./
USER nest
EXPOSE 8080
CMD ["node", "dist/main.js"]
