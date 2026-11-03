import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CONFIRMATION, TERRAIN_INFO, type Terrain } from "@/game/config";
import { ordinal } from "@/game/places";
import type { QuestOutcomePayload } from "@/game/types";
import { db } from "@/lib/db";
import { clockTime, duration, fmtScore, relativeDay, tzOffsetMinutes } from "@/lib/format";
import { canConfirmQuest, canDisputeQuest, canEditQuest, canInteract, canViewQuest, type QuestAccess } from "@/lib/permissions";
import { getViewer, toViewer } from "@/lib/session";
import { storage } from "@/lib/storage";
import { BackLink, PageLayout } from "@/components/shell/PageLayout";
import { Panel, PanelHeading } from "@/components/ui/Panel";
import { PlayerDisc } from "@/components/game/PlayerDisc";
import { QuestCard } from "@/components/game/QuestCard";
import { TileBadge } from "@/components/game/HexTile";
import { Reactions } from "@/components/quests/Reactions";
import { Comments } from "@/components/quests/Comments";
import { ConfirmDispute, OwnerActions, WithdrawDispute } from "@/components/quests/QuestActions";
import { ReportButton } from "@/components/quests/ReportButton";
import { questInclude, toCards } from "@/server/queries/quests";
import { displayName, relationBetween } from "@/server/social";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  return db.quest.findUnique({
    where: { id },
    include: {
      ...questInclude,
      confirmations: { include: { user: { select: { id: true, displayName: true, handle: true } } } },
      comments: { orderBy: { createdAt: "asc" }, take: 200, include: { user: { select: { id: true, displayName: true, handle: true, color: true } } } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const q = await db.quest.findUnique({ where: { id }, select: { game: { select: { name: true } }, loggedBy: { select: { privacy: true } } } });
  if (!q) return { title: "Quest" };
  return { title: `${q.game.name} quest`, robots: q.loggedBy?.privacy === "PUBLIC" ? undefined : { index: false } };
}

export default async function QuestDetail({ params }: Props) {
  const { id } = await params;
  const [viewer, q] = await Promise.all([getViewer(), load(id)]);
  if (!q) notFound();
  const v = toViewer(viewer);
  const access: QuestAccess = {
    loggedById: q.loggedById,
    loggerPrivacy: q.loggedBy?.privacy ?? "PRIVATE",
    participantUserIds: q.participants.map((p) => p.userId).filter((x): x is string => !!x),
    guildId: q.guildId,
    status: q.status,
    source: q.source,
    createdAt: q.createdAt,
  };
  const rel = q.loggedById ? await relationBetween(viewer?.id ?? null, q.loggedById) : { isSelf: false, isFriend: false, blocked: false };
  if (!canViewQuest(v, access, rel)) notFound();
  const tz = viewer ? tzOffsetMinutes(viewer.timezone) : 0;
  const [card] = await toCards([q], viewer?.id ?? null, tz);
  const responded = q.confirmations.some((c) => c.userId === viewer?.id && !c.resolvedAt);
  const canConfirm = canConfirmQuest(v, access, responded);
  const canDispute = canDisputeQuest(v, access, new Date()) && !q.confirmations.some((c) => c.userId === viewer?.id && c.kind === "dispute" && !c.resolvedAt);
  const myDispute = q.confirmations.find((c) => c.userId === viewer?.id && c.kind === "dispute" && !c.resolvedAt);
  const openDisputes = q.confirmations.filter((c) => c.kind === "dispute" && !c.resolvedAt);
  const confirmedBy = q.confirmations.filter((c) => c.kind === "confirm");
  const interact = canInteract(v, true, rel);
  const outcomes = new Map(q.outcomes.map((o) => [o.userId, o]));
  const mine = viewer ? outcomes.get(viewer.id) : undefined;
  const minePayload = mine?.payload as unknown as QuestOutcomePayload | undefined;
  const terrain = (q.game.terrainOverride ?? q.game.terrain) as Terrain;
  const t = TERRAIN_INFO[terrain];
  const waiting = q.participants.filter((p) => p.userId && p.userId !== q.loggedById && !q.confirmations.some((c) => c.userId === p.userId && !c.resolvedAt)).map((p) => card!.party[q.participants.indexOf(p)]!.name);
  const autoAt = q.autoConfirmAt ?? new Date(q.createdAt.getTime() + CONFIRMATION.autoConfirmHours * 3600 * 1000);

  return (
    <PageLayout
      asideLabel="About this game"
      aside={
        <>
          <Link href={viewer ? `/games/${q.game.slug}` : `/quests/${q.id}`} className="flex items-center gap-3.5 rounded-2xl bg-panel p-4 text-text no-underline hover:bg-panel-rule hover:text-text">
            <TileBadge terrain={terrain} tier={1} width={48} />
            <div>
              <div className="font-display text-2xl font-black leading-none">{q.game.name}</div>
              <div className="mt-1 text-[13px] text-muted">{t.name} region</div>
            </div>
          </Link>
          {viewer ? (
            <div className="px-1">
              <ReportButton targetType="quest" targetId={q.id} label="Report this quest" />
            </div>
          ) : null}
        </>
      }
    >
      {viewer ? <BackLink href="/quests">Quest log</BackLink> : null}
      <QuestCard quest={card!} headingLevel={2} footer={<Reactions questId={q.id} reactions={card!.reactions} comments={card!.comments} canReact={interact} showComments={false} />} />
      <p className="m-0 mt-2 px-1 text-[13px] text-muted">
        {relativeDay(q.playedAt, new Date(), tz)} at {clockTime(q.playedAt, tz)}
        {q.durationMin ? `, ${duration(q.durationMin)}` : ""}
        {q.location ? `, ${q.location}` : ""}
        {q.source === "import" ? ". Imported from a play history file." : "."}
      </p>

      {q.status === "pending" ? (
        <Panel className="mt-3 p-4 shadow-[inset_0_0_0_1.5px_#2D5878]">
          <h2 className="m-0 text-[15px] font-bold">Waiting for confirmation</h2>
          <p className="m-0 mt-1 text-sm text-muted">
            {waiting.length ? `Waiting on ${waiting.join(", ")}. ` : ""}It confirms itself {relativeDay(autoAt, new Date(), tz).toLowerCase()} at {clockTime(autoAt, tz)} if nobody disputes it.
          </p>
          {canConfirm || canDispute ? <ConfirmDispute questId={q.id} canConfirm={canConfirm} canDispute={canDispute} /> : null}
        </Panel>
      ) : null}
      {q.status === "disputed" ? (
        <Panel className="mt-3 p-4 shadow-[inset_0_0_0_1.5px_#F08A7E]">
          <h2 className="m-0 text-[15px] font-bold">Disputed</h2>
          {openDisputes.map((d) => (
            <p key={d.id} className="m-0 mt-1 text-sm text-muted">
              {displayName(d.user)}: “{d.reason}”
            </p>
          ))}
          <p className="m-0 mt-1 text-sm text-muted">Nothing counts until it’s resolved. {q.loggedById === viewer?.id ? "Edit the quest to fix it and it goes back for confirmation." : ""}</p>
          {myDispute ? <WithdrawDispute questId={q.id} /> : null}
        </Panel>
      ) : null}
      {q.status === "confirmed" && canDispute ? (
        <Panel className="mt-3 p-4">
          <p className="m-0 text-sm text-muted">Confirmed{confirmedBy.length ? ` by ${confirmedBy.map((c) => displayName(c.user)).join(", ")}` : " automatically"}. Spotted a mistake?</p>
          <ConfirmDispute questId={q.id} canConfirm={false} canDispute />
        </Panel>
      ) : null}

      <section aria-labelledby="party-h" className="mt-3 overflow-hidden rounded-2xl bg-panel">
        <h2 id="party-h" className="m-0 px-5 pb-2 pt-4 text-base font-bold">
          The party
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th scope="col" className="px-5 py-2 font-semibold">Place</th>
              <th scope="col" className="px-2 py-2 font-semibold">Player</th>
              <th scope="col" className="px-2 py-2 text-right font-semibold">Score</th>
              <th scope="col" className="py-2 pl-2 pr-5 text-right font-semibold">XP</th>
            </tr>
          </thead>
          <tbody>
            {q.participants.map((p, i) => {
              const o = p.userId ? outcomes.get(p.userId) : undefined;
              const name = card!.party[i]!.name;
              return (
                <tr key={p.id} className="border-t border-panel-rule">
                  <td className={p.place === 1 ? "px-5 py-2.5 font-display text-lg font-extrabold text-gold" : "px-5 py-2.5 font-display text-lg font-extrabold text-muted"}>{q.coop ? (q.coopWin ? "Won" : q.coopWin === false ? "Lost" : "") : p.place ? ordinal(p.place) : "–"}</td>
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-2">
                      <PlayerDisc player={{ name, color: p.user?.color ?? null }} size={26} ring={!q.coop && p.place === 1} edge="#17405E" />
                      {p.user?.handle && name !== "A player" ? <Link href={`/u/${p.user.handle}`} className="font-semibold text-text no-underline hover:text-gold-hover">{name}</Link> : <span className="font-semibold">{name}</span>}
                      {!p.userId ? <span className="text-xs text-muted">guest</span> : null}
                      {p.team ? <span className="text-xs text-muted">{p.team}</span> : null}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right font-display text-lg font-extrabold">{p.score !== null ? fmtScore(p.score) : ""}</td>
                  <td className="py-2.5 pl-2 pr-5 text-right text-muted">{o ? `${o.status === "pending" ? "~" : ""}+${o.xp}` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {minePayload ? (
        <Panel className="mt-3 py-1.5">
          <PanelHeading aside={mine?.status === "pending" ? "Projected" : undefined}>Your rewards</PanelHeading>
          <ul className="m-0 list-none p-0">
            {minePayload.lines.map((l, i) => (
              <li key={i} className="flex justify-between border-t border-panel-rule px-4 py-2 text-sm">
                <span>{l.label}</span>
                <span className={l.amount > 0 ? "font-display text-lg font-extrabold text-gold" : "font-display text-lg font-extrabold text-muted"}>{l.amount > 0 ? `+${l.amount}` : `−${Math.abs(l.amount)}`}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-panel-rule px-4 py-2.5">
            <Link href={`/quests/${q.id}/complete`} className="text-sm font-bold">
              Replay the reward screen
            </Link>
          </div>
        </Panel>
      ) : null}

      {q.notes || q.photoKey ? (
        <Panel className="mt-3 p-4">
          {q.notes ? <p className="m-0 whitespace-pre-wrap text-sm">{q.notes}</p> : null}
          {q.photoKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={storage().publicUrl(q.photoKey)} alt={`Photo from the ${q.game.name} quest`} className="mt-3 max-h-[420px] w-full rounded-xl object-cover" />
          ) : null}
        </Panel>
      ) : null}

      {viewer && canEditQuest(v, access) ? (
        <div className="mt-3">
          <OwnerActions questId={q.id} />
        </div>
      ) : null}

      <Comments
        questId={q.id}
        canComment={interact}
        comments={q.comments.map((c) => ({
          id: c.id,
          name: displayName(c.user),
          color: c.user.color,
          body: c.body,
          when: relativeDay(c.createdAt, new Date(), tz),
          canDelete: !!viewer && (c.userId === viewer.id || q.loggedById === viewer.id || viewer.isAdmin),
        }))}
      />
    </PageLayout>
  );
}
