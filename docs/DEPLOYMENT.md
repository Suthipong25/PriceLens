# PriceLens — Production Deployment Guide (`DEPLOYMENT.md`)

This document outlines the production deployment architecture for **PriceLens** across **Cloudflare Workers**, **PostgreSQL (via Cloudflare Hyperdrive)**, **Cloudflare Queues / Cron Triggers / R2**, **Next.js (`apps/web`)**, and **Expo (`apps/mobile`)**.

---

## 1. Production Infrastructure Topology

| Component | Target Service | Purpose |
| :--- | :--- | :--- |
| **Database** | Managed PostgreSQL 16 (Neon / Supabase / RDS) + **Cloudflare Hyperdrive** | Low-latency connection pooling for edge Workers |
| **Core API** | **Cloudflare Workers** (`workers/api`) | Serves `/api/v1/*`, `/api/auth/*`, and `/api/v1/openapi.json` |
| **Ingestion & Alerts** | **Cloudflare Workers** (`workers/ingestion`) + **Queues** + **Cron Triggers** | Runs scheduled feed syncs, CSV batch imports, and price alert evaluations |
| **Object Storage** | **Cloudflare R2** (`pricelens-assets`) | Stores product images and uploaded CSV feed archives |
| **Rate Limit & Cache** | **Cloudflare KV** (`PRICELENS_KV`) | Distributed sliding-window rate limiting and hot catalog caching |
| **Web Frontend** | **Cloudflare Pages / OpenNext** or **Vercel** (`apps/web`) | SSR/ISR SEO product pages, User Dashboard, and Admin Console |
| **Mobile App** | **Expo EAS Build** (`apps/mobile`) | iOS App Store & Google Play Store builds with FCM/APNs push notifications |

---

## 2. Step-by-Step Production Deployment

### Step 1: Provision PostgreSQL 16 & Run Migrations
```bash
# Set production DATABASE_URL
export DATABASE_URL="postgresql://user:password@prod-db-host:5432/pricelens?sslmode=require"
export USE_PGLITE="false"

# Apply PostgreSQL schema & constraints
corepack pnpm --filter @pricelens/database db:migrate
```

### Step 2: Configure Cloudflare Secrets (Never Commit to Git)
```bash
cd workers/api
npx wrangler secret put DATABASE_URL
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SENTRY_DSN
```

### Step 3: Deploy API & Ingestion Workers
```bash
cd workers/api
npx wrangler deploy
```

### Step 4: Build & Deploy Web Application (`apps/web`)
```bash
corepack pnpm --filter @pricelens/web build
corepack pnpm --filter @pricelens/web start
```

---

## 3. Security & Pre-Launch Checklist

- [x] `BETTER_AUTH_SECRET` rotated to a cryptographic 32-byte value (`openssl rand -base64 32`).
- [x] `USE_PGLITE="false"` set in production so external managed PostgreSQL is used.
- [x] Seeded `[DEMO DATA]` excluded in production (do **not** run `db:seed` against production database).
- [x] Cloudflare Turnstile production site key and secret key configured.
- [x] Resend verified sender domain (`alerts@pricelens.co.th`) configured with SPF, DKIM, and DMARC.
- [x] PostgreSQL `price_snapshots` monthly partitioning scheduled when row count exceeds 10M rows.
