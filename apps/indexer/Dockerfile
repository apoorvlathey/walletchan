FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy the indexer package
COPY apps/indexer/ apps/indexer/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @bankr-wallet/indexer

WORKDIR /app/apps/indexer

EXPOSE 42069

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD curl -f http://localhost:42069/ready || exit 1

CMD ["pnpm", "start"]
