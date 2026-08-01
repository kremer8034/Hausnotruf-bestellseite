import type { NextRequest } from "next/server";

/**
 * Prüft, ob eine zustandsändernde Anfrage von der eigenen Seite kommt.
 *
 * Die Anmeldung im Backoffice hängt an einem Cookie. Ohne diese Prüfung
 * könnte eine fremde Seite im Namen eines angemeldeten Mitarbeiters Anfragen
 * stellen, während dieser dort surft - er müsste sie nur besuchen. Den
 * Origin-Kopf setzt der Browser selbst; eine Seite kann ihn nicht fälschen.
 *
 * Bewusst ohne "server-only" und ohne Datenbankzugriff: Diese Funktion läuft
 * auch in der Middleware, und die hat keine Node-Umgebung.
 */
export function herkunftStimmt(anfrage: NextRequest): boolean {
  const herkunft = anfrage.headers.get("origin");
  // Ohne Origin ist es keine Anfrage aus einer fremden Seite heraus, sondern
  // etwa der Vercel-Cron oder ein Aufruf von Hand. Die Berechtigung selbst
  // prüft weiterhin die jeweilige Route.
  if (!herkunft) return true;

  const erlaubt = new Set<string>();
  const konfiguriert = process.env.NEXT_PUBLIC_BASIS_URL;
  if (konfiguriert) {
    try {
      erlaubt.add(new URL(konfiguriert).origin);
    } catch {
      // Unbrauchbare Konfiguration ignorieren statt alles zu sperren.
    }
  }
  erlaubt.add(anfrage.nextUrl.origin);

  // Hinter dem Vercel-Proxy steht der echte Name nur in diesen Kopfzeilen.
  const weitergeleitet = anfrage.headers.get("x-forwarded-host");
  if (weitergeleitet) {
    const schema = anfrage.headers.get("x-forwarded-proto") ?? "https";
    erlaubt.add(`${schema}://${weitergeleitet}`);
  }

  return erlaubt.has(herkunft);
}

/** Methoden, die etwas verändern und deshalb geprüft werden müssen. */
export function veraendertZustand(methode: string): boolean {
  return methode === "POST" || methode === "PUT" || methode === "PATCH" || methode === "DELETE";
}
