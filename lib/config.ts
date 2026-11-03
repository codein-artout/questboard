import { APP_NAME } from "@/game/config";

export { APP_NAME };
export const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
