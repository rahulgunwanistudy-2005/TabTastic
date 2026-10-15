# TabTastic: runner (Fastify + Playwright Chromium) serving the built web UI and demo store.
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY runner/package.json runner/
COPY web/package.json web/
RUN npm ci

# Chromium plus its system libraries, matching the installed Playwright version.
RUN npx playwright install --with-deps chromium

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=10000 \
    DATA_DIR=/app/data

EXPOSE 10000
CMD ["npm", "start"]
