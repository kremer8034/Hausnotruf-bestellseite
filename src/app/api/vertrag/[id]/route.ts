import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verlangeRolle } from "@/lib/auth";
import { db, ladeStammdaten } from "@/lib/db";
import { mailVorlage, sendeMail } from "@/lib/mail";
import { BEZUGSARTEN, Bestellung, VorOrtErfassung } from "@/lib/typen";
import {
  anredeFuer,
  empfaengerAdresse,
  erzeugeVertragsPdf,
  legeAb,
} from "@/lib/vertrag";
import { anredeSchema, ibanGueltig, TELEFON_MUSTER } from "@/lib/validierung";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Nachbearbeitung eines abgeschlossenen Vertrags durch das Backoffice.
 *
 * Bewusst nicht änderbar sind Paket, Zusatzleistungen und Preis: der Kunde hat
 * einen bestimmten Leistungsumfang zu einem bestimmten Beitrag unterschrieben.
 * Eine Änderung daran wäre ein neuer Vertrag, keine Korrektur.
 */
const bearbeitenSchema = z.object({
  vertragsnummer: z.string().trim().max(40).default(""),
  teilnehmer: z.object({
    anrede: anredeSchema,
    vorname: z.string().trim().min(1, "Vorname bitte ausfüllen."),
    nachname: z.string().trim().min(1, "Nachname bitte ausfüllen."),
    geburtsdatum: z
      .string()
      .regex(/^\d{2}\.\d{2}\.\d{4}$/, "Geburtsdatum bitte als TT.MM.JJJJ angeben."),
    strasse: z.string().trim().min(1, "Straße bitte ausfüllen."),
    plz: z.string().regex(/^\d{5}$/, "Die Postleitzahl hat fünf Ziffern."),
    ort: z.string().trim().min(1, "Ort bitte ausfüllen."),
    telefon: z
      .string()
      .trim()
      .regex(TELEFON_MUSTER, "Die Telefonnummer enthält ungültige Zeichen."),
    email: z
      .string()
      .trim()
      .email("Bitte eine gültige E-Mail-Adresse angeben.")
      .or(z.literal("")),
  }),
  pflegegrad: z.enum(["ohne", "1", "2", "3", "4", "5"]),
  pflegekasseName: z.string().trim().default(""),
  pflegekasseAnschrift: z.string().trim().default(""),
  versichertennummer: z.string().trim().default(""),
  telefonanbieter: z.string().trim().default(""),
  geraeteRufnummer: z.string().trim().default(""),
  keySafeStandortWunsch: z.string().trim().default(""),
  zugangshinweise: z.string().trim().default(""),
  hausarztName: z.string().trim().default(""),
  hausarztTelefon: z.string().trim().default(""),
  notfallhinweise: z.string().trim().default(""),
  kontaktpersonen: z
    .array(
      z.object({
        name: z.string().trim().default(""),
        bezugsart: z.enum(BEZUGSARTEN),
        telefon: z.string().trim().default(""),
        anschrift: z.string().trim().default(""),
        schluesselVorhanden: z.boolean(),
      }),
    )
    .max(4),
  sepaKontoinhaber: z.string().trim().min(1, "Kontoinhaber bitte ausfüllen."),
  sepaAnschrift: z.string().trim().min(1, "Anschrift des Kontoinhabers bitte ausfüllen."),
  sepaIban: z
    .string()
    .trim()
    .refine(ibanGueltig, "Diese IBAN ist nicht gültig."),
  sepaBic: z.string().trim().default(""),
  sepaBank: z.string().trim().default(""),
  notiz: z.string().trim().max(2000).default(""),
  /** Kunde über die geänderte Fassung informieren. */
  kundeBenachrichtigen: z.boolean().default(false),
});

