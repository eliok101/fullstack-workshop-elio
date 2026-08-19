# syntax=docker/dockerfile:1.7
# Browser image tag must match the @playwright/test version pinned in
# package.json (VERSION_MATRIX.md: "Package and browser image must match") -
# mismatched versions are a common, confusing source of flaky/broken runs
# since the installed browser binaries and the test runner's protocol
# expectations can drift apart.
FROM mcr.microsoft.com/playwright:v1.61.1-noble
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
CMD ["npx", "playwright", "test", "--project=chromium"]
