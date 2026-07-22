# Kaneo — Feature List & Structure

## Features

### Core PM
- Workspace / team / role — multi-tenant orgs, RBAC
- Project → Column → Task kanban hierarchy (default columns: Backlog, To Do, In Progress, In Review, Done, Pending, Cancel)
- Views: board, backlog, list, Gantt, epics, sprints
- Epics — task hierarchy (task.type + parentTaskId), tree view with rollup progress
- Sprints — planned → active → completed lifecycle, task assignment, unfinished-task release on complete
- Task relations, external links, labels, comments
- Time entries — per-task time tracking
- Workflow rules — automation on task/column events
- Activity log — per-task history
- Audit log — workspace-scoped admin audit trail (who/what/when, survives deletions)
- Search — cross-entity search

### Auth / Access
- Better Auth: email+password + OAuth (GitHub, Google, Discord, generic OIDC)
- Workspace invitations
- Instance-level config

### Notifications
- Notification table + per-user/workspace/project preference overrides
- Scheduler — due-date + webhook reminders, cron every 5 min
- Email (React Email templates)
- WebSocket live push — Redis pub/sub for multi-instance, in-memory fallback for single-instance

### Integrations (plugin system, one folder each)
GitHub, GitLab, Gitea, Slack, Discord, Telegram, Generic Webhook

### Other
- MCP server — expose Kaneo as AI-agent tools
- Storage — asset/attachment uploads
- Permissions package — shared RBAC logic
- i18n — multi-language UI

## Structure

```
apps/
  api/   Hono + Drizzle + Postgres. src/{feature}/ per domain (controllers/, index.ts routes, schemas.ts).
         database/schema.ts + relations.ts central. index.ts mounts all under /api.
  web/   React 19 + Vite + TanStack Router/Query + Zustand + Tailwind v4.
         File-based routes/ (_authenticated/* logged-in area, public-project.$id share links,
         device/mcp.authorize OAuth device flow).
  site/  Next.js marketing/docs (port 3001)
  docs/  Mintlify docs site (mdx)
packages/
  email        React Email templates + preview server
  libs         shared utilities
  mcp          MCP server package
  permissions  shared RBAC logic
  typescript-config
```

Root: pnpm + TurboRepo monorepo, single `.env`, Biome lint/format, Husky + commitlint (Conventional Commits).
