import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { herkunftStimmt, veraendertZustand } from "@/lib/herkunft";

/** Bereiche, in denen die Anmeldesitzung erneuert werden muss. */
const GESCHUETZT = ["/backoffice", "/techniker", "/anmelden"];

/**
 * Baut die Inhaltsrichtlinie für eine Seite.
 *
 * Der Einmalwert (nonce) wechselt bei jedem Aufruf. Nur Skripte, die ihn
 * tragen, dürfen laufen – eingeschmuggeltes Markup hat ihn nicht. Das ist der
 * Schutz, der greift, falls trotz aller Prüfungen einmal fremder Text in eine
 * Seite gerät.
 */
function inhaltsrichtlinie(einmalwert: string, supabaseUrl: string | undefined): string {
  const verbindungen = ["'self'"];
  if (supabaseUrl) verbindungen.push(supabaseUrl);

  return [
    "default-src 'self'",
    // 'strict-dynamic' lässt Skripte zu, die ein erlaubtes Skript selbst
    // nachlädt – so funktioniert das Nachladen von Next.js.
    `script-src 'self' 'nonce-${einmalwert}' 'strict-dynamic' 'unsafe-inline' https:`,
    // Tailwind setzt Stile direkt im Dokument; ohne 'unsafe-inline' bliebe die
    // Seite unformatiert. Stile allein können keine Daten abfließen lassen.
    "style-src 'self' 'unsafe-inline'",
    // Die Unterschrift entsteht als data:-Bild im Browser.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${verbindungen.join(" ")}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * Erneuert die Anmeldesitzung, weist Anfragen fremder Seiten ab und setzt die
 * Inhaltsrichtlinie.
 *
 * Die Herkunftsprüfung steht bewusst hier und nicht in den einzelnen Routen:
 * An einer Stelle lässt sie sich nicht vergessen, wenn später eine Route
 * dazukommt.
 */
export async function middleware(anfrage: NextRequest) {
  if (veraendertZustand(anfrage.method) && !herkunftStimmt(anfrage)) {
    return NextResponse.json(
      { fehler: "Diese Anfrage kam nicht von der Hausnotruf-Seite." },
      { status: 403 },
    );
  }

  const pfad = anfrage.nextUrl.pathname;
  const istApi = pfad.startsWith("/api");

  // Der Einmalwert muss auch beim Erzeugen der Seite bekannt sein, deshalb
  // wandert er über eine Kopfzeile mit in die Anfrage.
  const einmalwert = crypto.randomUUID().replace(/-/g, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kopfzeilen = new Headers(anfrage.headers);
  if (!istApi) kopfzeilen.set("x-nonce", einmalwert);

  const antwort = NextResponse.next({ request: { headers: kopfzeilen } });
  if (!istApi) {
    antwort.headers.set("Content-Security-Policy", inhaltsrichtlinie(einmalwert, url));
  }

  // Nur in den geschützten Bereichen die Sitzung erneuern – die Kundenstrecke
  // braucht keine Anmeldung und soll ohne Umweg ausgeliefert werden.
  if (!GESCHUETZT.some((b) => pfad === b || pfad.startsWith(`${b}/`))) return antwort;

  const schluessel = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !schluessel) return antwort;

  const client = createServerClient(url, schluessel, {
    cookies: {
      getAll: () => anfrage.cookies.getAll(),
      setAll: (zuSetzen: { name: string; value: string; options: CookieOptions }[]) => {
        for (const { name, value, options } of zuSetzen) {
          antwort.cookies.set(name, value, options);
        }
      },
    },
  });

  await client.auth.getUser();
  return antwort;
}

export const config = {
  // Alles außer statischen Dateien: Die Herkunftsprüfung muss jede schreibende
  // Route erreichen, die Inhaltsrichtlinie jede Seite.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
