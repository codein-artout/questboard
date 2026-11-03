# Deploying Questboard (Vercel + Neon)

Questboard is a standard Next.js app with a PostgreSQL database. The intended
production setup is **Vercel** for the app and cron jobs and **Neon** for
Postgres. Nothing here has been deployed yet; this is the checklist.

## 1. Database (Neon)

1. Create a Neon project (Postgres 16). The `pg_trgm` extension is available
   on Neon and is created by the first migration.
2. Copy two connection strings:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`, with
     `?sslmode=require&pgbouncer=true&connect_timeout=15`.
   - **Direct** → `DIRECT_URL`, with `?sslmode=require`. Prisma uses it for migrations.

## 2. App (Vercel)

1. Import the repository in Vercel. Framework: Next.js. `vercel.json` sets the
   build command, which runs `prisma migrate deploy`, syncs `data/catalog.json`
   into the `Game` table, then builds.
2. Set environment variables (Production and Preview), see `.env.example`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled URL |
| `DIRECT_URL` | Neon direct URL |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://your-domain` |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain` |
| `AUTH_TRUST_HOST` | `true` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend key and a verified sender (needed for magic links in production) |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | optional; redirect URI `https://your-domain/api/auth/callback/google` |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | photo storage (e.g. Cloudflare R2). Without them uploads go to local disk, which does not persist on Vercel |
| `CRON_SECRET` | a long random string; Vercel Cron sends it automatically |
| `ADMIN_EMAILS` | comma-separated admin emails |
| `ENABLE_DEV_LOGIN` | **leave unset** in production |

3. Cron jobs (from `vercel.json`):
   - `/api/cron/auto-confirm` every 15 minutes: confirms quests after 48 hours without a dispute.
   - `/api/cron/imports` every 5 minutes: resumes import jobs a serverless function didn't finish.
   Both check `Authorization: Bearer $CRON_SECRET`.

## 3. After the first deploy

- Make yourself admin by adding your email to `ADMIN_EMAILS` (or set `role = 'ADMIN'` on your user).
- Rebuild derived state at any time with `DATABASE_URL=... pnpm game:recompute` from a trusted machine.
- Do **not** run `pnpm db:seed` against production: it deletes `@questboard.local` demo users and their data.

## Notes

- Imports process in the background after the upload response (`after()`), in
  chunks with progress saved, so a timed-out function resumes on the next poll or cron run.
- OG images are generated on demand by `next/og` (Node runtime) and only for public islands and quests.
- Recompute runs per connected group of players and takes a Postgres advisory
  lock, so concurrent quest updates never interleave.
