import { ButtonLink } from "@/components/ui/Button";
import { HexTile } from "@/components/game/HexTile";
import { hexToPixel } from "@/game/hex";
import type { Terrain } from "@/game/config";

const DEMO: [number, number, Terrain, number, string][] = [
  [0, 0, "forest", 5, "Cascadia"], [1, 0, "forest", 4, "Wingspan"], [0, 1, "meadow", 4, "Crew"], [-1, 0, "tundra", 3, "Azul"],
  [0, -1, "reef", 3, "Codenames"], [1, -1, "forest", 3, "T. Mars"], [-1, 1, "peaks", 3, "Catan"], [-1, -1, "tundra", 2, "Patchwork"],
  [2, -1, "forest", 2, "Everdell"], [1, 1, "meadow", 2, "Spirit"], [-2, 1, "peaks", 2, "Root"], [2, -2, "marsh", 1, "BotC"],
];

/** Signed-out home. */
export function Landing() {
  return (
    <main id="main" className="mx-auto grid max-w-[1100px] items-center gap-10 px-4 py-12 desk:grid-cols-2 desk:px-8 desk:py-20">
      <div>
        <h1 className="m-0 font-display text-6xl font-black leading-[0.92] desk:text-7xl">Every game you play is a tile on your island</h1>
        <p className="mt-5 max-w-md text-[17px] text-muted">
          Replays build a tile up from Outpost to Wonder. Your group fights over crowns. Unplayed games on your shelf float offshore with a bounty. Teach a game and it spreads to your friends’ islands.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <ButtonLink href="/signin" size="lg">
            Start your island
          </ButtonLink>
          <ButtonLink href="/signin" size="lg" variant="secondary">
            Sign in
          </ButtonLink>
        </div>
      </div>
      <div aria-hidden className="relative mx-auto h-[360px] w-[400px] max-w-full">
        {DEMO.map(([q, r, t, tier, name]) => {
          const p = hexToPixel({ q, r }, 72);
          return <HexTile key={name} width={72} kind="game" terrain={t} tier={tier} text={name} crown={name === "Wingspan"} className="absolute" style={{ left: 200 + p.x - 36, top: 160 + p.y - 41 }} />;
        })}
      </div>
    </main>
  );
}
