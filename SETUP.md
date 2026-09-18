# Local setup

## Requirements

| | |
|---|---|
| Python | 3.11+ |
| Node | 20+ |
| Postgres | 16 with the `vector` extension |
| Docker | optional — only for the bundled Postgres |

No API keys are required to run the platform. See
[Running without credentials](#running-without-credentials).

---

## 1. Configure

```bash
cp .env.example .env
```

The defaults work against the bundled Postgres. To enable live research, set:

```bash
ANTHROPIC_API_KEY=sk-ant-...
TAVILY_API_KEY=tvly-...        # or BRAVE_API_KEY with SEARCH_PROVIDER=brave
```

Every provider is selected by name in `.env`, so switching models, search
engines, embeddings or object storage never requires a code change.

## 2. Install

```bash
make install
```

Creates `apps/api/.venv` with the Python dependencies, and installs the web
dependencies.

## 3. Database

### With Docker

```bash
make db-up      # pgvector/pgvector:pg16 on :5432, extensions created on boot
```

### Without Docker

Install Postgres 16 and the pgvector extension, then create the database:

```bash
# Debian / Ubuntu
sudo apt-get install -y postgresql-16 postgresql-16-pgvector

sudo -u postgres createuser --createdb discovery
sudo -u postgres createdb -O discovery discovery
sudo -u postgres psql -d discovery -c 'CREATE EXTENSION IF NOT EXISTS vector'
```

```bash
# macOS
brew install postgresql@16 pgvector
createdb discovery
psql -d discovery -c 'CREATE EXTENSION IF NOT EXISTS vector'
```

Point `DATABASE_URL` at it:

```
DATABASE_URL=postgresql+psycopg://discovery@localhost:5432/discovery
```

## 4. Schema and sample data

```bash
make migrate    # create tables and extensions
make seed       # load the sample Medicaid cost-transparency project
```

The seeded project is complete — context, research plan, 10 sources, 16
evidence items, 8 themes, 6 findings, 3 insights, an analysis, 3 opportunities
and 4 use cases — so the whole product is explorable immediately.

> Every seeded evidence item is explicitly marked as illustrative and carries a
> limitation saying so. The organizations named are real; the specific
> statements were **not** retrieved from them, and `quantities` is empty
> throughout. Seeding invented statistics attributed to real bodies would be
> exactly the failure this product exists to prevent. Run real research to get
> real evidence.

## 5. Run

```bash
make dev        # database + API + web together
```

| | |
|---|---|
| Web | <http://localhost:3000> |
| API | <http://localhost:8000> |
| API docs | <http://localhost:8000/docs> |
| Health | <http://localhost:8000/health> |

Or run them separately:

```bash
make api
make web
```

---

## Running without credentials

The platform runs with no API keys. Each provider falls back automatically:

| Provider | Without a key |
|---|---|
| Model | Deterministic provider. Composes stored data; reports "Not established" wherever reasoning would be required. |
| Search | Returns results drawn from the source registry, each explicitly labelled a placeholder. |
| Embeddings | Hashed bag-of-words vectors — exercises the vector path, not semantic. |

`/health` and the Settings screen both report which providers are actually in
use, so "why does everything say Not established?" always has a visible answer.

The fallback never invents content. A PRD generated without a model has its
evidence and problem sections populated from real stored data, and the other 21
sections marked **Unknown**.

---

## Tests

```bash
make test         # backend + frontend
make test-api     # 117 backend tests
make test-web     # typecheck + production build
make lint
```

The backend suite needs a running Postgres with pgvector — the same one the app
uses. It creates its own tables and rolls back between tests.

---

## Common problems

**`connection refused` on port 5432** — Postgres is not running.
`make db-up`, or start your local server.

**`extension "vector" is not available`** — pgvector is not installed for this
Postgres. Install `postgresql-16-pgvector` (or the Homebrew `pgvector`), then
re-run `make migrate`.

**Everything says "Not established"** — no model credential. Check `/health`;
set `ANTHROPIC_API_KEY` and restart the API.

**Research returns placeholder sources** — no search credential. Set
`TAVILY_API_KEY` (or `BRAVE_API_KEY` with `SEARCH_PROVIDER=brave`).

**`Cannot reach the API`** in the web UI — the API is not running, or
`NEXT_PUBLIC_API_BASE_URL` points somewhere else. It is read at build time for
production builds.

**Port already in use** — change `API_PORT`, or run
`cd apps/web && npx next dev -p 3001`.

---

## Reset

```bash
make db-reset     # drop, recreate and reseed
```
