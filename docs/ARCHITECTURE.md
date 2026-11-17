# PriceLens — System Architecture (`ARCHITECTURE.md`)

## 1. Architectural Overview

PriceLens is architected as a modular TypeScript monorepo separating **presentation (`apps/*`)**, **edge compute & background pipelines (`workers/*`)**, and **shared domain/database packages (`packages/*`)**.

```mermaid
flowchart TD
    subgraph Clients["Client Applications"]
        Web["apps/web\nNext.js App Router (Public, User, Admin UI)"]
        Mobile["apps/mobile\nExpo / React Native (iOS & Android)"]
    end

    subgraph Edge["Cloudflare Edge & Workers"]
        API["workers/api\nHono REST API (/api/v1) + Better Auth"]
        Ingest["workers/ingestion\nCron Triggers + Queue Consumers"]
        KV["Cloudflare KV / Cache API\nRate Limits & Hot Read Cache"]
        R2["Cloudflare R2\nProduct Images & CSV Uploads"]
        Queue["Cloudflare Queues\ningestion-queue + ingestion-dlq"]
    end

    subgraph Shared["Shared Packages"]
        Biz["packages/business\nMatching, Normalization, Price Calc"]
        Val["packages/validation\nZod Request/Response/Feed Schemas"]
        DBPkg["packages/database\nDrizzle ORM Schema & Migrations"]
        ClientPkg["packages/api-client\nTyped API Client"]
    end

    subgraph External["Database & External Services"]
        PG[("PostgreSQL\nCanonical Catalog, Offers, Snapshots")]
        Resend["Resend API\nPrice Alert Emails"]
        Turnstile["Cloudflare Turnstile\nBot Protection"]
        Sentry["Sentry\nError Monitoring"]
    end

    Web --> ClientPkg
    Mobile --> ClientPkg
    ClientPkg --> API
    API --> KV
    API --> R2
    API --> Turnstile
    API --> Queue
    API --> Biz
    API --> Val
    API --> DBPkg
    Ingest --> Queue
    Ingest --> R2
    Ingest --> Biz
    Ingest --> Val
    Ingest --> DBPkg
    Ingest --> Resend
    DBPkg --> PG
    API -.-> Sentry
    Ingest -.-> Sentry
```

---

## 2. Monorepo Structure & Design Justification

