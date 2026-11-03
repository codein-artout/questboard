"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCampaignAction, leaveGuildAction, removeMemberAction } from "@/app/actions/guilds";
import { Button } from "@/components/ui/Button";

export function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={url} aria-label={label} className="h-10 min-w-0 flex-1 rounded-lg bg-sea px-3 text-xs text-muted" onFocus={(e) => e.currentTarget.select()} />
      <Button size="sm" variant="secondary" onClick={async () => { await navigator.clipboard.writeText(url).catch(() => undefined); setCopied(true); }}>
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function StartCampaign({ guildId }: { guildId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [weeks, setWeeks] = useState(10);
  const [where, setWhere] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startT] = useTransition();
  if (!open) return <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Start a campaign</Button>;
  const input = "h-10 rounded-lg bg-sea px-3 text-sm text-text";
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startT(async () => {
          const r = await createCampaignAction({ guildId, name, startsAt: new Date(`${start}T00:00:00`).toISOString(), weeks, finaleLocation: where });
          if (!r.ok) setErr(r.error);
          else {
            setOpen(false);
            router.refresh();
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 text-[13px] text-muted">Name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Winter campaign" className={input} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[13px] text-muted">Starts<input type="date" required value={start} onChange={(e) => setStart(e.target.value)} className={input} /></label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">Weeks<input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className={input} /></label>
      </div>
      <label className="flex flex-col gap-1 text-[13px] text-muted">Finale at<input required value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Ciao’s" className={input} /></label>
      {err ? <p role="alert" className="m-0 text-sm text-danger">{err}</p> : null}
      <div className="flex gap-2"><Button type="submit" size="sm" disabled={pending}>Start</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
    </form>
  );
}

export function MemberRemove({ guildId, userId, name }: { guildId: string; userId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await removeMemberAction(guildId, userId); router.refresh(); })} className="text-xs font-bold text-muted hover:text-danger" aria-label={`Remove ${name} from the guild`}>
      Remove
    </button>
  );
}

export function LeaveGuild({ guildId }: { guildId: string }) {
  const [sure, setSure] = useState(false);
  const [pending, start] = useTransition();
  if (!sure) return <Button variant="ghost" size="sm" onClick={() => setSure(true)}>Leave guild</Button>;
  return (
    <span className="flex items-center gap-2">
      <Button variant="danger" size="sm" disabled={pending} onClick={() => start(async () => { await leaveGuildAction(guildId); })}>Leave</Button>
      <Button variant="ghost" size="sm" onClick={() => setSure(false)}>Stay</Button>
    </span>
  );
}
