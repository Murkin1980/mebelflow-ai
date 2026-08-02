FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json tsconfig.runtime.json ./
RUN npm ci
COPY packages ./packages
RUN npm run build:runtime

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY apps/api/server.mjs ./apps/api/server.mjs
USER node
EXPOSE 8080
CMD ["node", "apps/api/server.mjs"]
