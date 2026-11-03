"use client";

import { RouteModal } from "@/components/ui/Modal";
import type { LogContext } from "@/server/queries/log";
import { LogQuestForm } from "./LogQuestForm";

export function LogModal({ ctx, next }: { ctx: LogContext; next?: string }) {
  return <RouteModal label="Log a quest">{(close) => <LogQuestForm ctx={ctx} onClose={close} next={next} />}</RouteModal>;
}
