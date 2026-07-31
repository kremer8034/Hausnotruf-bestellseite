import "server-only";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { STAMMDATEN_STANDARD, Stammdaten } from "./stammdaten";

/**
 * Serverseitiger Supabase-Zugriff mit Service-Role-Schlüssel.
 *
 * Auf allen Tabellen ist RLS aktiv und es gibt keine Policy – der öffentliche
 * anon-Schlüssel kommt also selbst dann nicht an die Daten, wenn er bekannt
 * wird. Dieser Client darf niemals in den Browser gelangen; dafür sorgt
 * "server-only".
 */
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const schluessel = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !schluessel) {
    throw new Error(
      "SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.",
    );
  }
  client = createClient(url, schluessel, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export const BUCKET = "vertraege";

// ------------------------------------------------------------- Konfiguration

export interface SmtpEinstellungen {
  host: string;
  port: number;
  sicher: boolean;
  benutzer: string;
  passwort: string;
  absenderName: string;
  absenderAdresse: string;
}

export const SMTP_STANDARD: SmtpEinstellungen = {
  host: "",
  port: 587,
  sicher: false,
  benutzer: "",
  passwort: "",
  absenderName: "BRK Hausnotruf Miltenberg-Obernburg",
  absenderAdresse: "hausnotruf.mil@brk.de",
};

async function leseKonfiguration<T>(schluessel: string, standard: T): Promise<T> {
  const { data, error } = await db()
    .from("konfiguration")
    .select("wert")
    .eq("schluessel", schluessel)
    .maybeSingle();
  if (error) throw new Error(`Konfiguration "${schluessel}": ${error.message}`);
  if (!data) return standard;
  // Fehlende Felder aus dem Standard ergänzen, damit neue Einstellungen
  // nach einem Update nicht undefined sind.
  return { ...standard, ...(data.wert as object) } as T;
}

export function ladeStammdaten(): Promise<Stammdaten> {
  return leseKonfiguration("stammdaten", STAMMDATEN_STANDARD);
}

/**
 * Stammdaten für Seiten, die auch ohne erreichbare Datenbank darstellbar
 * bleiben sollen (Startseite, Rechtstexte). Fällt still auf die Standardwerte
 * zurück, damit ein Konfigurationsfehler nicht die ganze Seite zerlegt.
 */
export async function ladeStammdatenSicher(): Promise<Stammdaten> {
  try {
    return await ladeStammdaten();
  } catch {
    return STAMMDATEN_STANDARD;
  }
}

export function ladeSmtp(): Promise<SmtpEinstellungen> {
  return leseKonfiguration("smtp", SMTP_STANDARD);
}

export async function speichereKonfiguration(
  schluessel: string,
  wert: unknown,
): Promise<void> {
  const { error } = await db()
    .from("konfiguration")
    .upsert(
      { schluessel, wert, geaendert_am: new Date().toISOString() },
      { onConflict: "schluessel" },
    );
  if (error) throw new Error(`Konfiguration speichern: ${error.message}`);
}

// ------------------------------------------------------------- Vorgangsnummer

export async function naechsteVorgangsnummer(): Promise<string> {
  const { data, error } = await db().rpc("naechste_vorgangsnummer");
  if (error) throw new Error(`Vorgangsnummer: ${error.message}`);
  return data as string;
}
