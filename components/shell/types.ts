import type { PlayerColorKey } from "@/lib/colors";

export type ShellViewer = {
  handle: string;
  name: string;
  color: PlayerColorKey;
  shelfCount: number;
  unread: number;
  isAdmin: boolean;
};
