import { GUEST_COLOR, PLAYER_COLORS, type PlayerColorKey } from "@/lib/colors";
import { cn } from "@/lib/cn";

export type DiscPlayer = { name: string; color?: PlayerColorKey | null };

/**
 * A player's identity disc: their color and initial. `ring` adds a gold winner
 * ring, `edge` sets the color of the gap that separates overlapping discs.
 */
export function PlayerDisc({
  player,
  size = 28,
  ring = false,
  edge,
  className,
  label = false,
}: {
  player: DiscPlayer;
  size?: number;
  ring?: boolean;
  edge?: string;
  className?: string;
  /** Expose the name to assistive tech (otherwise decorative). */
  label?: boolean;
}) {
  const c = player.color ? PLAYER_COLORS[player.color] : GUEST_COLOR;
  const shadows: string[] = [];
  if (edge) shadows.push(`0 0 0 2px ${edge}`);
  if (player.color === "white") shadows.push("inset 0 0 0 2px #1B1F3B");
  if (ring) shadows.push(`0 0 0 ${edge ? 4 : 2}px #F5C84B`);
  const initial = (player.name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-extrabold", size >= 40 && "font-display font-black", className)}
      style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size >= 40 ? Math.round(size * 0.47) : Math.max(9, Math.round(size * 0.39)), boxShadow: shadows.join(", ") || undefined }}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label ? player.name : undefined}
      title={player.name}
    >
      {initial}
    </span>
  );
}

/** Overlapping discs for a party. */
export function DiscStack({ players, size = 28, edge = "#17405E", winners = [], max = 8, label }: { players: DiscPlayer[]; size?: number; edge?: string; winners?: string[]; max?: number; label?: string }) {
  const shown = players.slice(0, max);
  const extra = players.length - shown.length;
  return (
    <span className="inline-flex items-center" role="img" aria-label={label ?? players.map((p) => p.name).join(", ")}>
      {shown.map((p, i) => (
        <PlayerDisc key={`${p.name}-${i}`} player={p} size={size} edge={edge} ring={winners.includes(p.name)} className="-mr-1.5" />
      ))}
      {extra > 0 ? (
        <span className="ml-2.5 text-xs font-bold text-muted" aria-hidden>
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
