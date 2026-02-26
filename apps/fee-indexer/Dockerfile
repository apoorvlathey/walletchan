FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy the fee indexer package
COPY apps/fee-indexer/ apps/fee-indexer/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @bankr-wallet/fee-indexer

WORKDIR /app/apps/fee-indexer

EXPOSE 42071

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD curl -f http://localhost:42071/ready || exit 1

CMD ["pnpm", "start"]
