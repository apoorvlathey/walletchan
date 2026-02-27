FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy the drip-bot package
COPY apps/drip-bot/ apps/drip-bot/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @walletchan/drip-bot

WORKDIR /app/apps/drip-bot

CMD ["pnpm", "start"]
