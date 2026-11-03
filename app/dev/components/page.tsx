import type { Metadata } from "next";
import { TERRAIN_INFO, TERRAINS, TIERS } from "@/game/config";
import { HexTile, MiniHex, TileBadge } from "@/components/game/HexTile";
import { TierLadder } from "@/components/game/TierLadder";
import { CrownCard } from "@/components/game/CrownCard";
import { DiscStack, PlayerDisc } from "@/components/game/PlayerDisc";
import { XPBar } from "@/components/game/XPBar";
import { RewardChip } from "@/components/game/RewardChip";
import { TileCard } from "@/components/game/TileCard";
import { QuestCard, type QuestCardData } from "@/components/game/QuestCard";
import { Button, ButtonLink, Pill } from "@/components/ui/Button";
import { EmptyState, Panel, PanelHeading, PanelRow, StatGrid } from "@/components/ui/Panel";
import { PLAYER_COLOR_KEYS } from "@/lib/colors";
import { LogHexIcon } from "@/components/shell/icons";
import { IslandDemo } from "./IslandDemo";

export const metadata: Metadata = { title: "Components" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-display text-3xl font-black">{title}</h2>
      {children}
    </section>
  );
}

const quest = (o: Partial<QuestCardData>): QuestCardData => ({
  id: "demo",
  gameName: "Cascadia",
  terrain: "forest",
  when: "9:40 PM",
  meta: "Thursday Crew at Priya’s, 48 min",
  party: [
    { name: "Priya", color: "green", winner: true },
    { name: "Ciao", color: "blue", winner: false },
    { name: "Ravi", color: "red", winner: false },
    { name: "Meera", color: "yellow", winner: false },
  ],
  outcome: "Priya wins by 3",
  rewards: [
    { tone: "gold", label: "+90 XP" },
    { tone: "plain", label: "New land: Cascadia" },
    { tone: "title", label: "Bridesmaid 4 of 5" },
  ],
  status: "confirmed",
  imported: false,
  ...o,
});

