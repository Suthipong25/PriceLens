import { createDatabaseClient } from "./client.js";
import { migrateDatabase } from "./migrate.js";

async function main() {
  const { db, close } = createDatabaseClient();
  try {
    console.log("Running PriceLens PostgreSQL migrations...");
    await migrateDatabase(db);
    console.log("Migrations applied successfully.");
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
