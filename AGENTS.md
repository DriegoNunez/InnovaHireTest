# Notes for coding agents

- Next.js 16: middleware is `proxy.ts`, route `params`/`searchParams` are Promises, and docs for this exact version live in `node_modules/next/dist/docs/`. Read them before using an API you are unsure about.
- All database writes go through `src/lib/services/*`. Services take a `DB` handle and an actor so they can be tested with in-memory PGlite (`createPgliteDb()`); keep Next.js imports (`next/headers`, `server-only`) out of services.
- Throw `ServiceError` for anything the user should see; server actions convert it with `attempt()`.
- Permissions are defined once in `src/lib/auth/permissions.ts`.
- After changing `src/db/schema.ts`, run `npm run db:generate` and commit the migration.
- Run `npm run lint && npm test && npm run build` before committing.