export default function ComponentsPage() {
  return (
    <main id="main" className="mx-auto max-w-[1200px] px-4 py-8 desk:px-8">
      <h1 className="m-0 font-display text-5xl font-black">Components</h1>
      <p className="text-muted">Every shared component and state, built from the mockups.</p>

      <Section title="Color tokens">
        <div className="grid grid-cols-2 gap-2 desk:grid-cols-6">
          {[
            ["sea", "#0F2E45"], ["sea-deep", "#0A2236"], ["panel", "#17405E"], ["panel-rule", "#23506F"], ["sea-line", "#1C4462"], ["outline", "#2D5878"],
            ["text", "#EAF2F7"], ["text-muted", "#9DB7C9"], ["gold", "#F5C84B"], ["title-bg", "#2A2353"], ["title-ink", "#C7B5F2"],
          ].map(([n, c]) => (
            <div key={n} className="rounded-xl bg-panel p-2">
              <div className="h-10 rounded-lg" style={{ background: c, boxShadow: "inset 0 0 0 1px #2D5878" }} />
              <div className="mt-1 text-xs font-bold">{n}</div>
              <div className="text-xs text-muted">{c}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 desk:grid-cols-6">
          {TERRAINS.map((t) => (
            <div key={t} className="rounded-xl bg-panel p-2">
              <div className="flex h-10 overflow-hidden rounded-lg">
                <div className="flex-1" style={{ background: TERRAIN_INFO[t].face }} />
                <div className="flex-1" style={{ background: TERRAIN_INFO[t].side }} />
                <div className="flex-1" style={{ background: TERRAIN_INFO[t].ink }} />
              </div>
              <div className="mt-1 text-xs font-bold">{TERRAIN_INFO[t].name}</div>
              <div className="text-xs text-muted">{TERRAIN_INFO[t].genre}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <p className="m-0 font-display text-7xl font-black leading-[0.9]">Cascadia</p>
        <p className="font-display text-3xl font-extrabold">Big Shoulders Display 600–900 for names, scores and XP</p>
        <p className="text-base">Archivo 400–800 for UI and body text. Tabular numerals: 1,234,567.</p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Complete quest</Button>
          <Button variant="secondary">Propose for Thursday</Button>
          <Button variant="outline-gold">Propose</Button>
          <Button variant="ghost">Change</Button>
          <Button variant="danger">Delete account</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <ButtonLink href="/dev/components" className="h-[52px] px-6 text-base">
            <LogHexIcon />
            Log a quest
          </ButtonLink>
          <span className="hex flex h-[62px] w-[62px] items-center justify-center bg-gold text-sea" aria-hidden>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill active>Friends</Pill>
          <Pill>Thursday Crew</Pill>
          <Pill>Mine</Pill>
        </div>
      </Section>

      <Section title="Hex tiles">
        <div className="flex flex-wrap gap-4">
          {TERRAINS.map((t) => (
            <div key={t} className="flex flex-wrap items-end gap-2 rounded-2xl bg-sea-deep p-3">
              {TIERS.map((tier) => (
                <HexTile key={tier.tier} width={64} kind="game" terrain={t} tier={tier.tier} text={tier.name} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-5 rounded-2xl bg-sea-deep p-4">
          <figure className="m-0 text-center"><HexTile width={76} kind="game" terrain="forest" tier={4} text="Wingspan" fullName crown /><figcaption className="text-xs text-muted">crown, full name</figcaption></figure>
          <figure className="m-0 text-center"><HexTile width={76} kind="game" terrain="peaks" tier={2} text="T. Mars" selected /><figcaption className="text-xs text-muted">selected</figcaption></figure>
          <figure className="m-0 text-center"><HexTile width={76} kind="ghost" terrain="meadow" tier={0} text="Sky Team" /><figcaption className="text-xs text-muted">ghost (pending)</figcaption></figure>
          <figure className="m-0 text-center"><HexTile width={76} kind="game" terrain="reef" tier={1} text="Wave" pendingTierUp /><figcaption className="text-xs text-muted">ghost tier-up</figcaption></figure>
          <figure className="m-0 text-center"><HexTile width={76} kind="shelf" /><figcaption className="text-xs text-muted">shelf</figcaption></figure>
          <figure className="m-0 text-center"><HexTile width={76} kind="shelf" selected /><figcaption className="text-xs text-muted">shelf selected</figcaption></figure>
          <figure className="m-0 text-center"><HexTile width={76} kind="unexplored" /><figcaption className="text-xs text-muted">unexplored</figcaption></figure>
          <figure className="m-0 text-center"><HexTile width={50} kind="game" terrain="marsh" tier={1} text="BotC" /><figcaption className="text-xs text-muted">phone 50px</figcaption></figure>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-6">
          <TileBadge terrain="forest" tier={5} width={150} />
          <TileBadge terrain="forest" tier={5} width={104} />
          <TileBadge terrain="forest" tier={4} width={64} halo />
          <TileBadge tier={0} width={64} kind="shelf" />
          {TERRAINS.map((t) => <MiniHex key={t} terrain={t} tier={3} />)}
          <MiniHex kind="shelf" />
        </div>
      </Section>

      <Section title="Tier ladder">
        <div className="grid gap-3 desk:grid-cols-2">
          {[1, 3, 5, 6].map((tier) => (
            <Panel key={tier} className="px-5 py-[18px]">
              <TierLadder tier={tier} terrain={tier === 3 ? "peaks" : "forest"} />
            </Panel>
          ))}
          <Panel className="px-2.5 py-3.5"><TierLadder tier={5} terrain="forest" size="sm" /></Panel>
          <Panel className="space-y-3 p-4">
            {[0, 1, 4, 6].map((tier) => <TierLadder key={tier} tier={tier} terrain="meadow" variant="bars" />)}
          </Panel>
        </div>
      </Section>

      <Section title="Crown card">
        <div className="grid gap-3 desk:grid-cols-2">
          <CrownCard scope="Thursday Crew crown" headline="Priya holds it with 104" detail="Your best is 98. Six points to take it." />
          <CrownCard scope="Friends crown" headline="You hold it with 112" detail="Arjun is 3 behind." layout="row" />
          <CrownCard scope="Thursday Crew crown" headline="Held by the guild" detail="3 wins at difficulty 5." layout="row" />
          <CrownCard scope="Friends crown" headline="No crown yet" detail="Win rate needs 5 plays each." layout="row" />
        </div>
      </Section>

      <Section title="Player discs">
        <div className="flex flex-wrap items-center gap-3">
          {PLAYER_COLOR_KEYS.map((c) => <PlayerDisc key={c} player={{ name: c, color: c }} size={30} />)}
          <PlayerDisc player={{ name: "Guest" }} size={30} />
          <PlayerDisc player={{ name: "Priya", color: "green" }} size={30} ring edge="#0F2E45" />
          <PlayerDisc player={{ name: "Ciao", color: "blue" }} size={68} className="shadow-[0_0_0_3px_#0F2E45,0_0_0_6px_#F5C84B]" />
          <DiscStack players={PLAYER_COLOR_KEYS.map((c) => ({ name: c, color: c }))} winners={["green"]} edge="#0F2E45" />
          <DiscStack players={[...PLAYER_COLOR_KEYS, ...PLAYER_COLOR_KEYS].map((c, i) => ({ name: `${c}${i}`, color: c }))} max={6} edge="#0F2E45" />
        </div>
      </Section>

      <Section title="XP bar and reward chips">
        <div className="grid gap-4 desk:grid-cols-2">
          <Panel className="p-4"><XPBar into={2340} forNext={3750} level={14} /></Panel>
          <Panel className="p-4"><XPBar into={2430} forNext={3750} gain={90} level={14} thick /></Panel>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <RewardChip tone="gold">+90 XP</RewardChip>
          <RewardChip tone="gold">+240 XP raid</RewardChip>
          <RewardChip>New land: Cascadia</RewardChip>
          <RewardChip>Wingspan rises to a Keep</RewardChip>
          <RewardChip tone="rare">Took the Wingspan crown</RewardChip>
          <RewardChip tone="title">Title: Survived the Galaxy</RewardChip>
        </div>
      </Section>

      <Section title="Tile card">
        <div className="grid gap-3 desk:grid-cols-3">
          <TileCard data={{ kind: "game", name: "Cascadia", terrain: "forest", tier: 5, tierLine: "Citadel, 52 plays", next: "48 more plays to a Wonder.", crown: "Priya holds the friends crown with 104. Your best is 98.", href: "#", cta: "Open Cascadia" }} />
          <TileCard data={{ kind: "shelf", name: "Sky Team", tier: 0, tierLine: "On your shelf, never played", next: "First play earns a bounty of 80 XP or more.", crown: "Propose it for Thursday’s vote.", href: "#", cta: "Propose for Thursday" }} />
          <TileCard data={{ kind: "unexplored", name: "Unexplored", tier: 0, tierLine: "Room to grow", next: "Play a new game and it lands next to games like it.", crown: "", href: "#", cta: "See your shelf" }} />
        </div>
        <TileCard className="mt-3 max-w-[390px]" layout="compact" data={{ kind: "game", name: "Cascadia", terrain: "forest", tier: 5, tierLine: "Citadel, 52 plays.", next: "48 to Wonder.", crown: "Priya holds the crown", href: "#", cta: "Open" }} />
      </Section>

      <Section title="Quest cards">
        <div className="grid gap-2.5 desk:grid-cols-3">
          <QuestCard quest={quest({})} />
          <QuestCard quest={quest({ gameName: "Twilight Imperium", terrain: "peaks", when: "Sat", meta: "Raid with Arjun, Kabir and Ravi, 5 h 20 min", outcome: "Kabir wins", status: "pending", rewards: [{ tone: "gold", label: "+240 XP raid" }, { tone: "title", label: "Title: Survived the Galaxy" }] })} />
          <QuestCard quest={quest({ gameName: "The Crew", terrain: "meadow", when: "Sun", meta: "Thursday Crew, mission 23", outcome: "Won together", status: "disputed", party: quest({}).party.map((p) => ({ ...p, winner: false })), rewards: [] })} />
        </div>
      </Section>

      <Section title="Panels">
        <div className="grid gap-3 desk:grid-cols-2">
          <StatGrid stats={[{ value: 98, label: "personal best" }, { value: 86, label: "average score" }, { value: "42%", label: "wins" }, { value: 31, label: "hosted by you" }]} />
          <Panel className="py-1.5">
            <PanelHeading aside="Campaign XP">Autumn campaign, week 6 of 10</PanelHeading>
            <PanelRow>Priya · 640</PanelRow>
            <PanelRow>Ciao · 610</PanelRow>
          </Panel>
          <EmptyState title="Your island is waiting" action={<Button>Log your first quest</Button>}>Import your play history or log your first quest.</EmptyState>
        </div>
      </Section>

      <Section title="Island map">
        <IslandDemo />
      </Section>
    </main>
  );
}
