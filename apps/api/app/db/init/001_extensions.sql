-- Extensions required by the discovery platform.
-- Runs automatically on first boot of the Postgres container.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
