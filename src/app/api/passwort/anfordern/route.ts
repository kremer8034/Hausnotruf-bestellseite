import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { sendeRuecksetzLink, zuVieleAnfragen } from "@/lib/passwort";
import {
  fremdeHerkunftAntwort,
  herkunftStimmt,
  imRahmen,
  klientAdresse,
  leseKoerper,
  zuGrossAntwort,
  ZU_GROSS,
} from "@/lib/schutz";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().trim().email() });

/**
 * Fordert einen Rücksetz-Link an.
 *
 * Die Antwort ist immer dieselbe, egal ob es den Zugang gibt. Sonst ließe sich
 * über diese Route herausfinden, welche Adressen im Kreisverband einen Zugang
 * haben - und das wäre eine Vorlage für gezielte Angriffe.
 */
export async function POST(anfrage: NextRequest) {
  if (!herkunftStimmt(anfrage)) return fremdeHerkunftAntwort();

  const koerper = await leseKoerper(anfrage, 8 * 1024);
  if (koerper === ZU_GROSS) return zuGrossAntwort();

  const eingabe = schema.safeParse(koerper);
  const allgemeineAntwort = NextResponse.json({
    ok: true,
    hinweis:
      "Wenn zu dieser Adresse ein Zugang besteht, ist eine E-Mail mit einem Link unterwegs.",
  });
  if (!eingabe.success) return allgemeineAntwort;

  // Neben der Grenze je Konto auch eine je Anschluss: sonst ließen sich über
  // wechselnde Adressen beliebig viele Nachrichten auslösen.
  if (!(await imRahmen("passwortIp", klientAdresse(anfrage)))) {
    return allgemeineAntwort;
  }

  const email = eingabe.data.email.toLowerCase();

  try {
    const { data: benutzer } = await db()
      .from("profile")
      .select("id, name, aktiv")
      .eq("id", await benutzerIdZu(email))
      .maybeSingle();

    if (!benutzer || !benutzer.aktiv) return allgemeineAntwort;
    if (await zuVieleAnfragen(benutzer.id)) return allgemeineAntwort;

    await sendeRuecksetzLink({
      benutzerId: benutzer.id,
      email,
      name: benutzer.name,
      art: "vergessen",
      basisUrl: process.env.NEXT_PUBLIC_BASIS_URL || anfrage.nextUrl.origin,
      angefordertVon: klientAdresse(anfrage),
    });
  } catch (fehler) {
    // Auch bei einem Fehler bleibt die Antwort gleich, damit sich daraus
    // nichts über den Zugang ablesen lässt.
    console.error("Passwort-Anforderung fehlgeschlagen:", fehler);
  }

  return allgemeineAntwort;
}

/** Sucht die Benutzerkennung zu einer E-Mail-Adresse in Supabase Auth. */
async function benutzerIdZu(email: string): Promise<string> {
  const { data } = await db().rpc("benutzer_id_zu_email", { p_email: email });
  // Eine Kennung, die es sicher nicht gibt – die Abfrage läuft dann ins Leere.
  return (data as string | null) ?? "00000000-0000-0000-0000-000000000000";
}
