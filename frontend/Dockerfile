# syntax=docker/dockerfile:1.7
FROM node:22.16.0 AS dependencies
RUN npm install -g npm@11.18.0
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM dependencies AS build
COPY . .
# `npm ci` in the `dependencies` stage above already ran the `postinstall`
# (`nuxt prepare`) hook, but at that point in the layer graph only
# package.json/package-lock.json existed - no nuxt.config.ts, no app/, no
# real project to scan. `nuxt prepare` needs to run again now that COPY . .
# has brought the real source in, or `nuxt build`'s own typecheck step
# (typescript.typeCheck: true in nuxt.config.ts) fails immediately: every
# Nuxt auto-import (useAuthStore, useProjectsApi, the shared #shared/types/
# api.ts types, ...) is unresolved, because the .nuxt/ type declarations
# that make them globally available were never generated against this
# project's actual code.
RUN npm run postinstall
RUN npm run build

FROM node:22.16.0 AS production
ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000
WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=build --chown=app:app /workspace/.output ./
USER app
EXPOSE 3000
CMD ["node", "server/index.mjs"]
