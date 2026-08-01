import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verlangeRolle } from "@/lib/auth";
import { db, ladeStammdaten } from "@/lib/db";
import { htmlText, mailVorlage, sendeMail } from "@/lib/mail";
import { Bestellung, VorOrtErfassung } from "@/lib/typen";
import {
  imRahmen,
  klientAdresse,
  leseKoerper,
  zuGrossAntwort,
  zuVieleAnfragenAntwort,
  ZU_GROSS,
} from "@/lib/schutz";
import { MAX_KURZ, MAX_LANG, unterschriftSchema } from "@/lib/validierung";
import {
  anredeFuer,
  empfaengerAdresse,
  erzeugeVertragsPdf,
  legeAb,
  paketName,
} from "@/lib/vertrag";

export const runtime = "nodejs";
export const maxDuration = 60;

const geraetSchema = z.object({
  bezeichnung: z.string().trim().max(MAX_KURZ).default(""),
  idNummer: z.string().trim().max(60).default(""),
});

const schema = z.object({
  mietgeraete: z.array(geraetSchema).max(5),
  technischeVoraussetzungen: z.string().trim().max(MAX_LANG).default(""),
  gesundheit: z.object({
    koerperlich: z.array(z.string().max(MAX_KURZ)).max(40),
    geistig: z.array(z.string().max(MAX_KURZ)).max(20),
    anmerkungKoerperlich: z.string().trim().max(MAX_LANG).default(""),
    anmerkungGeistig: z.string().trim().max(MAX_LANG).default(""),
    medikamente: z.string().trim().max(MAX_LANG).default(""),
    medikamentenallergien: z.string().trim().max(MAX_LANG).default(""),
  }),
  datumInbetriebnahme: z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/, "Datum als TT.MM.JJJJ"),
  vorgangsnummer: z.string().trim().max(40),
  versorgungAb: z.string().trim().max(40).default(""),
  anwesendVertreter: z.boolean(),
  anwesendBetreuer: z.boolean(),
  anwesendSonstige: z.boolean(),
  ortInbetriebnahme: z.string().trim().min(1, "Ort bitte angeben").max(MAX_KURZ),
  unterschriftLeistungserbringer: unterschriftSchema("Bitte unterschreiben."),
  unterschriftTeilnehmer: unterschriftSchema("Bitte unterschreiben lassen."),
  kaufGeraete: z
    .array(
      z.object({
        bezeichnung: z.string().trim().max(MAX_KURZ).default(""),
        seriennummer: z.string().trim().max(60).default(""),
        kosten: z.string().trim().max(20).default(""),
      }),
    )
    .max(3),
});

/**
 * Nimmt die Erfassung des Technikers entgegen und erzeugt daraus den
 * Gesamtvertrag: Kundenteil und Vor-Ort-Teil in einem Dokument, mit allen
 * vier Unterschriften. Kunde und Backoffice erhalten ihn per E-Mail.
 */
