/**
 * Loads .env for tsx scripts. Prisma only auto-loads .env if it existed when
 * `prisma generate` ran (at install time), which isn't true on a fresh clone
 * where `pnpm db:setup` creates .env afterwards. Import this first.
 */
import path from "node:path";

try {
  process.loadEnvFile(path.resolve(__dirname, "..", ".env"));
} catch {
  // No .env: rely on the environment.
}