```text
pricelens/
├── apps/
│   ├── web/                      # Next.js App Router (Public SEO pages, User Dashboard, Admin Console)
│   └── mobile/                   # Expo Router React Native app (Phase 5)
├── workers/
│   ├── api/                      # Cloudflare Worker: REST API (/api/v1), Better Auth, OpenAPI spec
│   └── ingestion/                # Cloudflare Worker: Adapters, Queue consumers, Cron sync, Alert jobs
├── packages/
│   ├── database/                 # Drizzle ORM PostgreSQL schema, migrations, client, and dev seed
│   ├── shared/                   # Currency constants, enums, formatting helpers, domain types
│   ├── validation/               # Shared Zod schemas (API payloads, query params, CSV/feed records)
│   ├── business/                 # Pure domain logic: Matching Engine, Total Price Calc, Normalizers
│   └── api-client/               # Isomorphic typed REST client consumed by apps/web and apps/mobile
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── DATA_SOURCES.md
│   └── ROADMAP.md
├── docker-compose.yml            # Local PostgreSQL 16 instance for development & integration tests
├── .env.example                  # Documented environment variable template
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### Key Architectural Decision: Serving Admin Routes Inside `apps/web` vs. Separate `apps/admin`
- **Decision:** Serve the Admin Console under the route group `apps/web/src/app/(admin)/admin/*` protected by server-side RBAC (`role === 'admin'`) and admin API middleware, rather than spinning up a separate Next.js build in `apps/admin`.
- **Why:**
  1. **Zero Duplication:** Both public/user pages and admin pages share the exact same design system (`shadcn/ui`), authentication client (`Better Auth`), TanStack Query provider, and API client (`@pricelens/api-client`).
  2. **Requirement Alignment:** Section 8 of the specification lists all 18 required web pages (1–12 Public/User, 13–18 Admin) as part of the Web application.
  3. **Operational Simplicity:** One web deployment pipeline, faster CI builds, and half the local dev memory footprint while maintaining strict server-side authorization boundaries on `/admin/*` and `/api/v1/admin/*`.
  *(Note: If you prefer `apps/admin` as a physically separate Next.js workspace package, the shared packages make extracting it trivial—please confirm during plan approval.)*

---

## 3. Component & Runtime Architecture

### 3.1 Backend API (`workers/api`)
- **Framework:** [Hono](https://hono.dev/) with `@hono/zod-openapi` running on Cloudflare Workers.
  - Native Web Standards (`Request`/`Response`), zero cold-start overhead on Cloudflare Workers, first-class TypeScript routing, and automatic OpenAPI 3.1 schema generation from our `@pricelens/validation` Zod schemas.
- **Database Connectivity:** Drizzle ORM (`drizzle-orm/postgres-js` with `postgres` driver) connecting via Cloudflare Hyperdrive in production and direct TCP (`DATABASE_URL`) in local development.
- **Authentication & RBAC:**
  - **Better Auth** mounted at `/api/auth/*` using `drizzleAdapter(db, { provider: "pg" })` with native UUID generation (`advanced.database.generateId = "uuid"`).
  - Session middleware resolves the current user on `/api/v1/me/*` (`requireAuth`) and enforces `user.role === "admin"` on `/api/v1/admin/*` (`requireAdmin`).
- **Rate Limiting & Bot Protection:**
  - Public write/auth endpoints verify Cloudflare Turnstile tokens (`TURNSTILE_SECRET_KEY`).
  - Sliding-window rate limiting middleware backed by Cloudflare KV (with in-memory fallback in local test environments) protects search, click-tracking, auth, and admin endpoints.

### 3.2 Data Ingestion Worker (`workers/ingestion`)
- **Execution Triggers:**
  1. **Cron Triggers:** Scheduled feed synchronization (`sync-offers.job.ts`) and alert sweeps (`price-alert.job.ts`).
  2. **Cloudflare Queues (`ingestion-queue`):** Asynchronous batch processing triggered when an admin uploads a CSV or initiates a manual feed import via `POST /api/v1/admin/offers/import`.
  3. **Dead-Letter Queue (`ingestion-dlq`):** Captures failed batches after max retries (3 attempts with exponential backoff) and updates `ingestion_jobs.status = 'failed'` with diagnostic error messages.
- **Pure Domain Core (`packages/business`):**
  - All normalization, deterministic matching, total price calculation, and alert condition evaluation live in `@pricelens/business` as pure TypeScript functions so they can be unit-tested deterministically without mocking Cloudflare bindings.

### 3.3 Web Application (`apps/web`)
- **Framework:** Next.js (App Router, TypeScript, Tailwind CSS, `shadcn/ui`).
- **Rendering Strategy:**
  - **Server Components (SSR / ISR):** Homepage, Category pages, Brand pages, Search results, and Product Detail pages render on the server for fast First Contentful Paint (FCP) and full search-engine indexability (including canonical URLs, OpenGraph tags, and JSON-LD `Product` schema).
  - **Client Components (`TanStack Query`):** Interactive price history timeframe switching (`7d`/`30d`/`90d`/`365d`), offer table sorting, Watchlist/Alert mutations, and Admin review queue actions.

### 3.4 Mobile Application (`apps/mobile`)
- **Framework:** Expo SDK + React Native + Expo Router (implemented in Phase 5 after Web MVP and User Features are verified).
- **Code Reuse:** Directly imports `@pricelens/api-client`, `@pricelens/validation`, and `@pricelens/shared` for zero-drift API contracts and currency/price formatting.

---

## 4. Security & Privacy Architecture

1. **Authentication & Password Handling:** Delegated entirely to Better Auth (`scrypt`/`argon2` hashing inside Better Auth's `accounts` table; no custom password storage).
2. **Role-Based Access Control (RBAC):** Enforced at the API middleware layer (`workers/api`) before controller execution. Client-side route guards in `apps/web` are UX conveniences backed by hard API checks.
3. **Secret Isolation:** Data source credentials (affiliate API keys, feed tokens) are referenced by environment secret binding names (e.g., `SOURCE_SECRET_INVOLVE_ASIA`) and never persisted in `data_sources.configuration` JSONB.
4. **Input Validation & Output Encoding:** Every route validates path params, query strings, and JSON bodies via Zod schemas. SQL injection is prevented by Drizzle parameterized queries; merchant URLs are validated to allow only `https://` (or `http://` in explicit dev mode) to prevent `javascript:` or `data:` XSS vectors in outbound links.
5. **Admin Audit Trail:** Every state-changing admin action (product edits, match candidate approval/rejection, data source modification, manual imports) writes an immutable record to `audit_logs`.
6. **Account Deletion (Thailand PDPA Compliance):** `DELETE /api/v1/me` permanently deletes the user's account, cascading across `sessions`, `accounts`, `watchlists`, `price_alerts`, and `notifications`, while anonymizing `affiliate_clicks.user_id` (`ON DELETE SET NULL`).

---

## 5. Required Environment Variables (`.env.example`)

```dotenv
# --- Database ---
DATABASE_URL="postgresql://pricelens:pricelens_dev@localhost:5432/pricelens"

# --- Authentication (Better Auth) ---
BETTER_AUTH_SECRET="replace-with-32-byte-cryptographic-random-secret"
BETTER_AUTH_URL="http://localhost:8787"

# --- API & Web URLs ---
NEXT_PUBLIC_API_URL="http://localhost:8787/api/v1"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
CORS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:8081"

# --- Bot Protection (Cloudflare Turnstile) ---
NEXT_PUBLIC_TURNSTILE_SITE_KEY="1x00000000000000000000AA" # Cloudflare official test key for local dev
TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"          # Cloudflare official test secret for local dev

# --- Email Notifications (Resend) ---
RESEND_API_KEY="" # Optional in local dev (falls back to console/dry-run transport when unset)
EMAIL_FROM="PriceLens Alerts <alerts@pricelens.co.th>"

# --- Error Monitoring (Sentry) ---
SENTRY_DSN="" # Optional in local dev

# --- Environment Mode ---
NODE_ENV="development"
```
