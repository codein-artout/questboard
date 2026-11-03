import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@/game/config";
import { appUrl } from "@/lib/config";
import { archivo, bigShoulders } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Every board game you've played is a tile on your island. Replays build it up, crowns mark the record, and your shelf of shame waits offshore.",
  applicationName: APP_NAME,
};

export const viewport: Viewport = {
  themeColor: "#0F2E45",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${bigShoulders.variable}`}>
      <body>
        <a href="#main" className="sr-only z-50 rounded-full bg-gold px-4 py-2 font-bold text-sea focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
          Skip to content
        </a>
        {children}
        {modal}
      </body>
    </html>
  );
}
