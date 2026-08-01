import "server-only";

import { db } from "./db";
import type { Rolle } from "./rollen";

export interface Benutzerzeile {
  id: string;
  email: string;
  name: string;
  rolle: Rolle;
  aktiv: boolean;
  erstelltAm: string;
  letzteAnmeldung: string | null;
  /** Falsch, solange der Zugang das Passwort noch nicht festgelegt hat. */
  bestaetigt: boolean;
}

/**
 * Liest alle Zugänge.
 *
 * E-Mail und letzte Anmeldung stehen in auth.users, die Rolle in profile.
 * Über PostgREST ist das auth-Schema nicht erreichbar, deshalb führt die
 * Datenbankfunktion benutzerliste() beides zusammen.
 */
export async function ladeBenutzer(): Promise<Benutzerzeile[]> {
  const { data, error } = await db().rpc("benutzerliste");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((z) => ({
    id: z.id as string,
    email: (z.email as string) ?? "",
    name: (z.name as string) ?? "",
    rolle: z.rolle as Rolle,
    aktiv: Boolean(z.aktiv),
    erstelltAm: z.erstellt_am as string,
    letzteAnmeldung: (z.letzte_anmeldung as string | null) ?? null,
    bestaetigt: Boolean(z.bestaetigt),
  }));
}

/**
 * Zählt die aktiven Administratoren – ohne den angegebenen Zugang.
 *
 * Damit lässt sich vor jeder Änderung prüfen, ob danach noch jemand die
 * Einstellungen und die Benutzerverwaltung erreichen kann.
 */
export async function aktiveAdminsAusser(id: string): Promise<number> {
  const { count, error } = await db()
    .from("profile")
    .select("id", { count: "exact", head: true })
    .eq("rolle", "admin")
    .eq("aktiv", true)
    .neq("id", id);
  if (error) throw error;
  return count ?? 0;
}

/** Prüft, ob dieser Zugang bereits Installationen erfasst hat. */
export async function hatErfassungen(id: string): Promise<boolean> {
  const { count, error } = await db()
    .from("vertraege")
    .select("id", { count: "exact", head: true })
    .eq("vor_ort_von", id);
  if (error) throw error;
  return (count ?? 0) > 0;
}
