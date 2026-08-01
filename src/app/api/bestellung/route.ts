import { NextRequest, NextResponse } from "next/server";

import { db, ladeStammdaten, naechsteVorgangsnummer } from "@/lib/db";
import { htmlText, mailVorlage, sendeMail } from "@/lib/mail";
import {
  fremdeHerkunftAntwort,
  herkunftStimmt,
  imRahmen,
  klientAdresse,
  leseKoerper,
  zuGrossAntwort,
  zuVieleAnfragenAntwort,
  ZU_GROSS,
} from "@/lib/schutz";
import { paketById } from "@/lib/katalog";
import { berechnePreis, euro } from "@/lib/preis";
import { anredeFuer, empfaengerAdresse, erzeugeVertragsPdf, legeAb } from "@/lib/vertrag";
import { bestellungSchema, fehlerZuordnung } from "@/lib/validierung";
import type { Bestellung } from "@/lib/typen";

export const runtime = "nodejs";
// Das Befüllen von 27 Seiten braucht spürbar länger als eine normale Antwort.
export const maxDuration = 60;

export async function POST(anfrage: NextRequest) {
  if (!herkunftStimmt(anfrage)) return fremdeHerkunftAntwort();

  // Zwei Unterschriften passen in 3 MB um ein Vielfaches; darüber hinaus gibt
  // es keinen sachlichen Grund für eine so große Bestellung.
  const rohdaten = await leseKoerper(anfrage, 3 * 1024 * 1024);
  if (rohdaten === ZU_GROSS) return zuGrossAntwort();
  if (!rohdaten) {
    return NextResponse.json({ fehler: "Ungültige Anfrage" }, { status: 400 });
  }

  // Jede Bestellung erzeugt ein 27-seitiges PDF und zwei E-Mails mit Anhang.
  // Ohne Bremse ließe sich die Seite als Versandhilfe missbrauchen.
  if (!(await imRahmen("bestellung", klientAdresse(anfrage)))) {
    return zuVieleAnfragenAntwort(
      "Von diesem Anschluss sind in kurzer Zeit ungewöhnlich viele Bestellungen eingegangen. Bitte rufen Sie uns an, wenn Sie mehrere Verträge abschließen möchten.",
    );
  }

  const geprueft = bestellungSchema.safeParse(
    (rohdaten as Record<string, unknown>).bestellung,
  );
  if (!geprueft.success) {
    return NextResponse.json(
      { fehler: "Bitte prüfen Sie Ihre Angaben.", felder: fehlerZuordnung(geprueft.error) },
      { status: 422 },
    );
  }
  const bestellung = geprueft.data as unknown as Bestellung;

  try {
    const stammdaten = await ladeStammdaten();
    const vorgangsnummer = await naechsteVorgangsnummer();
    const preis = berechnePreis({
      paketId: bestellung.paketId,
      optionen: bestellung.optionen,
      kostenuebernahme: bestellung.kostenuebernahme,
      vdkMitglied: bestellung.vdkMitglied,
    });

    const jetzt = new Date().toISOString();
    const { pdf, dateiname, pfad, warnungen } = await erzeugeVertragsPdf({
      vorgangsnummer,
      vertragsnummer: null,
      daten: bestellung,
      vor_ort: null,
      unterschrift: bestellung.unterschrift,
      erstellt_am: jetzt,
    });
    if (warnungen.length) {
      console.warn(`Vertrag ${vorgangsnummer}: ${warnungen.join("; ")}`);
    }
    await legeAb(pfad, pdf);

    const { data: vertrag, error: dbFehler } = await db()
      .from("vertraege")
      .insert({
        vorgangsnummer,
        daten: bestellung,
        preis,
        paket: bestellung.paketId,
        kostenuebernahme: bestellung.kostenuebernahme,
        unterschrift: bestellung.unterschrift,
        unterschrift_ip: klientAdresse(anfrage),
        pdf_pfad: pfad,
        // Die unterschriebene Erstfassung; sie bleibt auch dann erhalten,
        // wenn das Backoffice den Vertrag später nachbearbeitet.
        pdf_original_pfad: pfad,
      })
      .select("id")
      .single();
    if (dbFehler) throw new Error(`Speichern: ${dbFehler.message}`);

    // Entwurf abschließen, damit der Fortsetzen-Link ins Leere läuft.
    const entwurfsToken = (rohdaten as Record<string, unknown>).token;
    if (typeof entwurfsToken === "string" && /^[0-9a-f]{64}$/.test(entwurfsToken)) {
      await db()
        .from("entwuerfe")
        .update({ abgeschlossen: true, daten: {} })
        .eq("token", entwurfsToken);
    }

    await versendeMails(bestellung, stammdaten, vorgangsnummer, preis, pdf, dateiname);

    return NextResponse.json({ ok: true, vorgangsnummer, id: vertrag.id });
  } catch (fehler) {
    console.error("Bestellung fehlgeschlagen:", fehler);
    return NextResponse.json(
      {
        fehler:
          "Der Vertrag konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut oder rufen Sie uns an.",
      },
      { status: 500 },
    );
  }
}

