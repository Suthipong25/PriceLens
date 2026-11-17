import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgresJs, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.js";

export type PriceLensDb =
  | PgliteDatabase<typeof schema>
  | PostgresJsDatabase<typeof schema>;

export interface DatabaseClientOptions {
  /**
   * Standard PostgreSQL connection string (`postgresql://...`) or `"memory://"` for tests,
   * or a filesystem path for persistent embedded PostgreSQL 16 (PGlite).
   */
  connectionString?: string;
}

const MONOREPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

let sharedDb: PriceLensDb | null = null;

export function createDatabaseClient(options: DatabaseClientOptions = {}): {
  db: PriceLensDb;
  close: () => Promise<void>;
} {
  const url = options.connectionString ?? process.env.DATABASE_URL;
  const useExternalPostgres =
    url &&
    (url.startsWith("postgres://") || url.startsWith("postgresql://")) &&
    process.env.USE_PGLITE === "false";

  if (useExternalPostgres) {
    const queryClient = postgres(url, { max: 10, onnotice: () => {} });
    const db = drizzlePostgresJs(queryClient, { schema });
    return {
      db,
      close: async () => {
        await queryClient.end();
      },
    };
  }

  const dataDir =
    url === "memory://"
      ? undefined
      : url && !url.startsWith("postgres")
        ? url
        : path.join(MONOREPO_ROOT, ".pgdata/pricelens");

  if (dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const pg = new PGlite(dataDir);
  const db = drizzlePglite(pg, { schema });
  return {
    db,
    close: async () => {
      await pg.close();
    },
  };
}

export function getSharedDatabase(options: DatabaseClientOptions = {}): PriceLensDb {
  if (!sharedDb) {
    sharedDb = createDatabaseClient(options).db;
  }
  return sharedDb;
}
