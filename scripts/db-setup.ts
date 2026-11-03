/**
 * pnpm db:setup — make sure a PostgreSQL database is reachable and migrated.
 *
 * 1. Creates .env from .env.example when missing.
 * 2. If DATABASE_URL points at localhost and nothing answers, starts a private
 *    cluster under .data/postgres using the PostgreSQL binaries on this machine
 *    (PATH, /usr/lib/postgresql/<v>/bin, Homebrew). Running as root, it uses the
 *    `postgres` system user because PostgreSQL refuses to run as root.
 * 3. Applies migrations (`prisma migrate deploy`, or `migrate reset` with --reset).
 *
 * Flags: --reset (drop and recreate the schema), --start-only (just start the db).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, copyFileSync, mkdirSync, readdirSync, chownSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));

function log(msg: string) {
  console.log(`[db:setup] ${msg}`);
}

if (!existsSync(path.join(root, ".env"))) {
  copyFileSync(path.join(root, ".env.example"), path.join(root, ".env"));
  log("Created .env from .env.example");
}
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  // Env may come from the shell instead.
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.");
  process.exit(1);
}
const parsed = new URL(url);
const host = parsed.hostname;
const port = Number(parsed.port || 5432);
const user = decodeURIComponent(parsed.username || "postgres");
const password = decodeURIComponent(parsed.password || "");
const database = parsed.pathname.replace(/^\//, "") || "postgres";

function canConnect(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(1500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function findPgBin(): string | null {
  const candidates: string[] = [];
  const which = spawnSync("sh", ["-c", "command -v pg_ctl"], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) candidates.push(path.dirname(which.stdout.trim()));
  for (const base of ["/usr/lib/postgresql", "/usr/local/opt", "/opt/homebrew/opt"]) {
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base).sort().reverse()) {
      const dir = base === "/usr/lib/postgresql" ? path.join(base, entry, "bin") : path.join(base, entry, "bin");
      if (entry.startsWith("postgresql") || base === "/usr/lib/postgresql") candidates.push(dir);
    }
  }
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "pg_ctl")) && existsSync(path.join(dir, "initdb"))) return dir;
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function startLocalCluster(): Promise<boolean> {
  const bin = findPgBin();
  if (!bin) return false;
  const dataDir = path.join(root, ".data", "postgres");
  const sockDir = path.join(root, ".data", "pgsock");
  const logFile = path.join(root, ".data", "postgres.log");
  mkdirSync(path.join(root, ".data"), { recursive: true });
  mkdirSync(sockDir, { recursive: true });
  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
  let pgUid: number | null = null;
  let pgGid: number | null = null;
  if (isRoot) {
    const id = spawnSync("id", ["-u", "postgres"], { encoding: "utf8" });
    const gid = spawnSync("id", ["-g", "postgres"], { encoding: "utf8" });
    if (id.status !== 0) {
      log("Running as root and there is no `postgres` user to run the server as.");
      return false;
    }
    pgUid = Number(id.stdout.trim());
    pgGid = Number(gid.stdout.trim());
  }
  const run = (cmd: string, cmdArgs: string[]) => {
    if (isRoot) return execFileSync("runuser", ["-u", "postgres", "--", cmd, ...cmdArgs], { stdio: "inherit" });
    return execFileSync(cmd, cmdArgs, { stdio: "inherit" });
  };
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
    log(`Initialising a local PostgreSQL cluster in .data/postgres (${bin})`);
    mkdirSync(dataDir, { recursive: true });
    if (isRoot && pgUid !== null && pgGid !== null) {
      chownSync(dataDir, pgUid, pgGid);
    }
    run(path.join(bin, "initdb"), ["-D", dataDir, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C"]);
  }
  if (isRoot && pgUid !== null && pgGid !== null) {
    chownSync(sockDir, pgUid, pgGid);
    chownSync(path.join(root, ".data"), pgUid, pgGid);
  }
  log(`Starting PostgreSQL on port ${port}`);
  run(path.join(bin, "pg_ctl"), [
    "-D",
    dataDir,
    "-l",
    logFile,
    "-o",
    `-p ${port} -k ${sockDir} -c listen_addresses=127.0.0.1`,
    "-w",
    "start",
  ]);
  for (let i = 0; i < 20 && !(await canConnect()); i++) await sleep(250);
  // Create the role and database from the URL.
  const psql = path.join(bin, "psql");
  const sql = (q: string) =>
    run(psql, ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qc", q]);
  const esc = (s: string) => s.replace(/'/g, "''");
  sql(
    `DO $$BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${esc(user)}') THEN CREATE ROLE "${user}" LOGIN SUPERUSER PASSWORD '${esc(password)}'; END IF; END$$;`,
  );
  const exists = spawnSync(
    isRoot ? "runuser" : psql,
    [
      ...(isRoot ? ["-u", "postgres", "--", psql] : []),
      "-h",
      "127.0.0.1",
      "-p",
      String(port),
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-tAc",
      `SELECT 1 FROM pg_database WHERE datname='${esc(database)}'`,
    ],
    { encoding: "utf8" },
  );
  if (!exists.stdout.includes("1")) sql(`CREATE DATABASE "${database}" OWNER "${user}"`);
  return true;
}

async function main() {
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!(await canConnect())) {
    if (!local) {
      console.error(`Can't reach PostgreSQL at ${host}:${port}. Check DATABASE_URL.`);
      process.exit(1);
    }
    const started = await startLocalCluster();
    if (!started || !(await canConnect())) {
      console.error(
        [
          `Nothing is listening on ${host}:${port} and no local PostgreSQL binaries were found.`,
          "Install PostgreSQL 14+ (e.g. `brew install postgresql@16` or `apt install postgresql`),",
          "or start one with Docker: `docker compose up -d db`, then run `pnpm db:setup` again.",
        ].join("\n"),
      );
      process.exit(1);
    }
  } else {
    log(`PostgreSQL is reachable at ${host}:${port}`);
  }
  if (args.has("--start-only")) return;
  const prismaArgs = args.has("--reset")
    ? ["prisma", "migrate", "reset", "--force", "--skip-seed"]
    : ["prisma", "migrate", "deploy"];
  log(`Running ${prismaArgs.join(" ")}`);
  execFileSync("pnpm", ["exec", ...prismaArgs], { stdio: "inherit", cwd: root, env: process.env });
  execFileSync("pnpm", ["exec", "tsx", "scripts/catalog-sync.ts"], { stdio: "inherit", cwd: root, env: process.env });
  log("Database ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
