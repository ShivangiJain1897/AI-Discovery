import type { Metadata } from "next";
import "./globals.css";
import Shell from "./components/Shell";

export const metadata: Metadata = {
  title: "Discovery Studio",
  description:
    "Turn a problem, idea, or transcript into product discovery: a team of AI agents (user research, process, defects, market, regulatory, business priority) intake what they need, surface findings you validate, and generate a PRD or backlog you own.",
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