/** Bezeichnungen für das Änderungsprotokoll. */
const FELDNAMEN: Record<string, string> = {
  vertragsnummer: "Vertragsnummer",
  "teilnehmer.anrede": "Anrede",
  "teilnehmer.vorname": "Vorname",
  "teilnehmer.nachname": "Nachname",
  "teilnehmer.geburtsdatum": "Geburtsdatum",
  "teilnehmer.strasse": "Straße",
  "teilnehmer.plz": "Postleitzahl",
  "teilnehmer.ort": "Ort",
  "teilnehmer.telefon": "Telefon",
  "teilnehmer.email": "E-Mail",
  pflegegrad: "Pflegegrad",
  pflegekasseName: "Pflegekasse",
  pflegekasseAnschrift: "Anschrift der Pflegekasse",
  versichertennummer: "Versichertennummer",
  telefonanbieter: "Telefonanbieter",
  geraeteRufnummer: "Rufnummer des Geräts",
  keySafeStandortWunsch: "Schlüsseltresor",
  zugangshinweise: "Zugangshinweise",
  hausarztName: "Hausarzt",
  hausarztTelefon: "Telefon der Praxis",
  notfallhinweise: "Hinweise für die Notrufzentrale",
  kontaktpersonen: "Kontaktpersonen",
  sepaKontoinhaber: "Kontoinhaber",
  sepaAnschrift: "Anschrift des Kontoinhabers",
  sepaIban: "IBAN",
  sepaBic: "BIC",
  sepaBank: "Kreditinstitut",
  notiz: "Interne Notiz",
};

export async function PUT(
  anfrage: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const benutzer = await verlangeRolle(["admin", "mitarbeiter"]);
  const { id } = await params;

  const geprueft = bearbeitenSchema.safeParse(await anfrage.json().catch(() => null));
  if (!geprueft.success) {
    const problem = geprueft.error.errors[0];
    return NextResponse.json(
      {
        fehler: problem?.message ?? "Ungültige Angaben",
        feld: problem?.path.join("."),
      },
      { status: 422 },
    );
  }
  const eingabe = geprueft.data;

  const { data: vertrag } = await db()
    .from("vertraege")
    .select(
      "vorgangsnummer, vertragsnummer, daten, vor_ort, unterschrift, erstellt_am, notiz, aenderungsprotokoll",
    )
    .eq("id", id)
    .maybeSingle();
  if (!vertrag) {
    return NextResponse.json({ fehler: "Vertrag nicht gefunden" }, { status: 404 });
  }

  try {
    const alt = vertrag.daten as Bestellung;
    const neu: Bestellung = {
      ...alt,
      teilnehmer: { ...alt.teilnehmer, ...eingabe.teilnehmer },
      pflegegrad: eingabe.pflegegrad,
      pflegekasseName: eingabe.pflegekasseName,
      pflegekasseAnschrift: eingabe.pflegekasseAnschrift,
      versichertennummer: eingabe.versichertennummer,
      telefonanbieter: eingabe.telefonanbieter,
      geraeteRufnummer: eingabe.geraeteRufnummer,
      keySafeStandortWunsch: eingabe.keySafeStandortWunsch,
      zugangshinweise: eingabe.zugangshinweise,
      hausarztName: eingabe.hausarztName,
      hausarztTelefon: eingabe.hausarztTelefon,
      notfallhinweise: eingabe.notfallhinweise,
      kontaktpersonen: eingabe.kontaktpersonen.filter((k) => k.name.trim()),
      sepaKontoinhaber: eingabe.sepaKontoinhaber,
      sepaAnschrift: eingabe.sepaAnschrift,
      sepaIban: eingabe.sepaIban,
      sepaBic: eingabe.sepaBic,
      sepaBank: eingabe.sepaBank,
    };

    const geaendert = ermittleAenderungen(
      alt,
      neu,
      (vertrag.vertragsnummer as string | null) ?? "",
      eingabe.vertragsnummer,
      (vertrag.notiz as string | null) ?? "",
      eingabe.notiz,
    );

    if (geaendert.length === 0) {
      return NextResponse.json({ ok: true, geaendert: [], hinweis: "Nichts geändert." });
    }

    const { pdf, dateiname, pfad, warnungen, mitVorOrt } = await erzeugeVertragsPdf({
      vorgangsnummer: vertrag.vorgangsnummer as string,
      vertragsnummer: eingabe.vertragsnummer || null,
      daten: neu,
      vor_ort: vertrag.vor_ort as VorOrtErfassung | null,
      unterschrift: vertrag.unterschrift as string,
      erstellt_am: vertrag.erstellt_am as string,
    });
    if (warnungen.length) {
      console.warn(`Nachbearbeitung ${vertrag.vorgangsnummer}: ${warnungen.join("; ")}`);
    }
    await legeAb(pfad, pdf);

    const protokoll = [
      ...((vertrag.aenderungsprotokoll as unknown[]) ?? []),
      {
        zeit: new Date().toISOString(),
        benutzer: benutzer.name,
        benutzerId: benutzer.id,
        felder: geaendert,
      },
    ];

    const { error: dbFehler } = await db()
      .from("vertraege")
      .update({
        vertragsnummer: eingabe.vertragsnummer || null,
        daten: neu,
        // Der Preis bleibt unangetastet: Paket, Zusatzleistungen und
        // Kostenübernahme sind bewusst nicht bearbeitbar.
        notiz: eingabe.notiz || null,
        aenderungsprotokoll: protokoll,
        // Der neu erzeugte Stand ersetzt die Arbeitsfassung; pdf_original_pfad
        // zeigt weiterhin auf das vom Kunden unterschriebene Dokument.
        ...(mitVorOrt ? { gesamt_pdf_pfad: pfad } : { pdf_pfad: pfad }),
      })
      .eq("id", id);
    if (dbFehler) throw new Error(`Speichern: ${dbFehler.message}`);

    if (eingabe.kundeBenachrichtigen) {
      const empfaenger = empfaengerAdresse(neu);
      if (empfaenger) {
        const stammdaten = await ladeStammdaten();
        const absaetze = [
          `${anredeFuer(neu)},`,
          `wir haben Ihren Hausnotruf-Vertrag ergänzt beziehungsweise berichtigt. Im Anhang finden Sie die aktuelle Fassung.`,
          `Geändert wurde: ${geaendert.join(", ")}.`,
          `Diese Fassung ersetzt die Ihnen bisher vorliegende. Bitte bewahren Sie sie auf. Wenn etwas nicht stimmt, melden Sie sich bitte unter ${stammdaten.telefon}.`,
        ];
        try {
          await sendeMail({
            an: empfaenger,
            betreff: `Aktualisierter Hausnotruf-Vertrag ${vertrag.vorgangsnummer}`,
            text: absaetze.join("\n\n"),
            html: mailVorlage(
              "Ihr Vertrag wurde aktualisiert",
              absaetze,
              `${stammdaten.verbandsName} · ${stammdaten.verbandsAnschrift} · ${stammdaten.telefon}`,
            ),
            anhaenge: [{ dateiname, inhalt: pdf }],
          });
        } catch (fehler) {
          console.error("Benachrichtigung des Kunden fehlgeschlagen:", fehler);
          return NextResponse.json({
            ok: true,
            geaendert,
            hinweis:
              "Gespeichert. Die Benachrichtigung an den Kunden konnte nicht verschickt werden – bitte SMTP-Einstellungen prüfen.",
          });
        }
      }
    }

    return NextResponse.json({ ok: true, geaendert });
  } catch (fehler) {
    console.error("Nachbearbeitung fehlgeschlagen:", fehler);
    return NextResponse.json({ fehler: (fehler as Error).message }, { status: 500 });
  }
}

