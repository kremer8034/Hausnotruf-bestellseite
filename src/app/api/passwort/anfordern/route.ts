import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db, ladeStammdaten } from "@/lib/db";
import { mailVorlage, sendeMail } from "@/lib/mail";
import { erzeugeToken, GUELTIGKEIT_MINUTEN, zuVieleAnfragen } from "@/lib/passwort";

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
  const eingabe = schema.safeParse(await anfrage.json().catch(() => null));
  const allgemeineAntwort = NextResponse.json({
    ok: true,
    hinweis:
      "Wenn zu dieser Adresse ein Zugang besteht, ist eine E-Mail mit einem Link unterwegs.",
  });
  if (!eingabe.success) return allgemeineAntwort;

  const email = eingabe.data.email.toLowerCase();

  try {
    const { data: benutzer } = await db()
      .from("profile")
      .select("id, name, aktiv")
      .eq("id", await benutzerIdZu(email))
      .maybeSingle();

    if (!benutzer || !benutzer.aktiv) return allgemeineAntwort;
    if (await zuVieleAnfragen(benutzer.id)) return allgemeineAntwort;

    const { token, hash } = erzeugeToken();
    const gueltigBis = new Date(Date.now() + GUELTIGKEIT_MINUTEN * 60 * 1000);

    const { error } = await db().from("passwort_anfragen").insert({
      benutzer_id: benutzer.id,
      token_hash: hash,
      gueltig_bis: gueltigBis.toISOString(),
      angefordert_von: klientAdresse(anfrage),
    });
    if (error) throw error;

    const stammdaten = await ladeStammdaten();
    const basis =
      process.env.NEXT_PUBLIC_BASIS_URL?.replace(/\/$/, "") ||
      anfrage.nextUrl.origin;
    const link = `${basis}/passwort-neu?token=${token}`;

    const absaetze = [
      `Guten Tag ${benutzer.name || ""},`.trim(),
      `für Ihren Zugang zum Hausnotruf-Backoffice wurde ein neues Passwort angefordert. Über den folgenden Link können Sie eines vergeben:`,
      `<a href="${link}" style="display:inline-block;background:#c40004;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Neues Passwort vergeben</a>`,
      `Der Link gilt ${GUELTIGKEIT_MINUTEN} Minuten und lässt sich nur einmal verwenden.`,
      `<strong>Sie haben das nicht angefordert?</strong> Dann ignorieren Sie diese Nachricht. Ihr bisheriges Passwort bleibt gültig. Wenden Sie sich an die Administration, wenn Sie solche Nachrichten häufiger erhalten.`,
      `Falls der Knopf nicht funktioniert, kopieren Sie diese Adresse in Ihren Browser:<br><span style="word-break:break-all;color:#64748b">${link}</span>`,
    ];

    await sendeMail({
      an: email,
      betreff: "Neues Passwort für das Hausnotruf-Backoffice",
      text: `Für Ihren Zugang wurde ein neues Passwort angefordert.\n\n${link}\n\nDer Link gilt ${GUELTIGKEIT_MINUTEN} Minuten und lässt sich nur einmal verwenden.\n\nSie haben das nicht angefordert? Dann ignorieren Sie diese Nachricht.\n\n${stammdaten.verbandsName}`,
      html: mailVorlage(
        "Neues Passwort vergeben",
        absaetze,
        `${stammdaten.verbandsName} · ${stammdaten.verbandsAnschrift} · ${stammdaten.telefon}`,
      ),
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

function klientAdresse(anfrage: NextRequest): string | null {
  const weitergeleitet = anfrage.headers.get("x-forwarded-for");
  if (weitergeleitet) return weitergeleitet.split(",")[0]!.trim();
  return anfrage.headers.get("x-real-ip");
}
