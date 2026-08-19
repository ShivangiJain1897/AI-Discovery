import type { Metadata } from "next";
import "./globals.css";
import AppShell from "./components/AppShell";

export const metadata: Metadata = {
  title: "AI Discovery — Paste anything, pick what you need",
  description:
    "A product discovery copilot: paste a feature idea, requirement, or transcript, then generate a PRD, requirements, market/competitive/feedback research, process & domain analysis, defect foresight, or a business-value case.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
