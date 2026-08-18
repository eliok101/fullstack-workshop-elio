SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help setup validate up down logs ps backend-test frontend-test test backend-quality clean e2e-test

help: ## Show commands
	@awk 'BEGIN {FS = ":.*## "; printf "\nUsage: make <target>\n\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Verify tools and create .env
	@./scripts/setup.sh

validate: ## Validate the standalone exported starter
	@python3 scripts/validate-starter.py .

up: ## Build and start the starter stack
	@docker compose up --build -d
	@docker compose ps

down: ## Stop the starter stack
	@docker compose down

logs: ## Follow logs
	@docker compose logs -f --tail=150

ps: ## Show service state
	@docker compose ps

backend-test: ## Run FastAPI starter tests
	@docker compose run --rm backend pytest

frontend-test: ## Run Nuxt starter type checks and the Vitest suite
	@docker compose run --rm frontend npm run typecheck
	@docker compose run --rm frontend npm test

test: backend-test frontend-test ## Run starter verification

backend-quality: ## Run backend lint, format check, type check, and tests with coverage (the shared gate)
	@echo "--- ruff check ---"
	@docker compose run --rm backend ruff check .
	@echo "--- ruff format --check ---"
	@docker compose run --rm backend ruff format --check .
	@echo "--- mypy ---"
	@docker compose run --rm backend python -m mypy app
	@echo "--- pytest (branch coverage, fail_under enforced via pyproject.toml) ---"
	@docker compose run --rm backend python -m pytest --cov=app --cov-branch --cov-report=term-missing

clean: ## Remove containers and the disposable database volume
	@docker compose down -v --remove-orphans

e2e-test: ## Build and health-gate the isolated acceptance stack (compose.test.yaml). NOTE: does not run Playwright yet - that's Module 15; this only proves the production-image stack builds, migrates, and reaches health.
	@docker compose -f compose.test.yaml up -d --build --wait --wait-timeout 120
	@docker compose -f compose.test.yaml ps
	@docker compose -f compose.test.yaml down -v --remove-orphans
