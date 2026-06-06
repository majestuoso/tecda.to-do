# TaskBoard

A Trello-like project management web app with Kanban boards, card management, file attachments, member invitations, and Replit Auth.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/taskboard run dev` — run the frontend (port 25222, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — build shared libs (run before leaf typecheck if libs changed)
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — session signing key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, wouter, @tanstack/react-query, shadcn/ui, Tailwind CSS
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Replit Auth (OIDC PKCE) via `@workspace/replit-auth-web` (browser) and `authMiddleware`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- File uploads: multer, stored at `artifacts/api-server/uploads/`, served at `/api/attachments/:filename`
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `lib/api-zod/src/generated/` — generated Zod schemas (from codegen)
- `lib/api-client-react/src/generated/` — generated React Query hooks (from codegen)
- `lib/db/src/schema/` — Drizzle DB schema (boards.ts, cards.ts, auth.ts)
- `lib/replit-auth-web/` — browser auth hook (`useAuth`) calling `/api/auth/user`
- `artifacts/api-server/src/routes/` — Express route handlers (auth, boards, cards, health)
- `artifacts/api-server/src/lib/auth.ts` — session helpers + `getUserInfo(userId)`
- `artifacts/api-server/src/middlewares/authMiddleware.ts` — sets `req.user` from session cookie
- `artifacts/taskboard/src/` — React frontend (pages: dashboard, board, card-detail, members)

## Architecture decisions

- Contract-first: OpenAPI spec → Orval codegen → typed hooks + Zod validators. No manual hand-coding of API types.
- File uploads bypass Orval codegen (multer multipart can't be described cleanly); handled directly in `cards.ts`.
- Auth flow: Replit OIDC PKCE → `/api/callback` stores session in DB → `sid` cookie → `authMiddleware` hydrates `req.user`.
- `getUserInfo(userId)` queries the `users` table (populated at first login) to get username, profile image, etc.
- Invitations are by Replit username; invited user must have logged in at least once (so they exist in `users` table).
- Board max is 20 members, enforced server-side on invitation creation.

## Product

- Dashboard: lists all boards the user is a member of + pending invitations
- Board view: Kanban with To Do / In Progress / Done columns; drag-and-drop cards
- Card detail: title, description, status, assignee (from board members), due date, file attachments, external links
- Members view: list board members, invite by Replit username, remove members
- Activity log: last 20 actions per board

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The `users` table is populated only after a user logs in via Replit Auth for the first time. Invitations will fail for users who have never logged in.
- Run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` if you change any lib package, otherwise the api-server will see stale declarations.
- File upload attachments are stored on disk (`artifacts/api-server/uploads/`). They are NOT persisted across deployments — use object storage for production persistence.
- `@workspace/api-server` does not have zod as a direct dependency. Use inline validation or import validators from `@workspace/api-zod`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
