import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SurakshaDesk — Every dispute deserves clarity",
  description:
    "A polyglot UPI fraud and dispute triage research workspace. Provenance-aware extraction, policy review and empathetic customer drafts.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
