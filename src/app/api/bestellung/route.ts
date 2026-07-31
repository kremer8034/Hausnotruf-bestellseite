import { NextRequest, NextResponse } from "next/server";

import { BUCKET, db, ladeStammdaten, naechsteVorgangsnummer } from "@/lib/db";
import { mailVorlage, sendeMail } from "@/lib/mail";
import { paketById } from "@/lib/katalog";
import { kundenFelder, kundenUnterschriftsfelder } from "@/lib/pdf/felder";
import { fuelleVertrag } from "@/lib/pdf/fuellen";
import { berechnePreis, euro } from "@/lib/preis";
import { bestellungSchema, fehlerZuordnung } from "@/lib/validierung";
import type { Bestellung } from "@/lib/typen";

export const runtime = "nodejs";
// Das Befüllen von 27 Seiten braucht spürbar länger als eine normale Antwort.
export const maxDuration = 60;

export async function POST(anfrage: NextRequest) {
  const rohdaten = await anfrage.json().catch(() => null);
  if (!rohdaten) {
    return NextResponse.json({ fehler: "Ungültige Anfrage" }, { status: 400 });
  }

  const geprueft = bestellungSchema.safeParse(rohdaten.bestellung);
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

    const { pdf, warnungen } = await fuelleVertrag({
      werte: kundenFelder(bestellung, stammdaten, vorgangsnummer),
      unterschriften: kundenUnterschriftsfelder(bestellung).map((feld) => ({
        feld,
        bild: bestellung.unterschrift,
      })),
    });
    if (warnungen.length) {
      console.warn(`Vertrag ${vorgangsnummer}: ${warnungen.join("; ")}`);
    }

    const dateiname = `${vorgangsnummer}_Servicevertrag_Hausnotruf.pdf`;
    const pfad = `${new Date().getFullYear()}/${vorgangsnummer}/${dateiname}`;
    const { error: uploadFehler } = await db()
      .storage.from(BUCKET)
      .upload(pfad, Buffer.from(pdf), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadFehler) throw new Error(`Ablage: ${uploadFehler.message}`);

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
      })
      .select("id")
      .single();
    if (dbFehler) throw new Error(`Speichern: ${dbFehler.message}`);

    // Entwurf abschließen, damit der Fortsetzen-Link ins Leere läuft.
    if (typeof rohdaten.token === "string" && rohdaten.token.length === 64) {
      await db()
        .from("entwuerfe")
        .update({ abgeschlossen: true, daten: {} })
        .eq("token", rohdaten.token);
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

function klientAdresse(anfrage: NextRequest): string | null {
  const weitergeleitet = anfrage.headers.get("x-forwarded-for");
  if (weitergeleitet) return weitergeleitet.split(",")[0]!.trim();
  return anfrage.headers.get("x-real-ip");
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
  const empfaenger = bestellung.besteller?.email || bestellung.teilnehmer.email;
  const anrede = bestellung.besteller
    ? `${bestellung.besteller.anrede === "Frau" ? "Sehr geehrte Frau" : bestellung.besteller.anrede === "Herr" ? "Sehr geehrter Herr" : "Guten Tag"} ${bestellung.besteller.nachname}`
    : `${bestellung.teilnehmer.anrede === "Frau" ? "Sehr geehrte Frau" : bestellung.teilnehmer.anrede === "Herr" ? "Sehr geehrter Herr" : "Guten Tag"} ${bestellung.teilnehmer.nachname}`;

  const teilnehmerName = `${bestellung.teilnehmer.vorname} ${bestellung.teilnehmer.nachname}`;
  const anhaenge = [{ dateiname, inhalt: pdf }];

  // Der Versand darf den bereits gespeicherten Vertrag nicht gefährden:
  // schlägt eine Mail fehl, wird das protokolliert, aber nicht geworfen.
  if (empfaenger) {
    const absaetze = [
      `${anrede},`,
      `vielen Dank für Ihre Bestellung. Der Servicevertrag für den Hausnotruf ist damit geschlossen. Sie finden ihn vollständig ausgefüllt und unterschrieben im Anhang dieser E-Mail.`,
      `<strong>Vorgangsnummer:</strong> ${vorgangsnummer}<br>
       <strong>Teilnehmer:</strong> ${teilnehmerName}<br>
       <strong>Paket:</strong> ${paket.name}<br>
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

  const backofficeAbsaetze = [
    `Über die Bestellseite ist ein neuer Vertrag eingegangen.`,
    `<strong>Vorgangsnummer:</strong> ${vorgangsnummer}<br>
     <strong>Teilnehmer:</strong> ${teilnehmerName}, geb. ${bestellung.teilnehmer.geburtsdatum}<br>
     <strong>Anschrift:</strong> ${bestellung.teilnehmer.strasse}, ${bestellung.teilnehmer.plz} ${bestellung.teilnehmer.ort}<br>
     <strong>Telefon:</strong> ${bestellung.teilnehmer.telefon}<br>
     <strong>Paket:</strong> ${paket.name}${bestellung.optionen.length ? ` mit ${bestellung.optionen.join(", ")}` : ""}<br>
     <strong>Pflegegrad:</strong> ${bestellung.pflegegrad === "ohne" ? "keiner" : bestellung.pflegegrad}<br>
     <strong>Kostenübernahme:</strong> ${bestellung.kostenuebernahme ? "beantragt" : "nein"}<br>
     <strong>Monatlich:</strong> ${euro(preis.summe.monatlich)} · <strong>Einmalig:</strong> ${euro(preis.summe.einmalig)}`,
    bestellung.besteller
      ? `<strong>Bestellt durch:</strong> ${bestellung.besteller.vorname} ${bestellung.besteller.nachname}, ${bestellung.besteller.telefon}, ${bestellung.besteller.email}`
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
