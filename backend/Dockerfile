# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 8000
CMD ["npm", "run", "dev"]

FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 8000
CMD ["node", "dist/src/index.js"]