async function versendeMails(
  bestellung: Bestellung,
  stammdaten: Awaited<ReturnType<typeof ladeStammdaten>>,
  vorgangsnummer: string,
  preis: ReturnType<typeof berechnePreis>,
  pdf: Uint8Array,
  dateiname: string,
): Promise<void> {
  const paket = paketById(bestellung.paketId);
  const empfaenger = empfaengerAdresse(bestellung);
  const anrede = anredeFuer(bestellung);

  const teilnehmerName = `${bestellung.teilnehmer.vorname} ${bestellung.teilnehmer.nachname}`;
  const anhaenge = [{ dateiname, inhalt: pdf }];

  // Der Versand darf den bereits gespeicherten Vertrag nicht gefährden:
  // schlägt eine Mail fehl, wird das protokolliert, aber nicht geworfen.
  if (empfaenger) {
    const absaetze = [
      `${htmlText(anrede)},`,
      `vielen Dank für Ihre Bestellung. Der Servicevertrag für den Hausnotruf ist damit geschlossen. Sie finden ihn vollständig ausgefüllt und unterschrieben im Anhang dieser E-Mail.`,
      `<strong>Vorgangsnummer:</strong> ${htmlText(vorgangsnummer)}<br>
       <strong>Teilnehmer:</strong> ${htmlText(teilnehmerName)}<br>
       <strong>Paket:</strong> ${htmlText(paket.name)}<br>
       <strong>Monatlich:</strong> ${euro(preis.summe.monatlich)}<br>
       <strong>Einmalig:</strong> ${euro(preis.summe.einmalig)}`,
      `<strong>Wie geht es weiter?</strong> Wir melden uns in den nächsten Arbeitstagen bei Ihnen, um einen Termin für die Installation zu vereinbaren. Bei diesem Termin richten wir das Gerät ein, bringen den Schlüsseltresor an und weisen in die Bedienung ein.`,
      bestellung.kostenuebernahme
        ? `Den Antrag auf Kostenübernahme reichen wir für Sie bei der Pflegekasse ein. Über die Entscheidung informieren wir Sie, sobald sie vorliegt.`
        : "",
      `Sie haben das Recht, den Vertrag binnen 14 Tagen ohne Angabe von Gründen zu widerrufen. Die vollständige Widerrufsbelehrung und das Muster-Widerrufsformular finden Sie im angehängten Vertrag auf den Seiten 7 und 8.`,
    ].filter(Boolean);

    await sendeMailSicher({
      an: empfaenger,
      betreff: `Ihr Hausnotruf-Vertrag ${vorgangsnummer}`,
      text: absaetze.join("\n\n").replace(/<[^>]+>/g, ""),
      html: mailVorlage(
        "Ihr Vertrag ist abgeschlossen",
        absaetze,
        `${stammdaten.verbandsName} · ${stammdaten.verbandsAnschrift} · ${stammdaten.telefon} · ${stammdaten.email}`,
      ),
      anhaenge,
    });
  }

  // Alle Werte aus dem Formular laufen durch htmlText: Diese Nachricht landet
  // im Postfach des Kreisverbands, und dort darf kein fremdes Markup ankommen.
  const backofficeAbsaetze = [
    `Über die Bestellseite ist ein neuer Vertrag eingegangen.`,
    `<strong>Vorgangsnummer:</strong> ${htmlText(vorgangsnummer)}<br>
     <strong>Teilnehmer:</strong> ${htmlText(teilnehmerName)}, geb. ${htmlText(bestellung.teilnehmer.geburtsdatum)}<br>
     <strong>Anschrift:</strong> ${htmlText(bestellung.teilnehmer.strasse)}, ${htmlText(bestellung.teilnehmer.plz)} ${htmlText(bestellung.teilnehmer.ort)}<br>
     <strong>Telefon:</strong> ${htmlText(bestellung.teilnehmer.telefon)}<br>
     <strong>Paket:</strong> ${htmlText(paket.name)}${bestellung.optionen.length ? ` mit ${htmlText(bestellung.optionen.join(", "))}` : ""}<br>
     <strong>Pflegegrad:</strong> ${bestellung.pflegegrad === "ohne" ? "keiner" : htmlText(bestellung.pflegegrad)}<br>
     <strong>Kostenübernahme:</strong> ${bestellung.kostenuebernahme ? "beantragt" : "nein"}<br>
     <strong>Monatlich:</strong> ${euro(preis.summe.monatlich)} · <strong>Einmalig:</strong> ${euro(preis.summe.einmalig)}`,
    bestellung.besteller
      ? `<strong>Bestellt durch:</strong> ${htmlText(bestellung.besteller.vorname)} ${htmlText(bestellung.besteller.nachname)}, ${htmlText(bestellung.besteller.telefon)}, ${htmlText(bestellung.besteller.email)}`
      : `Der Teilnehmer hat selbst bestellt.`,
    `Der Vertrag liegt im Anhang und im Backoffice bereit. Der Vor-Ort-Teil (Geräteliste, Gesundheitsdaten, Inbetriebnahme) ist noch offen.`,
  ];

  await sendeMailSicher({
    an: stammdaten.backofficeEmail,
    betreff: `Neuer Hausnotruf-Vertrag ${vorgangsnummer} – ${teilnehmerName}`,
    text: backofficeAbsaetze.join("\n\n").replace(/<[^>]+>/g, ""),
    html: mailVorlage("Neuer Vertrag eingegangen", backofficeAbsaetze, vorgangsnummer),
    anhaenge,
  });
}

async function sendeMailSicher(auftrag: Parameters<typeof sendeMail>[0]) {
  try {
    await sendeMail(auftrag);
  } catch (fehler) {
    console.error(`Mailversand an ${auftrag.an} fehlgeschlagen:`, fehler);
  }
}
