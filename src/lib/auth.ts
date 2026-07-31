import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "./db";

export type Rolle = "admin" | "mitarbeiter" | "techniker";

export interface Angemeldet {
  id: string;
  email: string;
  name: string;
  rolle: Rolle;
}

/**
 * Supabase-Client, der die Sitzung über HTTP-only-Cookies führt.
 * Anmeldung erfolgt mit E-Mail und Passwort; Zugänge legt ein Admin an.
 */
export async function authClient() {
  const speicher = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => speicher.getAll(),
        setAll: (zuSetzen: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            for (const { name, value, options } of zuSetzen) {
              speicher.set(name, value, options);
            }
          } catch {
            // In Server Components ist Schreiben nicht erlaubt – die Middleware
            // erneuert die Sitzung, deshalb ist das hier unkritisch.
          }
        },
      },
    },
  );
}

/** Liefert den angemeldeten Benutzer samt Rolle oder null. */
export async function aktuellerBenutzer(): Promise<Angemeldet | null> {
  try {
    const { data } = await (await authClient()).auth.getUser();
    if (!data.user) return null;
    const { data: profil } = await db()
      .from("profile")
      .select("name, rolle, aktiv")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!profil || !profil.aktiv) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? "",
      name: profil.name || data.user.email || "",
      rolle: profil.rolle as Rolle,
    };
  } catch {
    return null;
  }
}

/**
 * Erzwingt eine Anmeldung mit einer der erlaubten Rollen.
 * Ohne Berechtigung geht es zurück zur Anmeldeseite.
 */
export async function verlangeRolle(erlaubt: Rolle[]): Promise<Angemeldet> {
  const benutzer = await aktuellerBenutzer();
  if (!benutzer) redirect("/anmelden");
  if (!erlaubt.includes(benutzer.rolle)) redirect("/anmelden?fehler=rolle");
  return benutzer;
}

export function darfEinstellungen(benutzer: Angemeldet): boolean {
  return benutzer.rolle === "admin";
}
