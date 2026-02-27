FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy shared packages
COPY packages/contract-addresses/ packages/contract-addresses/

# Copy the indexer package
COPY apps/wchan-vault-indexer/ apps/wchan-vault-indexer/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @walletchan/wchan-vault-indexer

WORKDIR /app/apps/wchan-vault-indexer

EXPOSE 42072

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD curl -f http://localhost:42072/ready || exit 1

CMD ["pnpm", "start"]
