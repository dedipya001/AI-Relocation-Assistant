import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AccountSyncModal } from "@/components/onboarding/account-sync-modal";
import { ShortlistDrawer } from "@/components/shortlist/shortlist-drawer";
import "mapbox-gl/dist/mapbox-gl.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Habita AI | Relocation Intelligence",
  description: "Habita AI: open-source relocation intelligence for smarter home and neighborhood decisions."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <ShortlistDrawer />
        <AccountSyncModal />
      </body>
    </html>
  );
}
