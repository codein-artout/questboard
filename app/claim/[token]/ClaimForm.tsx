"use client";

import { useState, useTransition } from "react";
import { claimGuestAction } from "@/app/actions/claim";
import { Button } from "@/components/ui/Button";

export function ClaimForm({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-6"
      action={(fd) =>
        start(async () => {
          try {
            const r = await claimGuestAction(fd);
            window.location.assign(r.redirectTo);
          } catch {
            setError("That claim didn’t work. The link may already have been used.");
          }
        })
      }
    >
      <input type="hidden" name="token" value={token} />
      <Button type="submit" size="lg" disabled={pending}>
        Claim my quests
      </Button>
      {error ? <p role="alert" className="mt-2 text-sm text-danger">{error}</p> : null}
    </form>
  );
}
