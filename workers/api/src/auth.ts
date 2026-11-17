import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq, gt, and } from "drizzle-orm";
import {
  accounts,
  sessions,
  users,
  verifications,
  type PriceLensDb,
} from "@pricelens/database";
import type { UserRole } from "@pricelens/shared";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
}

export function createAuth(db: PriceLensDb) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      usePlural: true,
      schema: {
        users,
        sessions,
        accounts,
        verifications,
      },
    }),
    secret:
      process.env.BETTER_AUTH_SECRET ??
      "pricelens-dev-only-secret-change-in-production-32b",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:8787",
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
          input: false,
        },
      },
    },
    advanced: {
      database: {
        generateId: "uuid",
      },
    },
  });
}

/**
 * Resolves the current authenticated user from either:
 * 1. Better Auth session cookie/headers, OR
 * 2. Direct Bearer token matching an active non-expired row in `sessions`.
 */
export async function resolveAuthenticatedUser(
  db: PriceLensDb,
  authInstance: ReturnType<typeof createAuth>,
  request: Request,
): Promise<AuthenticatedUser | null> {
  // Check Bearer session token first (for mobile / API clients)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token.length > 0) {
      const now = new Date();
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          emailVerified: users.emailVerified,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
        .limit(1);

      if (rows[0]) {
        return rows[0];
      }
    }
  }

  // Fallback to Better Auth session cookie / headers
  try {
    const sessionData = await authInstance.api.getSession({
      headers: request.headers,
    });
    if (sessionData?.user) {
      const [dbUser] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          emailVerified: users.emailVerified,
        })
        .from(users)
        .where(eq(users.id, sessionData.user.id))
        .limit(1);

      return dbUser ?? null;
    }
  } catch {
    return null;
  }

  return null;
}
