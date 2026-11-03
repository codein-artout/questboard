"use client";

import { useActionState } from "react";
import { signInWithEmail, type SignInState } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInWithEmail, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!state?.error}
          aria-describedby={state?.error ? "email-error" : undefined}
          className="h-12 rounded-xl bg-sea-deep px-4 text-base font-medium text-text shadow-[inset_0_0_0_1px_#1C4462] placeholder:text-muted focus:shadow-[inset_0_0_0_2px_#F5C84B] focus:outline-none"
        />
      </label>
      {state?.error ? (
        <p id="email-error" role="alert" className="m-0 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
