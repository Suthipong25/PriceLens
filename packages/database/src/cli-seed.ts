import { createDatabaseClient } from "./client.js";
import { migrateDatabase } from "./migrate.js";
import { seedDatabase } from "./seed.js";

async function main() {
  const { db, close } = createDatabaseClient();
  try {
    console.log("Applying migrations and seeding PriceLens [DEMO DATA]...");
    await migrateDatabase(db);
    await seedDatabase(db);
    console.log("Database seeded successfully.");
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
