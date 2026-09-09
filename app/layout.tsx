import type { Metadata } from "next";
import "./globals.css";
import Shell from "./components/Shell";

export const metadata: Metadata = {
  title: "AI Discovery",
  description:
    "Describe a product or feature. AI researches it — users, market, bugs, process — then writes you a use case doc, a PRD, a backlog or a business case.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
