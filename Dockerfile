# Single-stage Docker image for fly.io / Render / any container host.
FROM node:20-alpine

WORKDIR /app

# Install deps separately from app code for layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=optional

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/server.js"]
