"use client";

import { Flag } from "lucide-react";
import { useState, useTransition } from "react";
import { reportAction } from "@/app/actions/safety";
import { Button } from "@/components/ui/Button";

const REASONS = [
  ["spam", "Spam"],
  ["fake", "Made-up results"],
  ["harassment", "Harassment"],
  ["inappropriate", "Inappropriate"],
  ["other", "Something else"],
] as const;

export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: "user" | "quest" | "comment" | "game"; targetId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("fake");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p role="status" className="m-0 text-sm text-muted">{done}</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 text-sm font-semibold text-muted hover:text-text">
        <Flag size={14} aria-hidden />
        {label}
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 rounded-xl bg-sea-deep p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await reportAction({ targetType, targetId, reason, details: details || undefined });
          setDone(res.ok ? "Thanks. An admin will take a look." : res.error);
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Why are you reporting this?
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="h-10 rounded-lg bg-sea px-2 font-normal text-text">
          {REASONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Details (optional)
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={2} className="rounded-lg bg-sea p-2 font-normal text-text" />
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          Send report
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
