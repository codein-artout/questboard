/**
 * Upserts data/catalog.json into the Game table. Keeps admin terrain overrides
 * and wikidata ids, never touches custom games, and links expansions to their
 * base games. Run by `pnpm db:setup`; safe to run any time.
 */
import "./env";
import { db } from "../lib/db";
import { loadCatalog, toGameRow } from "../lib/catalog/load";

async function main() {
  const entries = loadCatalog();
  const existing = new Map((await db.game.findMany({ select: { id: true, slug: true, source: true } })).map((g) => [g.slug, g]));
  let created = 0;
  let updated = 0;
  // Chunked transactions: fast, and no single giant statement.
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    await db.$transaction(
      chunk.map((e) => {
        const row = toGameRow(e);
        const prev = existing.get(e.slug);
        if (prev) {
          updated++;
          return db.game.update({ where: { slug: e.slug }, data: { ...row, source: "catalog" } });
        }
        created++;
        return db.game.create({ data: { ...row, source: "catalog" } });
      }),
    );
  }
  const ids = new Map((await db.game.findMany({ select: { id: true, slug: true } })).map((g) => [g.slug, g.id]));
  const links = entries.filter((e) => e.baseGame);
  await db.$transaction(
    links.map((e) => db.game.update({ where: { slug: e.slug }, data: { baseGameId: ids.get(e.baseGame!) ?? null } })),
  );
  console.log(`[catalog] ${created} created, ${updated} updated, ${links.length} expansions linked`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
