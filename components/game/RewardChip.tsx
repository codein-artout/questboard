import { cn } from "@/lib/cn";

export type RewardTone = "gold" | "plain" | "rare" | "title";

const TONES: Record<RewardTone, string> = {
  gold: "bg-gold text-sea",
  plain: "bg-sea text-text",
  rare: "bg-marsh text-white",
  title: "bg-title-bg text-title-ink",
};

/** A small pill for what a quest earned: "+90 XP", "New land: Cascadia", "Title: Bridesmaid". */
export function RewardChip({ tone = "plain", children, className }: { tone?: RewardTone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-7 items-center rounded-full px-2.5 text-xs font-bold", TONES[tone], className)}>{children}</span>;
}
