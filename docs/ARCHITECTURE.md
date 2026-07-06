# Architecture

Deep-dive companion to the README overview.

## Principles

- **Clean architecture per module**: `routes → controller → service → Prisma`.
  Routes own HTTP + validation, controllers own request/response mapping,
  services own business rules, Prisma is the only persistence surface.
- **SOLID/DRY at the seams**: the RBAC matrix, socket event contract, API
  envelope, and ordering algorithm live once in `packages/shared-*` and are
  consumed by both apps.
- **Fail fast, degrade gracefully**: env is Zod-validated at boot; optional
  integrations (Stripe/Cloudinary/SMTP/Anthropic) turn into clean `503`s when
  unconfigured instead of crashing flows.

## Multi-tenancy

Shared-database tenancy. Every tenant-owned table carries `workspaceId`.
Isolation is enforced at three layers:

1. **`tenantScope` middleware** — resolves `:workspaceId`, verifies the caller's
   membership (Redis-cached 60s, invalidated on role changes/removal), attaches
   `{ id, role }` to the request.
2. **`authorize(permission)`** — role → permission matrix from `shared-types`;
   role hierarchy (`canManageRole`) guards member management.
3. **Repository filters** — every service query includes `workspaceId` and
   `deletedAt: null`, so even a middleware regression cannot leak rows.

Sockets follow the same rule: room joins re-verify membership in the DB.

## Authentication lifecycle

```
login ─► Session row (hashed refresh token, device info) + 15m access JWT
access JWT carries sid ─► logout/revoation blacklists sid in Redis (TTL = JWT TTL)
refresh ─► rotate: tokenHash ⇐ new, previousHash ⇐ old
          presenting previousHash again ⇒ theft ⇒ session revoked + audit event
password reset ⇒ all sessions revoked
```

Refresh tokens travel only in an httpOnly cookie scoped to `/api/v1/auth`;
access tokens live in browser memory (never storage).

## Ordering (drag & drop)

Board position is a base-36 fractional key (`packages/shared-utils/lexorank`).
Moving a card writes one row (`columnId`, `position` between neighbours) — no
sibling re-indexing, so concurrent drags don't conflict. Generated keys never
end in `0`, guaranteeing a midpoint always exists.

## Status model

Custom Kanban columns each map to a fixed `TaskStatusCategory`
(BACKLOG…DONE). Reports, burndown, and health aggregate over categories, so
teams can rename/add columns freely without breaking analytics. Moving into a
DONE-category column stamps `completedAt`; moving out clears it.

## Realtime

- Gateway (`src/sockets/gateway.ts`): JWT handshake, membership-checked rooms
  (`user:` `workspace:` `project:` `channel:`), Redis presence sets with
  multi-socket disconnect handling (on `disconnecting`, while rooms are known).
- Domain services emit through `services/realtime.service.ts` — a null-safe
  facade, so unit tests and scripts run without a socket server.
- The notification service fans out via registered hooks: gateway (websocket)
  and email queue (BullMQ), keeping dependencies acyclic.

## Background processing

- **BullMQ** email queue (retry ×3, exponential backoff, inline fallback if
  Redis is down).
- **Cron** (node-cron, wrapped so one failure never kills the scheduler):
  hourly due-soon reminders (deduped via `dueSoonNotifiedAt`), hourly
  recurring-task spawner (clones template, advances `nextRunAt`), daily
  project-health recompute, monthly AI-credit reset.

## Soft delete policy

`deletedAt` on user content (workspaces, projects, tasks, comments, messages,
attachments, folders, time entries, custom fields). Join/system tables hard
delete. Task deletion soft-deletes its subtask tree (depth ≤ 3). Queries always
filter `deletedAt: null`; hard purges are a future retention job.

## Money & time units

Money is integer **cents** (`budgetCents`, `amountDueCents`, `hourlyRateCents`);
durations are integer **minutes**. Formatting happens only at the UI edge
(`shared-utils/format`).

## Frontend data flow

- **TanStack Query** holds all server state, keyed by workspace/entity; socket
  events invalidate the relevant keys (board, messages, notifications).
- **Optimistic drag-drop**: the board mutation writes the dragged layout into
  the cache immediately, rolls back on error, and reconciles on settle.
- **Zustand** holds only client state: session (access token in memory) and UI
  (sidebar, command palette).
- **Silent refresh**: a single deduped `/auth/refresh` retries the failed
  request once; failure clears the session and routes to login.
