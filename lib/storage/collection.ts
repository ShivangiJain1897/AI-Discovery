/**
 * Storage abstraction — one interface, two backends.
 *
 *  - PRODUCTION: when DATABASE_URL is set, data lives in Postgres (one table per
 *    collection, each row a JSONB blob keyed by id). This is what makes the app
 *    deployable to a serverless host, where the filesystem is ephemeral.
 *  - LOCAL DEV: with no DATABASE_URL, data persists to `.data/<name>.json` and
 *    is cached in memory. Zero setup.
 *
 * Every store in the app (intake use cases, discovery sessions, prompt
 * overrides) goes through this, so switching to a real database is a config
 * change (set DATABASE_URL), not a code change.
 *
 * Items are plain objects with a string `id`. Simple by design.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export interface Doc {
  id: string;
}

export interface Collection<T extends Doc> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(item: T): Promise<void>;
  remove(id: string): Promise<void>;
}

const useDb = () => Boolean(process.env.DATABASE_URL);

const g = globalThis as unknown as { __collections?: Map<string, Collection<Doc>> };
const cache = g.__collections ?? new Map<string, Collection<Doc>>();
g.__collections = cache;

export function getCollection<T extends Doc>(name: string): Collection<T> {
  const existing = cache.get(name);
  if (existing) return existing as Collection<T>;
  const col = useDb() ? new PgCollection<T>(name) : new FileCollection<T>(name);
  cache.set(name, col as Collection<Doc>);
  return col;
}

/* --------------------------- File / memory backend --------------------------- */

class FileCollection<T extends Doc> implements Collection<T> {
  private items = new Map<string, T>();
  private loaded = false;
  private file: string;

  constructor(private name: string) {
    this.file = path.join(process.cwd(), ".data", `${name}.json`);
  }

  private async ensure(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await fs.readFile(this.file, "utf8");
      for (const it of JSON.parse(raw) as T[]) this.items.set(it.id, it);
    } catch {
      /* no file yet */
    }
  }

  private async persist(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify([...this.items.values()], null, 2), "utf8");
    } catch {
      /* best effort — keep working in memory */
    }
  }

  async list(): Promise<T[]> {
    await this.ensure();
    return [...this.items.values()];
  }
  async get(id: string): Promise<T | undefined> {
    await this.ensure();
    return this.items.get(id);
  }
  async put(item: T): Promise<void> {
    await this.ensure();
    this.items.set(item.id, item);
    await this.persist();
  }
  async remove(id: string): Promise<void> {
    await this.ensure();
    this.items.delete(id);
    await this.persist();
  }
}

/* ------------------------------ Postgres backend ----------------------------- */

// A single shared pool for the process.
const pg = globalThis as unknown as { __pgPool?: import("pg").Pool };

async function pool(): Promise<import("pg").Pool> {
  if (pg.__pgPool) return pg.__pgPool;
  const { Pool } = await import("pg");
  const needsSsl = /sslmode=require|neon\.tech|supabase\.co|render\.com/.test(
    process.env.DATABASE_URL || ""
  );
  pg.__pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 3,
  });
  return pg.__pgPool;
}

class PgCollection<T extends Doc> implements Collection<T> {
  private ready = false;
  private table: string;

  constructor(name: string) {
    // Whitelist table name to a safe identifier.
    this.table = "aid_" + name.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  }

  private async ensureTable(): Promise<void> {
    if (this.ready) return;
    const p = await pool();
    await p.query(
      `CREATE TABLE IF NOT EXISTS ${this.table} (
         id text PRIMARY KEY,
         data jsonb NOT NULL,
         updated_at bigint NOT NULL
       )`
    );
    this.ready = true;
  }

  async list(): Promise<T[]> {
    await this.ensureTable();
    const p = await pool();
    const res = await p.query(`SELECT data FROM ${this.table}`);
    return res.rows.map((r) => r.data as T);
  }
  async get(id: string): Promise<T | undefined> {
    await this.ensureTable();
    const p = await pool();
    const res = await p.query(`SELECT data FROM ${this.table} WHERE id = $1`, [id]);
    return res.rows[0]?.data as T | undefined;
  }
  async put(item: T): Promise<void> {
    await this.ensureTable();
    const p = await pool();
    await p.query(
      `INSERT INTO ${this.table} (id, data, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
      [item.id, JSON.stringify(item), Date.now()]
    );
  }
  async remove(id: string): Promise<void> {
    await this.ensureTable();
    const p = await pool();
    await p.query(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
  }
}

/** Which backend is active — for surfacing in the UI. */
export function storageMode(): "postgres" | "file" {
  return useDb() ? "postgres" : "file";
}
