"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createGuildAction } from "@/app/actions/guilds";
import { Button } from "@/components/ui/Button";

export function CreateGuild() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2 rounded-2xl bg-panel p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createGuildAction({ name, description: description || null });
          if (!r.ok) setErr(r.error);
          else router.push(`/g/${r.data.slug}`);
        });
      }}
    >
      <h2 className="m-0 text-[15px] font-bold">Start a guild</h2>
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Name
        <input required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Thursday Crew" className="h-11 rounded-xl bg-sea px-3 text-sm text-text" />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        About (optional)
        <input maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} className="h-11 rounded-xl bg-sea px-3 text-sm text-text" />
      </label>
      {err ? <p role="alert" className="m-0 text-sm text-danger">{err}</p> : null}
      <Button type="submit" disabled={pending}>
        Create guild
      </Button>
    </form>
  );
}
