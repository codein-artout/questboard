import Link from "next/link";
import type { Terrain } from "@/game/config";
import { TERRAIN_INFO } from "@/game/config";
import type { PlayerColorKey } from "@/lib/colors";
import { DiscStack } from "./PlayerDisc";
import { RewardChip, type RewardTone } from "./RewardChip";
import { TerrainIcon } from "./TerrainIcon";

export type QuestCardData = {
  id: string;
  gameName: string;
  terrain: Terrain;
  when: string;
  meta: string;
  party: { name: string; color: PlayerColorKey | null; winner: boolean }[];
  outcome: string;
  rewards: { tone: RewardTone; label: string }[];
  status: "pending" | "confirmed" | "disputed";
  imported: boolean;
};

/** A quest in the log: terrain hex, game, when, party discs, outcome and reward chips. */
export function QuestCard({ quest, footer, headingLevel = 2 }: { quest: QuestCardData; footer?: React.ReactNode; headingLevel?: 2 | 3 }) {
  const t = TERRAIN_INFO[quest.terrain];
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="rounded-2xl bg-panel p-3.5">
      <div className="flex items-start gap-3">
        <div aria-hidden className="relative h-[52px] w-11 shrink-0">
          <div className="hex absolute inset-x-0 top-[5px] h-[47px]" style={{ background: t.side }} />
          <div className="hex absolute inset-x-0 top-0 flex h-[47px] items-center justify-center" style={{ background: t.face }}>
            <TerrainIcon terrain={quest.terrain} color={t.ink} />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <H className="m-0 truncate font-display text-2xl font-extrabold leading-[1.05]">
              <Link href={`/quests/${quest.id}`} className="text-text no-underline hover:text-gold-hover">
                {quest.gameName}
              </Link>
            </H>
            <span className="whitespace-nowrap text-xs text-muted">{quest.when}</span>
          </div>
          <p className="m-0 mt-0.5 text-[13px] text-muted">{quest.meta}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <DiscStack players={quest.party} winners={quest.party.filter((p) => p.winner).map((p) => p.name)} />
        <span className="ml-1.5 text-[15px] font-bold">{quest.outcome}</span>
      </div>
      {quest.rewards.length || quest.status !== "confirmed" ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quest.status === "pending" ? <RewardChip tone="plain" className="border border-outline bg-transparent">Waiting for confirmation</RewardChip> : null}
          {quest.status === "disputed" ? <RewardChip tone="plain" className="border border-danger bg-transparent text-danger">Disputed</RewardChip> : null}
          {quest.rewards.map((r, i) => (
            <RewardChip key={i} tone={r.tone}>
              {r.label}
            </RewardChip>
          ))}
        </div>
      ) : null}
      {footer}
    </article>
  );
}
