# API Reference

Base URL: `/api/v1` · Auth: `Authorization: Bearer <accessToken>` · Envelope:
`{ success, data, meta? }` / `{ success: false, error: { code, message, details? } }`

**Interactive docs:** `GET /api/docs` (Swagger UI) · **Spec:** `GET /api/docs.json`
— import the JSON URL into Postman/Insomnia as a ready-made collection.

## Endpoint index

### Auth (`/auth`)
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register` | name, email, password |
| POST | `/auth/login` | + `rememberMe` (30d refresh) |
| POST | `/auth/refresh` | rotates cookie token; reuse ⇒ session revoked |
| POST | `/auth/logout` · `/auth/logout-all` | |
| GET | `/auth/me` | profile + workspace memberships |
| GET/DELETE | `/auth/sessions[/:sessionId]` | device management |
| POST | `/auth/forgot-password` · `/auth/reset-password` | |
| POST | `/auth/verify-email` · `/auth/resend-verification` | |
| GET | `/auth/google` `/auth/github` (+ `/callback`) | OAuth redirects |

### Workspaces & members
| Method | Path |
| --- | --- |
| POST/GET | `/workspaces` |
| GET/PATCH/DELETE | `/workspaces/:workspaceId` |
| POST | `/workspaces/:workspaceId/transfer-ownership` |
| GET | `/workspaces/:workspaceId/members` |
| PATCH/DELETE | `/workspaces/:workspaceId/members/:memberId` |
| POST/GET | `/workspaces/:workspaceId/invitations` |
| DELETE | `/workspaces/:workspaceId/invitations/:invitationId` |
| GET | `/invitations/:token` (public preview) |
| POST | `/invitations/accept` |

### Projects
| Method | Path |
| --- | --- |
| POST/GET | `/workspaces/:wid/projects` (filters: status, search, favorites, templates) |
| GET/PATCH/DELETE | `/workspaces/:wid/projects/:projectId` |
| POST | `…/:projectId/favorite` · `…/:projectId/duplicate` · `…/:projectId/health/refresh` |

### Tasks & board
| Method | Path |
| --- | --- |
| POST | `/workspaces/:wid/projects/:pid/tasks` |
| GET | `/workspaces/:wid/projects/:pid/board` (columns + ordered cards) |
| GET | `/workspaces/:wid/tasks` (workspace-wide filter/search) |
| GET/PATCH/DELETE | `/workspaces/:wid/tasks/:taskId` |
| POST | `…/:taskId/move` (columnId + before/after neighbours) |
| GET | `…/:taskId/history` |
| POST/PATCH/DELETE | `…/:taskId/checklist[/:itemId]` |
| GET/POST/PATCH/DELETE | `…/:taskId/comments[/:commentId]` |
| POST/DELETE | `…/:taskId/dependencies[/:dependencyId]` (cycle-checked) |
| POST | `…/:taskId/watch` |
| PUT/DELETE | `…/:taskId/recurrence` |
| PUT | `…/:taskId/custom-fields` |
| GET/POST/PATCH/DELETE | `/workspaces/:wid/labels[/:labelId]` |
| GET/POST/DELETE | `/workspaces/:wid/custom-fields[/:fieldId]` |
| POST/PATCH/DELETE | `/workspaces/:wid/projects/:pid/columns[/:columnId]` |

### Sprints, time, reports
| Method | Path |
| --- | --- |
| GET/POST | `/workspaces/:wid/projects/:pid/sprints` |
| PATCH/DELETE | `…/sprints/:sprintId` |
| POST | `…/sprints/:sprintId/complete` · `…/sprints/:sprintId/tasks` (bulk assign) |
| GET | `/workspaces/:wid/time/active` |
| POST | `/workspaces/:wid/time/start|pause|resume|stop` |
| POST/GET | `/workspaces/:wid/time/entries` · DELETE `…/entries/:entryId` |
| GET | `/workspaces/:wid/reports/dashboard` |
| GET | `/workspaces/:wid/projects/:pid/reports/burndown/:sprintId` · `…/reports/velocity` |
| GET | `/workspaces/:wid/reports/workload` · `/workspaces/:wid/reports/time` |

### Chat & notifications
| Method | Path |
| --- | --- |
| GET/POST | `/workspaces/:wid/channels` |
| GET | `/workspaces/:wid/tasks/:taskId/channel` (lazy task chat) |
| GET/POST | `…/channels/:channelId/messages` (cursor: `before`) |
| PATCH/DELETE | `…/messages/:messageId` |
| POST | `…/messages/:messageId/reactions` · `…/channels/:channelId/read` · `…/channels/:channelId/members` |
| GET | `/notifications` · POST `…/:id/read` · `…/read-all` |
| GET/PUT | `/notifications/preferences` |

### Files & search
| Method | Path |
| --- | --- |
| GET/POST | `/workspaces/:wid/files` (multipart `file`; optional taskId/folderId/replacesAttachmentId) |
| POST/PATCH/DELETE | `/workspaces/:wid/folders[/:folderId]` |
| GET | `/workspaces/:wid/tasks/:taskId/attachments` · `…/attachments/:id/versions` |
| DELETE | `/workspaces/:wid/attachments/:attachmentId` |
| GET | `/workspaces/:wid/search?q=…&types=tasks,projects,members,labels,messages` |

### Billing
| Method | Path |
| --- | --- |
| GET | `/billing/plans` (public) |
| POST | `/billing/webhook` (Stripe, raw body) · `/billing/coupons/validate` |
| GET | `/workspaces/:wid/billing/subscription` · `…/billing/invoices` |
| POST | `…/billing/checkout` · `…/billing/portal` · `…/billing/cancel` |

### AI
| Method | Path |
| --- | --- |
| POST | `/workspaces/:wid/projects/:pid/ai/generate-tasks` |
| POST | `…/ai/plan-sprint` · `…/ai/risk-analysis` · `…/ai/predict-deadline` |
| POST | `/workspaces/:wid/ai/meeting-summary` |
| POST | `/workspaces/:wid/tasks/:taskId/ai/suggest-priority` |

### Admin (super admin only)
`GET /admin/analytics` · `GET/PATCH /admin/users[/:userId]` ·
`GET/PATCH /admin/workspaces[/:workspaceId]` · `GET /admin/invoices` ·
`GET/PATCH /admin/plans[/:planId]` · `GET/POST/PATCH /admin/coupons[/:couponId]` ·
`GET /admin/audit-logs` · `GET/PUT /admin/feature-flags[/:key]`

## Socket.IO events

Connect to the API origin with `auth: { token: <accessToken> }`.

| Direction | Event | Payload |
| --- | --- | --- |
| C→S | `workspace:join` / `workspace:leave` | workspaceId |
| C→S | `project:join` / `project:leave` | { workspaceId, projectId } |
| C→S | `channel:join` / `channel:leave` | channelId |
| C→S | `typing:start` / `typing:stop` | { channelId } |
| C→S | `cursor:move` | { projectId, x, y, color } |
| S→C | `presence:online/offline/list` | presence payloads |
| S→C | `task:created/updated/moved/deleted` | task card / move payload |
| S→C | `comment:created/updated/deleted` | { taskId, comment } |
| S→C | `message:new/updated/deleted/reaction/read` | message payloads |
| S→C | `notification:new` | notification row |

## Error codes

`VALIDATION_ERROR` 400 · `UNAUTHORIZED`/`TOKEN_EXPIRED`/`TOKEN_INVALID` 401 ·
`PLAN_LIMIT_REACHED` 402 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` 409 ·
`RATE_LIMITED` 429 · `INTERNAL_ERROR` 5xx
