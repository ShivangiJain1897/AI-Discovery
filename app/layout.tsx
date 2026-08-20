import type { Metadata } from "next";
import "./globals.css";
import AppShell from "./components/AppShell";

export const metadata: Metadata = {
  title: "AI Product Studio",
  description:
    "Run each product with a team of AI agents that surface signals — market, competitive, defect, regulatory, process, knowledge — and turn them into a prioritized backlog you own. Plus a Discovery chat inside every product.",
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
