import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Hausnotruf online bestellen – BRK-Kreisverband Miltenberg-Obernburg",
  description:
    "Hausnotruf und Mobilruf des BRK-Kreisverbands Miltenberg-Obernburg online beantragen – Vertrag in wenigen Minuten abschließen.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e60005",
};

/**
 * Jede Seite wird bei Aufruf erzeugt.
 *
 * Grund ist die Inhaltsrichtlinie: Sie erlaubt Skripte nur mit dem Einmalwert,
 * den die Middleware je Aufruf vergibt. Eine beim Bauen vorgerenderte Seite
 * trüge einen alten Wert und bliebe ohne Skripte – Formulare würden dort nicht
 * mehr funktionieren. Bei dieser Seitenzahl kostet das praktisch nichts.
 */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