export async function POST(
  anfrage: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const benutzer = await verlangeRolle(["techniker", "admin", "mitarbeiter"]);
  const { id } = await params;

  // Vier Unterschriften plus Freitext – 4 MB sind reichlich bemessen.
  const koerper = await leseKoerper(anfrage, 4 * 1024 * 1024);
  if (koerper === ZU_GROSS) return zuGrossAntwort();

  // Auch ein echter Zugang soll nicht versehentlich in einer Schleife
  // dutzende Gesamtverträge erzeugen und verschicken.
  if (!(await imRahmen("vorOrt", klientAdresse(anfrage)))) {
    return zuVieleAnfragenAntwort(
      "Es wurden zu viele Installationen in kurzer Zeit gemeldet. Bitte kurz warten.",
    );
  }

  const geprueft = schema.safeParse(koerper);
  if (!geprueft.success) {
    return NextResponse.json(
      { fehler: geprueft.error.errors[0]?.message ?? "Ungültige Angaben" },
      { status: 422 },
    );
  }
  const vorOrt = geprueft.data as VorOrtErfassung;

  const { data: vertrag } = await db()
    .from("vertraege")
    .select("vorgangsnummer, vertragsnummer, daten, unterschrift, erstellt_am")
    .eq("id", id)
    .maybeSingle();
  if (!vertrag) {
    return NextResponse.json({ fehler: "Vertrag nicht gefunden" }, { status: 404 });
  }

  try {
    const bestellung = vertrag.daten as Bestellung;
    const stammdaten = await ladeStammdaten();

    const { pdf, dateiname, pfad, warnungen } = await erzeugeVertragsPdf({
      vorgangsnummer: vertrag.vorgangsnummer,
      vertragsnummer: vertrag.vertragsnummer,
      daten: bestellung,
      vor_ort: vorOrt,
      unterschrift: vertrag.unterschrift as string,
      erstellt_am: vertrag.erstellt_am as string,
    });
    if (warnungen.length) {
      console.warn(`Gesamtvertrag ${vertrag.vorgangsnummer}: ${warnungen.join("; ")}`);
    }
    await legeAb(pfad, pdf);

    const { error: dbFehler } = await db()
      .from("vertraege")
      .update({
        vor_ort: vorOrt,
        vor_ort_von: benutzer.id,
        vor_ort_am: new Date().toISOString(),
        gesamt_pdf_pfad: pfad,
        status: "installiert",
      })
      .eq("id", id);
    if (dbFehler) throw new Error(`Speichern: ${dbFehler.message}`);

    const teilnehmerName = `${bestellung.teilnehmer.vorname} ${bestellung.teilnehmer.nachname}`;
    const anhaenge = [{ dateiname, inhalt: pdf }];
    const fuss = `${stammdaten.verbandsName} · ${stammdaten.verbandsAnschrift} · ${stammdaten.telefon} · ${stammdaten.email}`;

    // Kunde: der Vertrag ist jetzt vollständig, mit Geräteliste und
    // Inbetriebnahme. Ein Fehlschlag darf die Erfassung nicht verwerfen.
    const empfaenger = empfaengerAdresse(bestellung);
    if (empfaenger) {
      const geraete = vorOrt.mietgeraete
        .filter((g) => g.bezeichnung)
        .map((g) => g.bezeichnung)
        .join(", ");
      const absaetze = [
        `${htmlText(anredeFuer(bestellung))},`,
        `Ihr Hausnotruf ist seit dem ${htmlText(vorOrt.datumInbetriebnahme)} in Betrieb. Im Anhang finden Sie den vollständigen Vertrag – jetzt ergänzt um die eingebauten Geräte, die technischen Angaben und die Inbetriebnahme.`,
        geraete
          ? `<strong>Eingebaute Geräte:</strong> ${htmlText(geraete)}`
          : "",
        `Bitte bewahren Sie dieses Dokument auf. Es ersetzt die Fassung, die Sie beim Vertragsabschluss erhalten haben.`,
        `Im Notfall genügt ein Druck auf den Funksender. Unsere Notrufzentrale meldet sich und schickt Hilfe. Bei Fragen zur Bedienung erreichen Sie uns unter ${htmlText(stammdaten.telefon)}.`,
      ].filter(Boolean);

      await sendeMailSicher({
        an: empfaenger,
        betreff: `Ihr Hausnotruf ist in Betrieb – Vertrag ${vertrag.vorgangsnummer}`,
        text: absaetze.join("\n\n").replace(/<[^>]+>/g, ""),
        html: mailVorlage("Ihr Hausnotruf ist in Betrieb", absaetze, fuss),
        anhaenge,
      });
    }

    await sendeMailSicher({
      an: stammdaten.backofficeEmail,
      betreff: `Installation abgeschlossen – ${vertrag.vorgangsnummer} – ${teilnehmerName}`,
      text: `Die Installation für ${teilnehmerName} ist am ${vorOrt.datumInbetriebnahme} abgeschlossen worden. Erfasst durch ${benutzer.name}. Der Gesamtvertrag liegt im Anhang.`,
      html: mailVorlage(
        "Installation abgeschlossen",
        [
          `Die Installation für <strong>${htmlText(teilnehmerName)}</strong> (${htmlText(paketName(bestellung.paketId))}) ist am ${htmlText(vorOrt.datumInbetriebnahme)} abgeschlossen worden.`,
          `Erfasst durch ${htmlText(benutzer.name)}. Der Gesamtvertrag mit allen Unterschriften liegt im Anhang und im Backoffice.`,
          empfaenger
            ? `Der Kunde hat das Dokument ebenfalls erhalten (${htmlText(empfaenger)}).`
            : `<strong>Achtung:</strong> Für diesen Vertrag ist keine E-Mail-Adresse hinterlegt – der Kunde hat das Dokument nicht erhalten.`,
        ],
        vertrag.vorgangsnummer,
      ),
      anhaenge,
    });

    return NextResponse.json({ ok: true });
  } catch (fehler) {
    console.error("Vor-Ort-Erfassung fehlgeschlagen:", fehler);
    return NextResponse.json(
      { fehler: "Die Erfassung konnte nicht gespeichert werden. Bitte erneut versuchen." },
      { status: 500 },
    );
  }
}

async function sendeMailSicher(auftrag: Parameters<typeof sendeMail>[0]) {
  try {
    await sendeMail(auftrag);
  } catch (fehler) {
    console.error(`Mailversand an ${auftrag.an} fehlgeschlagen:`, fehler);
  }
}
