import { z } from "zod";

import { PAKETE, ZUSATZOPTIONEN } from "./katalog";
import { BEZUGSARTEN } from "./typen";

export const TELEFON_MUSTER = /^[\d\s+()/-]+$/;

/**
 * Obergrenzen für Freitext.
 *
 * Nicht nur der Ordnung halber: Ohne Grenze könnte jemand megabyteweise Text
 * schicken, den wir speichern, ins PDF zeichnen und per E-Mail verschicken.
 * Die Werte orientieren sich am Platz, den das Vertragsformular tatsächlich
 * bietet.
 */
export const MAX_KURZ = 120;
export const MAX_LANG = 2000;

const kurztext = (max = MAX_KURZ) => z.string().trim().max(max, "Diese Angabe ist zu lang.");

const pflichttext = (feld: string, min = 2, max = MAX_KURZ) =>
  z.string().trim().min(min, `${feld} bitte ausfüllen.`).max(max, "Diese Angabe ist zu lang.");

/**
 * Prüft eine gezeichnete Unterschrift.
 *
 * Der Präfix allein genügt nicht: Dahinter darf beliebig viel stehen. Geprüft
 * werden deshalb auch das Base64-Alphabet und die Größe. 1 MB reicht für eine
 * Unterschrift auf Leinwandgröße um ein Vielfaches.
 */
export const UNTERSCHRIFT_MAX_ZEICHEN = 1_400_000;

export function unterschriftSchema(meldung: string) {
  return z
    .string()
    .startsWith("data:image/png;base64,", meldung)
    .max(UNTERSCHRIFT_MAX_ZEICHEN, "Die Unterschrift ist zu groß.")
    .refine(
      (wert) => /^[A-Za-z0-9+/]+=*$/.test(wert.slice("data:image/png;base64,".length)),
      "Die Unterschrift konnte nicht gelesen werden.",
    );
}

/** Prüfziffer nach ISO 13616 (Modulo 97). Fängt Zahlendreher zuverlässig ab. */
export function ibanGueltig(roh: string): boolean {
  const iban = roh.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const umgestellt = iban.slice(4) + iban.slice(0, 4);
  const ziffern = umgestellt.replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55),
  );
  // Stückweise rechnen, weil die Zahl für Number zu groß wird.
  let rest = 0;
  for (const ziffer of ziffern) {
    rest = (rest * 10 + Number(ziffer)) % 97;
  }
  return rest === 1;
}

export const datumSchema = z
  .string()
  .regex(/^\d{2}\.\d{2}\.\d{4}$/, "Bitte als TT.MM.JJJJ angeben.")
  .refine((wert) => {
    const [t, m, j] = wert.split(".").map(Number);
    const d = new Date(j, m - 1, t);
    return d.getFullYear() === j && d.getMonth() === m - 1 && d.getDate() === t;
  }, "Dieses Datum gibt es nicht.");

