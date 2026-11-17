import { createApiApp } from "@pricelens/api";
import { createPriceLensClient } from "@pricelens/api-client";
import {
  getSharedDatabase,
  migrateDatabase,
  seedDatabase,
  sessions,
  users,
} from "@pricelens/database";

export const DEMO_TOKENS = {
  member: "demo_member_session_token_th",
  admin: "demo_admin_session_token_th",
} as const;

let initializedPromise: Promise<ReturnType<typeof createApiApp>> | null = null;

export async function getServerApiApp() {
  if (!initializedPromise) {
    initializedPromise = (async () => {
      const db = getSharedDatabase();
      await migrateDatabase(db);
      await seedDatabase(db);

      // Seed local demo member & admin accounts for instant testing alongside Better Auth sign-up
      const [demoMember] = await db
        .insert(users)
        .values({
          id: "70000000-0000-4000-8000-000000000001",
          name: "สมชาย นักช้อป (Demo Member)",
          email: "member@pricelens.co.th",
          emailVerified: true,
          role: "user",
        })
        .onConflictDoNothing()
        .returning();

      const [demoAdmin] = await db
        .insert(users)
        .values({
          id: "70000000-0000-4000-8000-000000000002",
          name: "อาทิตย์ ผู้ดูแลระบบ (Demo Admin)",
          email: "admin@pricelens.co.th",
          emailVerified: true,
          role: "admin",
        })
        .onConflictDoNothing()
        .returning();

      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      await db
        .insert(sessions)
        .values([
          {
            userId: demoMember?.id ?? "70000000-0000-4000-8000-000000000001",
            token: DEMO_TOKENS.member,
            expiresAt,
          },
          {
            userId: demoAdmin?.id ?? "70000000-0000-4000-8000-000000000002",
            token: DEMO_TOKENS.admin,
            expiresAt,
          },
        ])
        .onConflictDoNothing();

      return createApiApp({ db });
    })();
  }
  return initializedPromise;
}

export async function getServerApiClient(authToken?: string | null) {
  const { app } = await getServerApiApp();
  return createPriceLensClient({
    baseUrl: "http://localhost:3000/api/v1",
    getAuthToken: () => authToken ?? null,
    fetchImpl: async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      return app.request(url, init);
    },
  });
}
