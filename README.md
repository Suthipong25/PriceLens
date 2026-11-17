# PriceLens — Smart Shopping Intelligence Platform

> **Shop smarter. Pay less.**  
> Thailand's transparent price comparison, product matching, and historical price intelligence platform.

---

## Documentation

- [Product Requirements Document (`docs/PRD.md`)](./docs/PRD.md)
- [System Architecture (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)
- [Database Design (`docs/DATABASE.md`)](./docs/DATABASE.md)
- [REST API Specification (`docs/API.md`)](./docs/API.md)
- [Data Sources & Matching Engine (`docs/DATA_SOURCES.md`)](./docs/DATA.md)
- [Development Roadmap (`docs/ROADMAP.md`)](./docs/ROADMAP.md)

---

## Monorepo Structure

```text
pricelens/
├── apps/
│   ├── web/            # Next.js App Router (Public SEO pages, User Dashboard, Admin Console)
│   └── mobile/         # Expo / React Native mobile application
├── workers/
│   ├── api/            # Cloudflare Worker REST API (/api/v1) + Better Auth + OpenAPI
│   └── ingestion/      # Modular Data Ingestion Adapters, Matching Pipeline & Alert Jobs
├── packages/
│   ├── shared/         # Shared constants, THB currency formatters, enums, domain types
│   ├── validation/     # Shared Zod validation schemas (API & data ingestion)
│   ├── database/       # Drizzle ORM PostgreSQL schema, migrations, client & labeled demo seed
│   ├── business/       # Pure domain services: Matching Engine, Price Calculator, Normalizers
│   └── api-client/     # Typed HTTP client for Web and Mobile
└── docs/               # Engineering & product documentation
```

---

## Quick Start (Local Development)

```powershell
# 1. Copy environment variables
Copy-Item .env.example .env

# 2. Optional: Start PostgreSQL via Docker (or let @pricelens/database use persistent local PGlite PG16 automatically)
docker compose up -d

# 3. Install dependencies
corepack pnpm install

# 4. Run database migrations and seed labeled [DEMO DATA]
corepack pnpm db:migrate
corepack pnpm db:seed

# 5. Run type checks and automated tests
corepack pnpm typecheck
corepack pnpm test

# 6. Start development servers
corepack pnpm dev
```
