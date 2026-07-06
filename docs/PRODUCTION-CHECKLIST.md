# Production Checklist

Run through this before exposing TaskForge to real users.

## Secrets & configuration
- [ ] `NODE_ENV=production`
- [ ] Fresh random 32+ char values for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET` (all different)
- [ ] Strong `POSTGRES_PASSWORD` and `REDIS_PASSWORD`
- [ ] `APP_URL`, `API_URL`, `COOKIE_DOMAIN`, `CORS_ORIGINS` match the real domains
- [ ] `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` set before first seed; password rotated after first login
- [ ] `.env` never committed; secrets in a vault/CI secret store

## Transport & network
- [ ] TLS termination in place (LB/CDN or nginx certs); HTTP→HTTPS redirect
- [ ] Postgres/Redis not exposed publicly (compose keeps them internal — verify no extra port mappings)
- [ ] `trust proxy` matches your proxy depth (currently 1 hop) so rate limits key on real IPs

## Data
- [ ] Initial migration applied (`prisma migrate deploy` — automatic on API boot)
- [ ] Seed run once (plans, flags, super-admin); `SEED_DEMO` NOT set in production
- [ ] Automated daily `pg_dump` backups, shipped off-host, restore tested
- [ ] Redis persistence (AOF is enabled in compose) + memory limit sized

## Integrations
- [ ] Stripe live keys; webhook endpoint configured + signing secret set; checkout tested end-to-end; price ids set on plans
- [ ] Production SMTP with SPF/DKIM configured for the from-domain
- [ ] Cloudinary production environment; upload preset restrictions reviewed
- [ ] OAuth apps updated with production callback URLs
- [ ] Anthropic key + spend limits, if AI features enabled

## Security review
- [ ] Rate limits tuned (`RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`) for expected traffic
- [ ] Audit log retention/export decided
- [ ] Dependency scan in CI (e.g. `npm audit` gate or Dependabot) enabled
- [ ] Admin accounts limited; every admin action lands in the audit log (verify one)

## Operations
- [ ] Uptime check on `/api/v1/health`
- [ ] Log aggregation for container stdout (JSON logs in production)
- [ ] Error alerting (pipe `logger.error` volume to your APM/alerts)
- [ ] Cron sanity: due-date reminders + recurring tasks observed running (hourly logs)
- [ ] Rollback path: previous image tags retained in GHCR; DB migration rollback plan

## Product
- [ ] Marketing page copy/links reviewed
- [ ] Plan limits & pricing match Stripe configuration
- [ ] Transactional email templates render with the production APP_URL
- [ ] Demo data absent; empty states verified for new workspaces
