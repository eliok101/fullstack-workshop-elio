#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

for command_name in git docker; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Missing required command: $command_name" >&2
    exit 1
  }
done

docker compose version >/dev/null

if ! command -v make >/dev/null 2>&1; then
  echo "Warning: 'make' is not on PATH. Makefile targets (make up, make test, ...) will not run." >&2
  echo "  Windows/Git Bash: install GNU Make (e.g. 'choco install make' or via MSYS2/WSL) or run the underlying docker compose commands from the Makefile directly." >&2
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

printf 'git:     %s\n' "$(git --version)"
printf 'docker:  %s\n' "$(docker --version)"
printf 'compose: %s\n' "$(docker compose version)"
echo "Starter prerequisites are ready. Run: docker compose up --build"
