# Deployment Guide

Deploying TaskForge with Docker Compose on a single host (the provided path),
plus notes for splitting services later.

## Topology

```
Internet → :80 nginx ──→ frontend (Next standalone, :3000)
                    └──→ backend  (Express API + Socket.IO, :5000)
                              ├──→ postgres:16 (volume)
                              └──→ redis:7 (volume)
```

## 1. Server prerequisites

- Linux host with Docker Engine + Compose plugin
- DNS record pointing at the host
- TLS: either a load balancer/CDN in front (recommended) or add certificates
  to `nginx/nginx.conf` (listen 443 + `ssl_certificate`)

## 2. Configuration

```bash
cp .env.example .env
```

**Must change for production:**

| Variable | Requirement |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_URL` | public web origin, e.g. `https://app.example.com` |
| `API_URL` | public API origin (same origin when using the bundled nginx) |
| `CORS_ORIGINS` | comma-separated allowed web origins |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `COOKIE_SECRET` | 32+ chars, cryptographically random, all different |
| `POSTGRES_PASSWORD` | strong password |
| `REDIS_PASSWORD` | strong password (compose passes it via `--requirepass`) |
| `COOKIE_DOMAIN` | your apex/app domain |
| `SMTP_*` | production mail provider |
| `STRIPE_*` | live keys + webhook secret + price ids per plan/interval |
| `CLOUDINARY_*` | production account |
| `ANTHROPIC_API_KEY` | if AI features should be enabled |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | set BEFORE first seed |

Frontend public env is baked at image build (`NEXT_PUBLIC_API_URL` defaults to
`/api/v1`, which is correct behind the bundled nginx; `NEXT_PUBLIC_SOCKET_URL`
empty = same origin).

## 3. Launch

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps           # wait for healthy
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

Migrations run automatically on API boot (`prisma migrate deploy`); the seed is
idempotent (plans, flags, super-admin).

## 4. Stripe webhooks

Point a webhook endpoint at `https://<your-domain>/api/v1/billing/webhook`
with events: `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
Put the signing secret in `STRIPE_WEBHOOK_SECRET`.

Create Stripe Prices for each paid plan/interval and set their ids either in
`.env` (used by seed) or via **Admin → Plans**.

## 5. Operations

```bash
# logs
docker compose -f docker-compose.prod.yml logs -f backend

# deploy a new version
git pull && docker compose -f docker-compose.prod.yml up -d --build

# database backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz

# restore
gunzip -c backup-YYYY-MM-DD.sql.gz | docker compose -f docker-compose.prod.yml \
  exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Schedule the backup command via cron; ship archives off-host.

## 6. Scaling beyond one host

- **API**: stateless except Socket.IO rooms — add the `@socket.io/redis-adapter`
  before running multiple API replicas, then scale `backend` horizontally.
- **Postgres/Redis**: move to managed services (RDS/Cloud SQL, Elasticache) —
  only `DATABASE_URL`/`REDIS_*` change.
- **Frontend**: fully stateless; scale freely or move to Vercel (set
  `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_SOCKET_URL` to the API origin).
- **Workers/cron**: currently in-process with the API. For independent scaling,
  run a second `backend` container with the HTTP port unexposed (workers+cron
  only) — or extract `src/queues` + `src/jobs` into a dedicated entrypoint.

## CI/CD

`.github/workflows/ci.yml` typechecks, tests (against service containers), and
builds on every push/PR; pushes to `main` additionally publish
`ghcr.io/<repo>/api` and `ghcr.io/<repo>/web` images. Point your host at those
images instead of building locally when you want pull-based deploys.
