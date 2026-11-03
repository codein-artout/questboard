import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { PLAYER_COLORS } from "@/lib/colors";
import { db } from "@/lib/db";
import { possessive, tzOffsetMinutes } from "@/lib/format";
import { getViewer } from "@/lib/session";
import { PageLayout } from "@/components/shell/PageLayout";
import { Panel, StatGrid } from "@/components/ui/Panel";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { PlayerDisc } from "@/components/game/PlayerDisc";
import { TileBadge } from "@/components/game/HexTile";
import { QuestCard } from "@/components/game/QuestCard";
import { TitlesGrid } from "@/components/character/TitlesGrid";
import { FriendControls } from "@/components/character/FriendControls";
import { ReportButton } from "@/components/quests/ReportButton";
import { PrivateIsland } from "@/components/island/PrivateIsland";
import { classBlurb, classTerrains, getCharacter } from "@/server/queries/character";
import { resolveProfile } from "@/server/queries/profile";
import { feedQuests, toCards } from "@/server/queries/quests";
import { displayName } from "@/server/social";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const u = await db.user.findUnique({ where: { handle }, select: { displayName: true, handle: true, privacy: true } });
  if (!u) return { title: "Player" };
  return { title: displayName(u), robots: u.privacy === "PUBLIC" ? undefined : { index: false } };
}

