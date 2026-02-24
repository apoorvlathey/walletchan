FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy workspace dependencies
COPY packages/wchan-swap/ packages/wchan-swap/

# Copy the arb-bot package
COPY apps/arb-bot/ apps/arb-bot/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @bankr-wallet/arb-bot

WORKDIR /app/apps/arb-bot

CMD ["pnpm", "start"]
