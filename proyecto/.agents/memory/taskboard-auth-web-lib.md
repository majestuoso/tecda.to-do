---
name: TaskBoard replit-auth-web lib fix
description: How to handle import.meta.env in a shared lib that is compiled by tsc (not vite).
---

The `lib/replit-auth-web` package is compiled by `tsc --build` as a composite lib, NOT by Vite. So `import.meta.env` has no type and `vite/client` can't be added as a `types` entry (vite isn't installed as a dev dep in the lib).

**Why:** TypeScript's `ImportMeta` doesn't have an `env` property in non-Vite contexts.

**How to apply:** Cast through `unknown` first:
```typescript
const base = ((import.meta as unknown as Record<string, unknown>).env as Record<string, string> | undefined)?.BASE_URL ?? "/";
```
Do NOT add `"types": ["vite/client"]` to the lib's tsconfig — it'll fail at build time.