/** Liefert die Bezeichnungen der tatsächlich geänderten Felder. */
function ermittleAenderungen(
  alt: Bestellung,
  neu: Bestellung,
  vertragsnummerAlt: string,
  vertragsnummerNeu: string,
  notizAlt: string,
  notizNeu: string,
): string[] {
  const geaendert: string[] = [];

  if (vertragsnummerAlt !== vertragsnummerNeu) geaendert.push(FELDNAMEN.vertragsnummer);
  if (notizAlt !== notizNeu) geaendert.push(FELDNAMEN.notiz);

  for (const schluessel of Object.keys(alt.teilnehmer) as (keyof typeof alt.teilnehmer)[]) {
    if (alt.teilnehmer[schluessel] !== neu.teilnehmer[schluessel]) {
      geaendert.push(FELDNAMEN[`teilnehmer.${schluessel}`] ?? String(schluessel));
    }
  }

  const einfach = [
    "pflegegrad",
    "pflegekasseName",
    "pflegekasseAnschrift",
    "versichertennummer",
    "telefonanbieter",
    "geraeteRufnummer",
    "keySafeStandortWunsch",
    "zugangshinweise",
    "hausarztName",
    "hausarztTelefon",
    "notfallhinweise",
    "sepaKontoinhaber",
    "sepaAnschrift",
    "sepaIban",
    "sepaBic",
    "sepaBank",
  ] as const;
  for (const schluessel of einfach) {
    if (alt[schluessel] !== neu[schluessel]) {
      geaendert.push(FELDNAMEN[schluessel] ?? schluessel);
    }
  }

  if (JSON.stringify(alt.kontaktpersonen) !== JSON.stringify(neu.kontaktpersonen)) {
    geaendert.push(FELDNAMEN.kontaktpersonen);
  }

  return geaendert;
}
