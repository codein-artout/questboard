import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/config";
import { plural } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { PageLayout, PageTitle } from "@/components/shell/PageLayout";
import { Panel, PanelHeading } from "@/components/ui/Panel";
import { buttonClass } from "@/components/ui/Button";
import { PlayerDisc } from "@/components/game/PlayerDisc";
import { CopyLink } from "@/components/guild/GuildAdmin";
import { DeleteAccount, ProfileSettings, SignOut, UnblockButton } from "@/components/settings/SettingsForms";
import { displayName } from "@/server/social";

export const metadata: Metadata = { title: "Settings" };

export default async function Settings() {
  const viewer = await requireUser();
  const [blocks, guests] = await Promise.all([
    db.block.findMany({ where: { blockerId: viewer.id }, include: { blocked: { select: { id: true, displayName: true, handle: true, color: true } } } }),
    db.guest.findMany({ where: { ownerId: viewer.id }, include: { _count: { select: { participations: true } }, claimedBy: { select: { displayName: true, handle: true } } }, orderBy: { name: "asc" } }),
  ]);
  return (
    <PageLayout
      asideLabel="Your data"
      aside={
        <>
          <Panel className="flex flex-col gap-3 p-4">
            <h2 className="m-0 text-[15px] font-bold">Your data</h2>
            <a href="/api/export" download className={buttonClass("secondary", "md")}>
              Download my data (JSON)
            </a>
            <a href="/api/island/export" download className={buttonClass("secondary", "md")}>
              Export my island (PNG)
            </a>
            <Link href="/import" className={buttonClass("secondary", "md")}>
              Import play history
            </Link>
          </Panel>
          <Panel className="p-4">
            <SignOut />
          </Panel>
        </>
      }
    >
      <PageTitle sub={viewer.email ?? undefined}>Settings</PageTitle>
      <Panel className="mt-4 p-5">
        <ProfileSettings initial={{ displayName: displayName(viewer), color: viewer.color, privacy: viewer.privacy, emailNotifications: viewer.emailNotifications, timezone: viewer.timezone }} />
      </Panel>
      <Panel className="mt-3 flex flex-col gap-2 p-5">
        <h2 className="m-0 text-[15px] font-bold">Invite friends</h2>
        <p className="m-0 text-sm text-muted">Anyone who signs up with your link becomes your friend.</p>
        <CopyLink url={`${appUrl()}/invite/${viewer.inviteCode}`} label="Your invite link" />
      </Panel>
      <Panel className="mt-3 py-1.5">
        <PanelHeading aside={plural(guests.length, "guest")}>Your guests</PanelHeading>
        {guests.length ? (
          guests.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-panel-rule px-4 py-2.5 text-sm">
              <span>
                <span className="font-semibold">{g.name}</span> <span className="text-muted">{plural(g._count.participations, "quest")}</span>
              </span>
              {g.claimedBy ? <span className="text-xs text-muted">Claimed by {displayName(g.claimedBy)}</span> : <CopyLink url={`${appUrl()}/claim/${g.claimToken}`} label={`Claim link for ${g.name}`} />}
            </div>
          ))
        ) : (
          <p className="m-0 border-t border-panel-rule px-4 py-3 text-sm text-muted">Guests you add to quests show up here with a link they can use to claim their history.</p>
        )}
      </Panel>
      <Panel className="mt-3 py-1.5">
        <PanelHeading>Blocked players</PanelHeading>
        {blocks.length ? (
          blocks.map((b) => (
            <div key={b.blockedId} className="flex items-center gap-3 border-t border-panel-rule px-4 py-2.5">
              <PlayerDisc player={{ name: displayName(b.blocked), color: b.blocked.color }} size={26} />
              <span className="flex-1 text-sm font-semibold">{displayName(b.blocked)}</span>
              <UnblockButton userId={b.blockedId} name={displayName(b.blocked)} />
            </div>
          ))
        ) : (
          <p className="m-0 border-t border-panel-rule px-4 py-3 text-sm text-muted">Nobody. Block someone from their profile.</p>
        )}
      </Panel>
      <Panel className="mt-3 p-5 shadow-[inset_0_0_0_1.5px_#F08A7E]">
        <h2 className="m-0 mb-2 text-[15px] font-bold">Delete account</h2>
        <DeleteAccount handle={viewer.handle!} />
      </Panel>
    </PageLayout>
  );
}
