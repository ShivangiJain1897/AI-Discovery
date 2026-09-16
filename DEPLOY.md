# Deployment

The platform is two deployable units plus a database:

| Unit | What it needs |
|---|---|
| `apps/api` | Python 3.11, Postgres 16 + pgvector, outbound HTTPS |
| `apps/web` | Node 20, the API's public URL at build time |
| Database | Postgres 16 with `vector` and `pg_trgm` |

---

## Configuration

Everything is environment variables — see `.env.example` for the full list.
The minimum for a real deployment:

```bash
APP_ENV=production
SECRET_KEY=<generate a strong random value>
DATABASE_URL=postgresql+psycopg://user:password@host:5432/discovery

ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-5
TAVILY_API_KEY=tvly-...

WEB_BASE_URL=https://discovery.example.com     # CORS origin
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

For a workspace- or organization-scoped Anthropic key, also set
`ANTHROPIC_WORKSPACE_ID`.

### Provider selection

| Variable | Options |
|---|---|
| `LLM_PROVIDER` | `anthropic`, `mock` |
| `SEARCH_PROVIDER` | `tavily`, `brave`, `mock` |
| `EMBEDDING_PROVIDER` | `voyage`, `mock` |
| `STORAGE_PROVIDER` | `local`, `s3` |

Each falls back to `mock` when its credential is absent rather than failing to
boot. In production, check `/health` after deploying to confirm the providers
you intended are actually live — a silent fallback in production would produce
"Not established" everywhere, which is safe but not what you wanted.

---

## Database

```bash
psql "$DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS vector'
psql "$DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm'
cd apps/api && python -m app.cli migrate
```

`migrate` creates tables from the SQLAlchemy metadata. It is additive and safe
to re-run. For a schema that has drifted, introduce Alembic — the metadata is
already structured for it.

`EMBEDDING_DIMENSION` must match your embedding provider's output size, and
changing it after data exists requires rewriting the `evidence.embedding`
column.

### Backups

Evidence is the product. Back up the whole database; the artifacts,
findings and citations are all reconstructable from it, but the evidence
library is not reconstructable from anything else once the sources have moved.

---

## API

```bash
cd apps/api
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Behind a reverse proxy, allow long request timeouts on `/projects/*/research/run`
and the other generation endpoints — they return a job immediately, but the
background task runs in-process.

### Background jobs

Jobs are persisted as rows and executed as FastAPI background tasks. That is
correct for a single-process deployment and survives restarts as *records* —
but a job interrupted mid-run stays `running` and will not resume.

For multiple workers or long deep-research runs, run a dedicated worker:
`Job` rows are already the queue contract, so moving to Celery or RQ means
changing how a job is *picked up*, not how it is recorded.

---

## Web

```bash
cd apps/web
NEXT_PUBLIC_API_BASE_URL=https://api.example.com npm run build
npm run start   # or deploy the build output to any Next.js host
```

`NEXT_PUBLIC_API_BASE_URL` is inlined at build time, so a change requires a
rebuild.

---

## Docker Compose

`docker-compose.yml` ships the database only. For a full containerized
deployment, add services for the two apps:

```yaml
  api:
    build: ./apps/api
    env_file: .env
    depends_on: { db: { condition: service_healthy } }
    ports: ["8000:8000"]
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

  web:
    build: ./apps/web
    environment:
      NEXT_PUBLIC_API_BASE_URL: http://api:8000
    depends_on: [api]
    ports: ["3000:3000"]
```

---

## Security and governance

Configured through environment variables:

| Variable | Effect |
|---|---|
| `PHI_DETECTION_ENABLED` | Scan text for identifiers before any model call |
| `PHI_ON_DETECT` | `block`, `redact` or `warn` |
| `AUDIT_LOG_ENABLED` | Record actions against projects |
| `DATA_RETENTION_DAYS` | Retention policy for the workspace |

For healthcare deployments, set `PHI_ON_DETECT=block` or `redact` rather than
the default `warn`, and confirm your model provider's data handling terms
before sending any member-related content.

**These controls reduce risk. They do not constitute HIPAA compliance, and
nothing in this codebase should be read as claiming otherwise.** A compliant
deployment additionally needs a BAA with every processor, encryption at rest,
network isolation, access control, and a documented risk assessment.

---

## Health and monitoring

`GET /health` reports database connectivity, pgvector availability, which
providers are live versus fallen back, prompt library size and safety
configuration. It is safe to use as a readiness probe: it returns `degraded`
rather than failing when the database is unreachable.