export default async function CharacterSheet({ params }: Props) {
  const { handle } = await params;
  const viewer = await getViewer();
  const p = await resolveProfile(handle, viewer);
  if (!p) notFound();
  if (!p.canView) return <PrivateIsland name={displayName(p.user)} />;
  const c = await getCharacter(p.user.id, viewer?.id ?? null);
  const s = c.stats;
  const tz = viewer ? tzOffsetMinutes(viewer.timezone) : 0;
  const { quests } = await feedQuests(viewer, { kind: "user", userId: p.user.id }, null, 3);
  const cards = await toCards(quests, viewer?.id ?? null, tz);
  const terrains = classTerrains(s?.classKey ?? "none");
  const hostedRecords = await db.houseRecord.count({ where: { hostUserId: p.user.id } });
  let friendState: "none" | "friends" | "sent" | "received" = "none";
  let requestId: string | undefined;
  if (viewer && !c.isSelf) {
    const f = await db.friendship.findFirst({ where: { OR: [{ requesterId: viewer.id, addresseeId: p.user.id }, { requesterId: p.user.id, addresseeId: viewer.id }] } });
    if (f?.status === "accepted") friendState = "friends";
    else if (f) {
      friendState = f.requesterId === viewer.id ? "sent" : "received";
      requestId = f.id;
    }
  }
  const maxGames = Math.max(1, ...c.regions.map((r) => r.games));
  const colorName = PLAYER_COLORS[c.user.color].name;

  return (
    <PageLayout
      asideLabel="Island and quests"
      aside={
        <>
          <Link href={c.isSelf ? "/" : `/u/${c.user.handle}/island`} className="block rounded-2xl bg-panel p-4 text-text no-underline hover:bg-panel-rule hover:text-text">
            <div className="text-[13px] text-muted">Island</div>
            <div className="font-display text-[22px] font-black leading-[1.1]">{c.isSelf ? "Your island" : `${possessive(c.user.name)} island`}</div>
            <div className="text-[13px] text-muted">{s ? `${s.gamesExplored} tiles, ${s.totalPlays} plays` : "No tiles yet"}</div>
          </Link>
          {c.isSelf ? (
            <a href="/api/island/export" download className={buttonClass("secondary", "md", "w-full")}>
              <Download size={16} aria-hidden />
              Export my island as a PNG
            </a>
          ) : null}
          {hostedRecords ? (
            <Link href={`/u/${c.user.handle}/records`} className="block rounded-2xl bg-panel p-4 text-text no-underline hover:bg-panel-rule hover:text-text">
              <div className="text-[13px] text-muted">Landmark</div>
              <div className="font-display text-[22px] font-black leading-[1.1]">House records at {c.isSelf ? "your" : possessive(c.user.name)} place</div>
              <div className="text-[13px] text-muted">{hostedRecords} records across the games played there</div>
            </Link>
          ) : null}
          {cards.length ? (
            <section aria-labelledby="recent-q">
              <h2 id="recent-q" className="mb-2 ml-1 mt-2 text-[15px] font-bold">
                Recent quests
              </h2>
              <div className="flex flex-col gap-2">
                {cards.map((q) => (
                  <QuestCard key={q.id} quest={q} headingLevel={3} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      }
    >
      <section className="flex items-center gap-4">
        <PlayerDisc player={{ name: c.user.name, color: c.user.color }} size={68} className="shadow-[0_0_0_3px_#0F2E45,0_0_0_6px_#F5C84B]" />
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[34px] font-black leading-none desk:text-[40px]">{c.user.name}</h1>
          <p className="m-0 mt-1 text-sm text-muted">
            {c.displayedTitle ? <span className="font-semibold text-title-ink">{c.displayedTitle}. </span> : null}
            Level {s?.level ?? 1}, plays {colorName}
          </p>
        </div>
      </section>
      {viewer && !c.isSelf ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <FriendControls userId={c.user.id} name={c.user.name} state={friendState} requestId={requestId} />
          <ReportButton targetType="user" targetId={c.user.id} />
        </div>
      ) : null}

      <Panel className="mt-[18px] flex items-center gap-3.5 p-4">
        {terrains[0] ? <TileBadge terrain={terrains[0]} tier={3} width={56} /> : <div aria-hidden className="hex h-[64px] w-14 shrink-0 bg-sea" />}
        <div>
          <div className="font-display text-[26px] font-extrabold leading-none">{s?.className ?? "The Wanderer"}</div>
          <div className="mt-1 text-sm leading-snug text-muted">{classBlurb(s?.classKey ?? "none", c.isSelf)}</div>
        </div>
      </Panel>

      <StatGrid
        className="mt-2.5"
        colsClass="grid-cols-3 desk:grid-cols-6"
        size="sm"
        label="Headline stats"
        stats={[
          { value: s?.hIndex ?? 0, label: "h-index" },
          { value: s?.gamesExplored ?? 0, label: "games explored" },
          { value: s?.totalPlays ?? 0, label: "total plays" },
          { value: `${s?.wonders ?? 0}/${s?.citadels ?? 0}`, label: "wonders/citadels" },
          { value: s?.crownsHeld ?? 0, label: "crowns held" },
          { value: s?.peopleTaught ?? 0, label: "people taught" },
        ]}
      />

      <section className="mt-5" aria-labelledby="regions-h">
        <h2 id="regions-h" className="mb-2.5 ml-1 text-[15px] font-bold">
          Regions
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {c.regions.map((r) => (
            <li key={r.terrain} className="grid grid-cols-[18px_92px_1fr_72px] items-center gap-2.5 px-1">
              <span aria-hidden className="hex h-[18px] w-4" style={{ background: r.color }} />
              <span className="text-sm font-semibold">{r.name}</span>
              <div aria-hidden className="h-2 rounded-full bg-panel">
                <div className="h-2 rounded-full" style={{ width: `${(r.games / maxGames) * 100}%`, background: r.color }} />
              </div>
              <span className="text-right text-[13px] text-muted">{r.games === 1 ? "1 game" : `${r.games} games`}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6" aria-labelledby="titles-h">
        <h2 id="titles-h" className="mb-2.5 ml-1 text-[15px] font-bold">
          Titles <span className="text-xs font-medium text-muted">{c.progress.filter((t) => t.earned).length} earned</span>
        </h2>
        <TitlesGrid titles={c.progress} displayed={c.user.displayedTitleId} canChoose={c.isSelf} />
      </section>

      <section className="mt-6" aria-labelledby="nemesis-h">
        <h2 id="nemesis-h" className="mb-2.5 ml-1 text-[15px] font-bold">
          Nemesis
        </h2>
        {c.nemesis ? (
          <Link href={`/u/${c.user.handle}/vs/${c.nemesis.handle}`} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-2xl bg-panel px-3.5 py-3 text-text no-underline hover:bg-panel-rule hover:text-text">
            <PlayerDisc player={{ name: c.nemesis.name, color: c.nemesis.color }} size={40} />
            <div>
              <div className="text-base font-bold">{c.nemesis.name}</div>
              <div className="text-[13px] text-muted">
                {c.nemesis.wins === c.nemesis.losses
                  ? `Dead level at ${c.nemesis.wins} each across ${c.nemesis.meetings} quests`
                  : c.nemesis.losses > c.nemesis.wins
                    ? `${c.nemesis.name} leads ${c.nemesis.losses} to ${c.nemesis.wins} across ${c.nemesis.meetings} quests`
                    : `${c.isSelf ? "You lead" : `${c.user.name} leads`} ${c.nemesis.wins} to ${c.nemesis.losses} across ${c.nemesis.meetings} quests`}
              </div>
            </div>
            <span className="font-display text-[26px] font-black">
              {c.nemesis.wins}–{c.nemesis.losses}
            </span>
          </Link>
        ) : (
          <Panel className="p-4 text-sm text-muted">No nemesis yet. It’s whoever you meet most often (5+ times in 90 days) with the closest record.</Panel>
        )}
      </section>
      {c.isSelf ? (
        <div className="mt-5">
          <ButtonLink href="/settings" variant="secondary" size="sm">
            Edit profile and privacy
          </ButtonLink>
        </div>
      ) : null}
    </PageLayout>
  );
}

