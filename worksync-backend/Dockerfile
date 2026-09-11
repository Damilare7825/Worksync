FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate
RUN npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
COPY src ./src
COPY API_DOCUMENTATION.md README.md ./
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
