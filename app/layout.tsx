import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "../lib/i18n/provider.tsx";

export const metadata: Metadata = {
  title: "SurakshaDesk — Every dispute deserves clarity",
  description:
    "A polyglot UPI fraud and dispute triage research workspace. Provenance-aware extraction, policy review and empathetic customer drafts.",
  applicationName: "SurakshaDesk",
  icons: { icon: "/favicon.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f2fafc",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
