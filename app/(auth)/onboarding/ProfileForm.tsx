"use client";

import { useActionState, useEffect, useState } from "react";
import { saveProfile, type ProfileState } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/Button";
import { PlayerDisc } from "@/components/game/PlayerDisc";
import { PLAYER_COLOR_KEYS, PLAYER_COLORS, type PlayerColorKey } from "@/lib/colors";
import { cn } from "@/lib/cn";

const input = "h-12 rounded-xl bg-sea-deep px-4 text-base font-medium text-text shadow-[inset_0_0_0_1px_#1C4462] placeholder:text-muted focus:shadow-[inset_0_0_0_2px_#F5C84B] focus:outline-none";

export function ProfileForm({ initial }: { initial: { handle: string; displayName: string; color: PlayerColorKey } }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, null);
  const [color, setColor] = useState<PlayerColorKey>(initial.color);
  const [name, setName] = useState(initial.displayName);
  const [tz, setTz] = useState("");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  useEffect(() => {
    if (state?.redirectTo) window.location.assign(state.redirectTo);
  }, [state]);
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="timezone" value={tz} />
      <div className="flex items-center gap-4">
        <PlayerDisc player={{ name: name || "?", color }} size={68} className="shadow-[0_0_0_3px_#0F2E45,0_0_0_6px_#F5C84B]" />
        <p className="m-0 text-sm text-muted">This disc is you on every quest, scoreboard and crown.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Your name
        <input name="displayName" required maxLength={30} value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="nickname" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Handle
        <span className="flex items-center gap-1 text-muted">
          <span aria-hidden>@</span>
          <input name="handle" required defaultValue={initial.handle} pattern="[a-zA-Z0-9_]{3,20}" aria-invalid={state?.field === "handle"} aria-describedby="handle-help" className={cn(input, "flex-1")} autoCapitalize="none" autoComplete="username" />
        </span>
        <span id="handle-help" className="text-xs font-normal text-muted">
          Your island lives at /u/your-handle. Letters, numbers and underscores.
        </span>
      </label>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-sm font-semibold">Player color</legend>
        <div className="flex flex-wrap gap-2.5">
          {PLAYER_COLOR_KEYS.map((c) => (
            <label key={c} className="relative cursor-pointer">
              <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} className="peer sr-only" />
              <span
                className="block h-11 w-11 rounded-full peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold"
                style={{ background: PLAYER_COLORS[c].bg, boxShadow: [c === "white" ? "inset 0 0 0 2px #1B1F3B" : "", color === c ? "0 0 0 3px #0F2E45, 0 0 0 5px #F5C84B" : ""].filter(Boolean).join(",") || undefined }}
              />
              <span className="sr-only">{c}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {state?.error ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
