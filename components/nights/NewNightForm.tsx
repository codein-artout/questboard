"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createNightAction } from "@/app/actions/nights";
import { Button } from "@/components/ui/Button";

const input = "h-11 rounded-xl bg-sea px-3 text-sm font-semibold text-text";

export function NewNightForm({ guilds, defaultGuild, campaigns }: { guilds: { id: string; name: string }[]; defaultGuild?: string; campaigns: { id: string; guildId: string; name: string }[] }) {
  const router = useRouter();
  const [guildId, setGuildId] = useState(defaultGuild ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [location, setLocation] = useState("My place");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const guildCampaigns = campaigns.filter((c) => c.guildId === guildId);
  return (
    <form
      className="mt-5 flex flex-col gap-3 rounded-2xl bg-panel p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createNightAction({ guildId: guildId || null, title: title || null, startsAt: new Date(`${date}T${time}`).toISOString(), location, notes: notes || null, campaignId: campaignId || null });
          if (!r.ok) setError(r.error);
          else router.push(`/nights/${r.data.id}`);
        });
      }}
    >
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        For
        <select value={guildId} onChange={(e) => { setGuildId(e.target.value); setCampaignId(""); }} className={input}>
          <option value="">My friends</option>
          {guilds.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          Date
          <input type="date" required value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          Time
          <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Where
        <input required maxLength={80} value={location} onChange={(e) => setLocation(e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Name (optional)
        <input maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Thursday at mine" className={input} />
      </label>
      {guildCampaigns.length ? (
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          Campaign finale
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={input}>
            <option value="">Not a finale</option>
            {guildCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} finale (double XP)
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Notes
        <textarea maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-xl bg-sea p-3 text-sm text-text" />
      </label>
      {error ? <p role="alert" className="m-0 text-sm text-danger">{error}</p> : null}
      <Button type="submit" size="lg" disabled={pending}>
        Plan game night
      </Button>
    </form>
  );
}
