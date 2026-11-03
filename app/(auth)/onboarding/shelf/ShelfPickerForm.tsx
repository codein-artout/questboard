"use client";

import { useTransition } from "react";
import { saveOnboardingShelf } from "@/app/actions/onboarding";

/** Submits the picker, then navigates on the client. */
export function ShelfPickerForm({ children }: { children: React.ReactNode }) {
  const [, start] = useTransition();
  return (
    <form
      className="mt-6"
      action={(fd) =>
        start(async () => {
          const r = await saveOnboardingShelf(fd);
          window.location.assign(r.redirectTo);
        })
      }
    >
      {children}
    </form>
  );
}
