FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy the tg-bot package
COPY apps/tg-bot/ apps/tg-bot/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @bankr-wallet/tg-bot

WORKDIR /app/apps/tg-bot

# Build TypeScript
RUN pnpm build

EXPOSE 3001

CMD ["node", "dist/index.js"]
