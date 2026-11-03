import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { RateLimitError } from "@/lib/rate-limit";
import { AuthError, NotFoundError, UserError } from "@/lib/errors";

export { AuthError, NotFoundError, UserError };

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };


/** Runs an action body and turns known errors into friendly results. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof ZodError) {
      const flat = err.flatten();
      return { ok: false, error: err.issues[0]?.message ?? "Check the form.", fieldErrors: flat.fieldErrors as Record<string, string[]> };
    }
    if (err instanceof AuthError || err instanceof RateLimitError || err instanceof NotFoundError || err instanceof UserError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "That already exists." };
    }
    // Next.js uses thrown errors for redirect()/notFound(): let them through.
    if (err && typeof err === "object" && "digest" in err && typeof (err as { digest: unknown }).digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_")) {
      throw err;
    }
    console.error("[action]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
