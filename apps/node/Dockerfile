FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tini

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/node ./apps/node

RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

RUN pnpm --filter @isc/apps/node build

ENV ISC_ADMIN_TOKEN=${ISC_ADMIN_TOKEN:-admin-token-change-me}
ENV ISC_ADMIN_PORT=9091
ENV ISC_PORT=9090
ENV ISC_SIMULATOR=false
ENV ISC_BOT_COUNT=5

EXPOSE 9090 9091

CMD ["tini", "--", "node", "dist/index.js"]