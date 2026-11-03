"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAccountAction, saveSettingsAction } from "@/app/actions/account";
import { unblockUserAction } from "@/app/actions/safety";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { PLAYER_COLOR_KEYS, PLAYER_COLORS, type PlayerColorKey } from "@/lib/colors";

const input = "h-11 rounded-xl bg-sea px-3 text-sm font-semibold text-text";

export function ProfileSettings({ initial }: { initial: { displayName: string; color: PlayerColorKey; privacy: string; emailNotifications: boolean; timezone: string } }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  const zones = [...new Set(["UTC", initial.timezone, ...supported])];
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSettingsAction(s);
          setMsg(r.ok ? "Saved." : r.error);
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Name
        <input value={s.displayName} maxLength={30} required onChange={(e) => setS({ ...s, displayName: e.target.value })} className={input} />
      </label>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-[13px] text-muted">Player color</legend>
        <div className="flex flex-wrap gap-2">
          {PLAYER_COLOR_KEYS.map((c) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="color" value={c} checked={s.color === c} onChange={() => setS({ ...s, color: c })} className="peer sr-only" />
              <span className="block h-10 w-10 rounded-full peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold" style={{ background: PLAYER_COLORS[c].bg, boxShadow: [c === "white" ? "inset 0 0 0 2px #1B1F3B" : "", s.color === c ? "0 0 0 3px #17405E, 0 0 0 5px #F5C84B" : ""].filter(Boolean).join(",") || undefined }} />
              <span className="sr-only">{c}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-[13px] text-muted">Who can see your island, profile and quests</legend>
        {[
          ["PUBLIC", "Anyone with the link", "Your island, tiles and quests can be shared publicly."],
          ["FRIENDS", "Friends only", "Friends and guild mates (for guild quests)."],
          ["PRIVATE", "Only me", "People you play with still see the quests you share."],
        ].map(([v, l, d]) => (
          <label key={v} className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2">
            <input type="radio" name="privacy" value={v} checked={s.privacy === v} onChange={() => setS({ ...s, privacy: v! })} className="mt-1 h-4 w-4 accent-[#F5C84B]" />
            <span>
              <span className="block text-sm font-semibold">{l}</span>
              <span className="block text-xs text-muted">{d}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={s.emailNotifications} onChange={(e) => setS({ ...s, emailNotifications: e.target.checked })} className="h-4 w-4 accent-[#F5C84B]" />
        Email me about confirmations, crowns, tier-ups, titles, game nights and campaign finales
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Time zone
        <select value={s.timezone} onChange={(e) => setS({ ...s, timezone: e.target.value })} className={input}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </label>
      {msg ? <p role="status" className="m-0 text-sm text-muted">{msg}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}

export function UnblockButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { await unblockUserAction(userId); router.refresh(); })} aria-label={`Unblock ${name}`}>
      Unblock
    </Button>
  );
}

export function DeleteAccount({ handle }: { handle: string }) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await deleteAccountAction(value);
          if (r && !r.ok) setErr(r.error);
        });
      }}
    >
      <p className="m-0 text-sm text-muted">This deletes your island, titles, shelf and account for good. Quests you played with others stay for them, with you shown as a former player.</p>
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Type your handle ({handle}) to confirm
        <input value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" className={input} />
      </label>
      {err ? <p role="alert" className="m-0 text-sm text-danger">{err}</p> : null}
      <div>
        <Button type="submit" variant="danger" disabled={pending || value.trim().toLowerCase() !== handle}>
          Delete my account
        </Button>
      </div>
    </form>
  );
}

export function SignOut() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="secondary">
        Sign out
      </Button>
    </form>
  );
}