export const geburtsdatumSchema = datumSchema.refine((wert) => {
  const [t, m, j] = wert.split(".").map(Number);
  const d = new Date(j, m - 1, t);
  const jetzt = new Date();
  const alter = (jetzt.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  return alter >= 0 && alter <= 120;
}, "Bitte das Geburtsdatum prüfen.");

export const anredeSchema = z.enum(["Frau", "Herr", "Divers"]);

export const personSchema = z.object({
  anrede: anredeSchema,
  vorname: pflichttext("Vorname"),
  nachname: pflichttext("Nachname"),
  strasse: pflichttext("Straße und Hausnummer", 3),
  plz: z.string().regex(/^\d{5}$/, "Die Postleitzahl hat fünf Ziffern."),
  ort: pflichttext("Ort"),
  telefon: z
    .string()
    .trim()
    .min(6, "Bitte eine erreichbare Telefonnummer angeben.")
    .max(40, "Diese Telefonnummer ist zu lang.")
    .regex(TELEFON_MUSTER, "Die Telefonnummer enthält ungültige Zeichen."),
  email: z
    .string()
    .trim()
    .max(200, "Diese E-Mail-Adresse ist zu lang.")
    .email("Bitte eine gültige E-Mail-Adresse angeben.")
    .or(z.literal("")),
});

export const kontaktpersonSchema = z.object({
  name: pflichttext("Name der Kontaktperson"),
  bezugsart: z.enum(BEZUGSARTEN),
  telefon: z
    .string()
    .trim()
    .min(6, "Bitte eine Telefonnummer angeben.")
    .max(40, "Diese Telefonnummer ist zu lang."),
  anschrift: kurztext(200).default(""),
  schluesselVorhanden: z.boolean(),
});

export const bestellungSchema = z
  .object({
    bestellerIstTeilnehmer: z.boolean(),
    besteller: z
      .object({
        anrede: anredeSchema,
        vorname: pflichttext("Ihr Vorname"),
        nachname: pflichttext("Ihr Nachname"),
        telefon: z
          .string()
          .trim()
          .min(6, "Bitte eine Telefonnummer angeben.")
          .max(40, "Diese Telefonnummer ist zu lang."),
        email: z
          .string()
          .trim()
          .max(200, "Diese E-Mail-Adresse ist zu lang.")
          .email("Bitte eine gültige E-Mail-Adresse angeben."),
        bevollmaechtigt: z.literal(true, {
          errorMap: () => ({
            message:
              "Bitte bestätigen Sie, dass Sie für die Person handeln dürfen.",
          }),
        }),
      })
      .optional(),

    teilnehmer: personSchema.extend({ geburtsdatum: geburtsdatumSchema }),

    pflegegrad: z.enum(["ohne", "1", "2", "3", "4", "5"]),
    kostenuebernahme: z.boolean(),
    pflegekasseName: kurztext().default(""),
    pflegekasseAnschrift: kurztext(200).default(""),
    versichertennummer: kurztext(40).default(""),
    grundAlleinlebend: z.boolean(),
    grundNotsituation: z.boolean(),

    paketId: z.enum(PAKETE.map((p) => p.id) as [string, ...string[]]),
    optionen: z.array(z.enum(ZUSATZOPTIONEN.map((o) => o.id) as [string, ...string[]])),

    anschlussart: z.enum(["gsm", "voip", "msan", "unbekannt"]),
    telefonanbieter: kurztext().default(""),
    geraeteRufnummer: kurztext(40).default(""),

    kontaktpersonen: z
      .array(kontaktpersonSchema)
      .min(1, "Bitte mindestens eine Kontaktperson angeben.")
      .max(4, "Es sind höchstens vier Kontaktpersonen vorgesehen."),

    keySafeStandortWunsch: kurztext(200).default(""),
    zugangshinweise: kurztext(MAX_LANG).default(""),

    hausarztName: kurztext().default(""),
    hausarztTelefon: kurztext(40).default(""),
    notfallhinweise: kurztext(MAX_LANG).default(""),

    vdkMitglied: z.boolean(),
    vdkMitgliedsnummer: kurztext(40).default(""),

    zahlungspflichtigerIstTeilnehmer: z.boolean(),
    sepaKontoinhaber: pflichttext("Name des Kontoinhabers"),
    sepaAnschrift: pflichttext("Anschrift des Kontoinhabers", 5, 200),
    sepaIban: z
      .string()
      .trim()
      .max(42, "Diese IBAN ist zu lang.")
      .refine(ibanGueltig, "Diese IBAN ist nicht gültig. Bitte prüfen Sie die Eingabe."),
    sepaBic: kurztext(20).default(""),
    sepaBank: kurztext().default(""),

    bestaetigungen: z.object({
      leistungenUndGeraete: z.literal(true),
      kosten: z.literal(true),
      hinweisePunkt4und5: z.literal(true),
      datenblatt: z.literal(true),
      schluesselAushaendigung: z.boolean(),
      empfangsberechtigte: z.boolean(),
      sepaMandat: z.literal(true),
      widerrufsbelehrung: z.literal(true),
      sofortigeErbringung: z.boolean(),
      schweigepflichtentbindung: z.boolean(),
      gesundheitsdaten: z.boolean(),
      vdk: z.boolean(),
      vollmachtPflegekasse: z.literal(true),
      agb: z.literal(true),
      datenschutz: z.literal(true),
    }),

    unterschrift: unterschriftSchema("Bitte unterschreiben Sie den Vertrag."),
    unterschriftOrt: pflichttext("Ort"),
  })
  .superRefine((wert, ctx) => {
    if (!wert.bestellerIstTeilnehmer && !wert.besteller) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["besteller"],
        message: "Bitte geben Sie Ihre eigenen Kontaktdaten an.",
      });
    }
    // Ohne Pflegegrad kann keine Kostenübernahme beantragt werden.
    if (wert.kostenuebernahme && wert.pflegegrad === "ohne") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pflegegrad"],
        message:
          "Für die Kostenübernahme durch die Pflegekasse ist ein Pflegegrad erforderlich.",
      });
    }
    if (wert.kostenuebernahme) {
      if (!wert.pflegekasseName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pflegekasseName"],
          message: "Bitte die Pflegekasse angeben.",
        });
      }
      if (!wert.versichertennummer) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["versichertennummer"],
          message: "Bitte die Versichertennummer angeben.",
        });
      }
      if (!wert.grundAlleinlebend && !wert.grundNotsituation) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["grundAlleinlebend"],
          message: "Die Pflegekasse verlangt mindestens einen Grund.",
        });
      }
    }
    if (wert.vdkMitglied && !wert.vdkMitgliedsnummer) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vdkMitgliedsnummer"],
        message: "Bitte die VdK-Mitgliedsnummer angeben.",
      });
    }
    // Der Teilnehmer selbst muss erreichbar sein, wenn niemand sonst bestellt.
    if (wert.bestellerIstTeilnehmer && !wert.teilnehmer.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teilnehmer", "email"],
        message: "Für die Vertragsunterlagen brauchen wir eine E-Mail-Adresse.",
      });
    }
  });

export type BestellungEingabe = z.infer<typeof bestellungSchema>;

/** Wandelt Zod-Fehler in eine flache Zuordnung "feld.pfad" -> Meldung. */
export function fehlerZuordnung(fehler: z.ZodError): Record<string, string> {
  const zuordnung: Record<string, string> = {};
  for (const problem of fehler.errors) {
    const pfad = problem.path.join(".");
    if (!zuordnung[pfad]) zuordnung[pfad] = problem.message;
  }
  return zuordnung;
}


/**
 * Prüfungen, die sowohl die Schritte im Assistenten als auch die Endprüfung
 * verwenden. Ohne diese gemeinsame Grundlage liefe der Kunde bis zur letzten
 * Seite und würde dort zurückgeworfen, weil die Endprüfung strenger ist.
 */
export function telefonFehler(wert: string | undefined, pflicht = true): string | null {
  const text = (wert ?? "").trim();
  if (!text) return pflicht ? "Bitte eine erreichbare Telefonnummer angeben." : null;
  if (text.length < 6) return "Bitte eine erreichbare Telefonnummer angeben.";
  if (!TELEFON_MUSTER.test(text)) return "Die Telefonnummer enthält ungültige Zeichen.";
  return null;
}

export function geburtsdatumFehler(wert: string | undefined): string | null {
  const ergebnis = geburtsdatumSchema.safeParse((wert ?? "").trim());
  return ergebnis.success ? null : (ergebnis.error.errors[0]?.message ?? "Bitte prüfen.");
}
