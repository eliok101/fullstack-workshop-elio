# syntax=docker/dockerfile:1.7
FROM node:22.16.0 AS dependencies
WORKDIR /workspace
COPY package.json ./
RUN npm install --no-audit --no-fund

FROM dependencies AS development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM dependencies AS build
COPY . .
RUN npm run build

FROM node:22.16.0 AS production
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000
WORKDIR /app
RUN addgroup -r app && adduser -r app -g app
COPY --from=build --chown=app:app /workspace/.output ./
USER app
EXPOSE 3000
CMD ["node", "server/index.mjs"]
