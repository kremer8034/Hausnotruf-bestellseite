import "server-only";

import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { db } from "./db";

/** Grenzen je Endpunkt: [Zeitfenster in Sekunden, erlaubte Zugriffe]. */
export const GRENZEN = {
  // Passwortraten: zehn Fehlversuche in einer Viertelstunde reichen niemandem,
  // der sein Passwort kennt.
  anmeldenIp: [900, 10],
  anmeldenKonto: [900, 20],
  // Jede Bestellung erzeugt ein PDF und zwei E-Mails. Fünf je Stunde und
  // Anschluss sind großzügig; mehr wäre Missbrauch.
  bestellung: [3600, 5],
  vorOrt: [3600, 30],
  // Der Assistent speichert im Hintergrund - hier darf die Grenze nicht
  // knapp sein, sonst trifft sie echte Kunden.
  entwurf: [3600, 300],
  ereignis: [3600, 400],
  passwortIp: [3600, 10],
} as const;

/**
 * Bildet den Abdruck eines Merkmals für die Zählung.
 *
 * Die IP-Adresse selbst wird nirgends abgelegt. Der Zweck geht in den Abdruck
 * ein, damit sich Zähler verschiedener Endpunkte nicht vergleichen lassen.
 */
function abdruck(zweck: string, merkmal: string): string {
  const salz = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${zweck}|${merkmal}|${salz}`).digest("hex").slice(0, 32);
}

/** Ermittelt die Adresse des Aufrufers hinter dem Vercel-Proxy. */
export function klientAdresse(anfrage: NextRequest): string {
  const weitergeleitet = anfrage.headers.get("x-forwarded-for");
  if (weitergeleitet) return weitergeleitet.split(",")[0]!.trim();
  return anfrage.headers.get("x-real-ip") ?? "unbekannt";
}

/**
 * Fragt die Bremse.
 *
 * Bei einem Datenbankfehler wird durchgelassen: Eine kaputte Zählung darf
 * niemanden davon abhalten, einen Vertrag abzuschließen oder sich anzumelden.
 * Der Schutz ist eine Bremse, keine Zugangskontrolle - die steckt woanders.
 */
export async function imRahmen(
  zweck: keyof typeof GRENZEN,
  merkmal: string,
): Promise<boolean> {
  const [sekunden, grenze] = GRENZEN[zweck];
  try {
    const { data, error } = await db().rpc("zugriff_erlaubt", {
      p_schluessel: abdruck(zweck, merkmal),
      p_sekunden: sekunden,
      p_grenze: grenze,
    });
    if (error) throw error;
    return data !== false;
  } catch (fehler) {
    console.error(`Missbrauchsbremse (${zweck}) nicht verfügbar:`, fehler);
    return true;
  }
}

/** Einheitliche Antwort, wenn die Grenze erreicht ist. */
export function zuVieleAnfragenAntwort(hinweis: string): NextResponse {
  return NextResponse.json(
    { fehler: hinweis },
    { status: 429, headers: { "Retry-After": "900" } },
  );
}

/**
 * Liest den Anfragekörper mit Obergrenze.
 *
 * Ohne Grenze könnte jemand beliebig große Nachrichten schicken; der Server
 * würde sie erst vollständig einlesen und dann verwerfen. Geprüft wird sowohl
 * die angekündigte als auch die tatsächliche Größe - die Ankündigung lässt
 * sich fälschen.
 */
export async function leseKoerper(
  anfrage: NextRequest,
  maxBytes: number,
): Promise<unknown | typeof ZU_GROSS> {
  const angekuendigt = Number(anfrage.headers.get("content-length") ?? "0");
  if (angekuendigt > maxBytes) return ZU_GROSS;
  const text = await anfrage.text().catch(() => "");
  if (Buffer.byteLength(text, "utf8") > maxBytes) return ZU_GROSS;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const ZU_GROSS = Symbol("zu gross");

export function zuGrossAntwort(): NextResponse {
  return NextResponse.json(
    { fehler: "Die Anfrage ist zu groß." },
    { status: 413 },
  );
}

// Die Middleware prüft die Herkunft bereits für jede schreibende Route. Die
// Routen prüfen zusätzlich selbst: Fällt die Middleware einmal aus dem
// Matcher, steht der Schutz trotzdem.
export { herkunftStimmt } from "./herkunft";

export function fremdeHerkunftAntwort(): NextResponse {
  return NextResponse.json(
    { fehler: "Diese Anfrage kam nicht von der Bestellseite." },
    { status: 403 },
  );
}
