# AI Product Discovery Platform
.DEFAULT_GOAL := help
SHELL := /bin/bash
VENV := apps/api/.venv
PY := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: install-api install-web ## Install all dependencies

install-api: ## Create the API virtualenv and install Python deps
	python3 -m venv $(VENV)
	$(PIP) install --quiet --upgrade pip
	$(PIP) install --quiet -r apps/api/requirements.txt

install-web: ## Install web dependencies
	cd apps/web && npm install

db-up: ## Start Postgres + pgvector
	docker compose up -d db
	@until docker compose exec -T db pg_isready -U discovery -d discovery >/dev/null 2>&1; \
	  do echo "waiting for postgres..."; sleep 1; done
	@echo "postgres ready"

db-down: ## Stop Postgres
	docker compose down

db-reset: ## Drop and recreate all tables, then reseed
	$(PY) -m app.cli reset --seed

migrate: ## Create tables from the SQLAlchemy metadata
	cd apps/api && ../../$(PY) -m app.cli migrate

seed: ## Load the sample Medicaid cost-transparency discovery project
	cd apps/api && ../../$(PY) -m app.cli seed

api: ## Run the FastAPI backend (http://localhost:8000)
	cd apps/api && ../../$(VENV)/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

web: ## Run the Next.js frontend (http://localhost:3000)
	cd apps/web && npm run dev

dev: ## Run database, API and web together
	$(MAKE) db-up
	$(MAKE) migrate
	@trap 'kill 0' EXIT; $(MAKE) api & $(MAKE) web & wait

test: test-api test-web ## Run all tests

test-api: ## Run the backend test suite
	cd apps/api && ../../$(VENV)/bin/pytest -q

test-web: ## Typecheck and build the frontend
	cd apps/web && npm run typecheck && npm run build

lint: ## Lint backend and frontend
	cd apps/api && ../../$(VENV)/bin/ruff check app tests
	cd apps/web && npm run lint

.PHONY: help install install-api install-web db-up db-down db-reset migrate seed api web dev test test-api test-web lint
