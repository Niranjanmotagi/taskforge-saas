# Setup Guide

Step-by-step local development setup for TaskForge.

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 20 | `node --version` |
| npm | ≥ 10 | ships with Node 20 |
| Docker Desktop | any recent | runs Postgres + Redis |
| Git | any recent | |

## 2. Clone & configure

```bash
git clone <repo-url> taskforge && cd taskforge
cp .env.example .env
```

The defaults in `.env.example` work out of the box for local development.
Things you may need to change:

- **`POSTGRES_PORT` / `DATABASE_URL`** — if a local PostgreSQL already occupies
  5432 (common on Windows), set `POSTGRES_PORT=5433` and change the port inside
  `DATABASE_URL` to match. Docker will map the container accordingly.
- **JWT/COOKIE secrets** — fine for dev; MUST be replaced in production.

## 3. Infrastructure

```bash
docker compose up -d
docker compose ps          # both containers should be "healthy"
```

## 4. Install & database

```bash
npm install                          # installs every workspace
npm run prisma:migrate               # creates tables (answer "y" if prompted)
SEED_DEMO=true npm run prisma:seed   # plan catalog + demo workspace
```

> **Windows/PowerShell:** `$env:SEED_DEMO='true'; npm run prisma:seed`

Seeded accounts:

| Account | Email | Password |
| --- | --- | --- |
| Demo owner | `demo@taskforge.local` | `Demo1234!` |
| Team member | `sam@taskforge.local` | `Demo1234!` |
| Team member | `priya@taskforge.local` | `Demo1234!` |
| Super admin | `admin@taskforge.local` | `ChangeMe123!` |

## 5. Run

```bash
npm run dev
```

- Web app → http://localhost:3000
- API → http://localhost:5000/api/v1
- Swagger → http://localhost:5000/api/docs
- Health → http://localhost:5000/api/v1/health

## 6. Optional integrations

Each activates automatically when its keys are present in `.env`; without them
the related endpoints degrade to `503` and the rest of the app is unaffected.

| Integration | Variables | Used for |
| --- | --- | --- |
| SMTP | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` | verification, invites, notifications. Without SMTP, emails are logged to the API console **including their action links** so you can complete flows in dev |
| Cloudinary | `CLOUDINARY_*` | file/attachment uploads |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price ids | billing. Use `stripe listen --forward-to localhost:5000/api/v1/billing/webhook` for local webhooks |
| Anthropic | `ANTHROPIC_API_KEY` | the six AI features |
| Google OAuth | `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` | social sign-in. Callback: `http://localhost:5000/api/v1/auth/google/callback` |
| GitHub OAuth | `GITHUB_CLIENT_ID/SECRET/CALLBACK_URL` | social sign-in. Callback: `http://localhost:5000/api/v1/auth/github/callback` |

## 7. Useful commands

```bash
npm test --workspace=@taskforge/backend   # backend test suites
npm run prisma:studio                     # browse the database
npm run build                             # production build of everything
docker compose down -v                    # reset ALL local data
```

## Troubleshooting

- **`P1000: Authentication failed` on migrate** — you are hitting a different
  Postgres (usually a local Windows service on 5432). Remap the container port
  (step 2) or stop the local service.
- **Port 3000/5000 in use** — stop the other process or change `API_PORT` /
  the frontend `-p` flag in `apps/frontend/package.json`.
- **Emails not arriving** — without SMTP config they are printed to the API
  console with the action link.
