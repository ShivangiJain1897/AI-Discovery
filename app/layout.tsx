import type { Metadata } from "next";
import "./globals.css";
import Shell from "./components/Shell";

export const metadata: Metadata = {
  title: "Product Intelligence Orchestrator",
  description:
    "Move from product question to research, evidence, analysis, insight, decision and artifact. Eleven research lenses, a full analytical method catalog, an explicit decision layer, and any artifact you need — generated from one body of evidence.",
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
