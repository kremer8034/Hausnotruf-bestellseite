import { z } from "zod";

import { PAKETE, ZUSATZOPTIONEN } from "./katalog";
import { BEZUGSARTEN } from "./typen";

const pflichttext = (feld: string, min = 2) =>
  z.string().trim().min(min, `${feld} bitte ausfüllen.`);

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
    .regex(/^[\d\s+()/-]+$/, "Die Telefonnummer enthält ungültige Zeichen."),
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse angeben.").or(z.literal("")),
});

export const kontaktpersonSchema = z.object({
  name: pflichttext("Name der Kontaktperson"),
  bezugsart: z.enum(BEZUGSARTEN),
  telefon: z.string().trim().min(6, "Bitte eine Telefonnummer angeben."),
  anschrift: z.string().trim().default(""),
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
        telefon: z.string().trim().min(6, "Bitte eine Telefonnummer angeben."),
        email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse angeben."),
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
    pflegekasseName: z.string().trim().default(""),
    pflegekasseAnschrift: z.string().trim().default(""),
    versichertennummer: z.string().trim().default(""),
    grundAlleinlebend: z.boolean(),
    grundNotsituation: z.boolean(),

    paketId: z.enum(PAKETE.map((p) => p.id) as [string, ...string[]]),
    optionen: z.array(z.enum(ZUSATZOPTIONEN.map((o) => o.id) as [string, ...string[]])),

    anschlussart: z.enum(["gsm", "voip", "msan", "unbekannt"]),
    telefonanbieter: z.string().trim().default(""),
    geraeteRufnummer: z.string().trim().default(""),

    kontaktpersonen: z
      .array(kontaktpersonSchema)
      .min(1, "Bitte mindestens eine Kontaktperson angeben.")
      .max(4, "Es sind höchstens vier Kontaktpersonen vorgesehen."),

    keySafeStandortWunsch: z.string().trim().default(""),
    zugangshinweise: z.string().trim().default(""),

    hausarztName: z.string().trim().default(""),
    hausarztTelefon: z.string().trim().default(""),
    notfallhinweise: z.string().trim().default(""),

    vdkMitglied: z.boolean(),
    vdkMitgliedsnummer: z.string().trim().default(""),

    zahlungspflichtigerIstTeilnehmer: z.boolean(),
    sepaKontoinhaber: pflichttext("Name des Kontoinhabers"),
    sepaAnschrift: pflichttext("Anschrift des Kontoinhabers", 5),
    sepaIban: z
      .string()
      .trim()
      .refine(ibanGueltig, "Diese IBAN ist nicht gültig. Bitte prüfen Sie die Eingabe."),
    sepaBic: z.string().trim().default(""),
    sepaBank: z.string().trim().default(""),

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

    unterschrift: z
      .string()
      .startsWith("data:image/png;base64,", "Bitte unterschreiben Sie den Vertrag."),
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
