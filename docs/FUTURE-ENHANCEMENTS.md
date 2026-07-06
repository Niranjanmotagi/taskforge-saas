# Future Enhancements

Prioritized roadmap of what we would build next.

## Near term (product polish)
- **Assignee/label pickers in the task sheet** — member combobox with search (API already supports `assigneeIds`/`labelIds` on PATCH)
- **Attachment upload inside the task sheet** (endpoint exists; UI entry point is on Files today)
- **Task-level timer button** on cards and in the sheet (endpoints exist)
- **Saved board filters** (assignee/label/priority) and swimlanes by assignee/priority
- **Drag-to-reschedule on Gantt** (PATCH startDate/dueDate on drop) + dependency arrows
- **Sprint planning board** — drag backlog tasks into the sprint (bulk-assign endpoint exists)
- **Rich text/markdown editor** with inline @mention autocomplete for descriptions and comments
- **Live cursors UI** on the board (gateway event already relays)

## Medium term
- **Push notifications** — Web Push/service worker (preference channel already modeled)
- **Per-project member roles** and private projects
- **Custom field UI on cards/list columns** + filtering by custom fields
- **Recurring task editor UI** (backend rules complete)
- **Workspace-level analytics exports** (CSV/PDF of reports)
- **File previews** (PDF/video inline) and folder sharing links
- **Email digests** (daily/weekly summary job — queue infrastructure ready)
- **Import/export**: Jira/Trello/Asana importers; full workspace JSON export
- **Public API tokens** (personal access tokens with scopes) + webhooks out

## Scale & platform
- **Socket.IO Redis adapter** for multi-replica realtime
- **Dedicated worker deployment** (extract queues/cron entrypoint)
- **Postgres full-text search** (tsvector + GIN) or Meilisearch for global search
- **Read replicas** + query routing for report-heavy workloads
- **Row-level security** as an extra tenant-isolation net beneath Prisma
- **SSO (SAML/OIDC)** and SCIM provisioning for Enterprise tier
- **Audit log streaming** (SIEM export) and data-retention policies
- **Feature-flag targeting** by workspace/plan (rules field already stored)

## AI
- **Streaming AI responses** in the UI (SSE)
- **AI standup summaries** from activity + completed tasks
- **Semantic search** over tasks/comments (embeddings)
- **Auto-triage**: label + priority suggestions on task creation
- **Workload balancing suggestions** from the workload report
