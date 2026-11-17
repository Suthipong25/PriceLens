import { serve } from "@hono/node-server";
import {
  createDatabaseClient,
  migrateDatabase,
  seedDatabase,
} from "@pricelens/database";
import { createApiApp } from "./app.js";

async function startServer() {
  const { db } = createDatabaseClient();
  await migrateDatabase(db);
  await seedDatabase(db);

  const { app } = createApiApp({ db });
  const port = Number(process.env.API_PORT ?? 8787);

  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(
        `PriceLens API Worker running at http://localhost:${info.port}/api/v1`,
      );
    },
  );
}

startServer().catch((err) => {
  console.error("Failed to start PriceLens API server:", err);
  process.exit(1);
});
