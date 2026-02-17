FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy the shared package (workspace dependency)
COPY packages/shared/ packages/shared/

# Copy the staking indexer package
COPY apps/staking-indexer/ apps/staking-indexer/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @bankr-wallet/staking-indexer

WORKDIR /app/apps/staking-indexer

EXPOSE 42070

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD curl -f http://localhost:42070/ready || exit 1

CMD ["pnpm", "start"]
