import type { Metadata } from "next";
import Link from "next/link";
import { ShelfPickerForm } from "./ShelfPickerForm";
import { Button } from "@/components/ui/Button";
import { MiniHex } from "@/components/game/HexTile";
import { db } from "@/lib/db";
import { OWNERSHIP_PICKER_SLUGS } from "@/lib/onboarding";
import { requireUser } from "@/lib/session";
import type { Terrain } from "@/game/config";

export const metadata: Metadata = { title: "Which of these do you own?" };

export default async function ShelfPicker() {
  const viewer = await requireUser();
  const [games, owned] = await Promise.all([
    db.game.findMany({ where: { slug: { in: OWNERSHIP_PICKER_SLUGS } }, select: { id: true, slug: true, name: true, terrain: true, terrainOverride: true } }),
    db.shelfItem.findMany({ where: { userId: viewer.id }, select: { gameId: true } }),
  ]);
  const ownedSet = new Set(owned.map((o) => o.gameId));
  const order = new Map(OWNERSHIP_PICKER_SLUGS.map((s, i) => [s, i]));
  games.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
  return (
    <div>
      <p className="m-0 text-[15px] font-bold text-gold">Step 3 of 3</p>
      <h1 className="m-0 mt-1 font-display text-5xl font-black leading-none">Which of these do you own?</h1>
      <p className="mt-3 text-[15px] text-muted">Owned games you haven’t played float offshore as “?” tiles, each with a bounty for its first play.</p>
      <ShelfPickerForm>
        <fieldset className="m-0 border-0 p-0">
          <legend className="sr-only">Games you own</legend>
          <div className="grid grid-cols-2 gap-2 desk:grid-cols-3">
            {games.map((g) => (
              <label key={g.id} className="group relative flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl bg-panel px-3 py-2 text-sm font-semibold has-[:checked]:bg-panel-rule has-[:checked]:shadow-[inset_0_0_0_1.5px_#F5C84B] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold">
                <input type="checkbox" name="gameId" value={g.id} defaultChecked={ownedSet.has(g.id)} className="sr-only" />
                <MiniHex terrain={(g.terrainOverride ?? g.terrain) as Terrain} tier={1} size={24} />
                <span className="leading-tight">{g.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg">
            Save and see your island
          </Button>
          <Link href="/">Skip</Link>
        </div>
        <p className="mt-3 text-[13px] text-muted">You can add any game from the catalog on your shelf later.</p>
      </ShelfPickerForm>
    </div>
  );
}
