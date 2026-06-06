---
name: TaskBoard DB lib exports and stale declarations
description: How @workspace/db exports tables and the gotcha around stale type declarations.
---

`lib/db/src/index.ts` does `export * from "./schema"`, and `schema/index.ts` re-exports `./auth`, `./boards`, `./cards`. All tables are available as named exports from `@workspace/db`.

**Why stale declarations happen:** When `tsc --build` hasn't run yet (or lib source changed), the `dist/` declarations are stale. The api-server picks up the OLD declarations and reports missing exports.

**How to apply:** Always run `pnpm run typecheck:libs` before running `pnpm --filter @workspace/api-server run typecheck` whenever any lib source changes. The api-server's tsc points at `lib/db/dist/index.d.ts`, not the source.
