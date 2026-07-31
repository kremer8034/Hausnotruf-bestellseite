import { NextRequest, NextResponse } from "next/server";

import { db, ladeStammdaten } from "@/lib/db";
import { mailVorlage, sendeMail } from "@/lib/mail";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Täglicher Lauf (siehe vercel.json):
 *
 *  1. Erinnerungsmail an alle, die vor mehr als 24 Stunden abgebrochen haben
 *     und eine E-Mail-Adresse hinterlassen haben – einmalig je Entwurf.
 *  2. Löschen aller Entwürfe, die älter als 30 Tage sind.
 *
 * Geschützt über CRON_SECRET, damit der Endpunkt nicht öffentlich auslösbar ist.
 */
export async function GET(anfrage: NextRequest) {
  const geheimnis = process.env.CRON_SECRET;
  const kopf = anfrage.headers.get("authorization");
  if (!geheimnis || kopf !== `Bearer ${geheimnis}`) {
    return NextResponse.json({ fehler: "Nicht berechtigt" }, { status: 401 });
  }

  const jetzt = Date.now();
  const vorEinemTag = new Date(jetzt - 24 * 3600 * 1000).toISOString();
  const vorDreissigTagen = new Date(jetzt - 30 * 24 * 3600 * 1000).toISOString();

  let erinnert = 0;
  let geloescht = 0;

  try {
    const stammdaten = await ladeStammdaten();
    const basis = process.env.NEXT_PUBLIC_BASIS_URL ?? "";

    const { data: offene } = await db()
      .from("entwuerfe")
      .select("id, token, email, daten, aktualisiert_am")
      .eq("abgeschlossen", false)
      .is("erinnerung_am", null)
      .not("email", "is", null)
      .lt("aktualisiert_am", vorEinemTag)
      .gt("aktualisiert_am", vorDreissigTagen)
      .limit(200);

    for (const entwurf of offene ?? []) {
      const daten = entwurf.daten as { teilnehmer?: { vorname?: string; nachname?: string } };
      const name = daten.teilnehmer?.nachname
        ? ` für ${daten.teilnehmer.vorname ?? ""} ${daten.teilnehmer.nachname}`.trimEnd()
        : "";
      const link = `${basis}/bestellen?fortsetzen=${entwurf.token}`;

      try {
        await sendeMail({
          an: entwurf.email as string,
          betreff: "Ihre begonnene Hausnotruf-Bestellung",
          text: `Guten Tag,\n\nSie haben eine Bestellung${name} begonnen, aber noch nicht abgeschlossen. Über diesen Link machen Sie dort weiter, wo Sie aufgehört haben:\n\n${link}\n\nWenn Sie Fragen haben, rufen Sie uns gern an: ${stammdaten.telefon}.\n\n${stammdaten.verbandsName}`,
          html: mailVorlage(
            "Sie waren fast fertig",
            [
              "Guten Tag,",
              `Sie haben eine Bestellung${name} begonnen, aber noch nicht abgeschlossen. Ihre bisherigen Angaben haben wir gespeichert.`,
              `<a href="${link}" style="display:inline-block;background:#c40004;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Bestellung fortsetzen</a>`,
              `Sie haben noch Fragen? Rufen Sie uns an: <strong>${stammdaten.telefon}</strong>. Wir helfen gern weiter.`,
              "Falls Sie sich anders entschieden haben, ignorieren Sie diese Nachricht einfach. Ihre Angaben löschen wir dann nach 30 Tagen automatisch.",
            ],
            `${stammdaten.verbandsName} · ${stammdaten.verbandsAnschrift} · ${stammdaten.telefon}`,
          ),
        });
        await db()
          .from("entwuerfe")
          .update({ erinnerung_am: new Date().toISOString() })
          .eq("id", entwurf.id);
        erinnert++;
      } catch (fehler) {
        console.error(`Erinnerung an ${entwurf.email} fehlgeschlagen:`, fehler);
      }
    }

    const { data: alte } = await db()
      .from("entwuerfe")
      .delete()
      .lt("aktualisiert_am", vorDreissigTagen)
      .select("id");
    geloescht = alte?.length ?? 0;

    // Abgelaufene Links zum Zurücksetzen des Passworts verfallen nach sieben Tagen.
    let passwortAnfragen = 0;
    try {
      const { data } = await db().rpc("raeume_passwort_anfragen");
      passwortAnfragen = (data as number | null) ?? 0;
    } catch (fehler) {
      console.error("Passwort-Anfragen aufräumen fehlgeschlagen:", fehler);
    }

    return NextResponse.json({ ok: true, erinnert, geloescht, passwortAnfragen });
  } catch (fehler) {
    console.error("Aufräumen fehlgeschlagen:", fehler);
    return NextResponse.json({ fehler: (fehler as Error).message }, { status: 500 });
  }
}
