import "server-only";

import { BUCKET, db, ladeStammdaten } from "./db";
import { paketById, PaketId } from "./katalog";
import {
  kundenFelder,
  kundenUnterschriftsfelder,
  vorOrtFelder,
  VOR_ORT_UNTERSCHRIFTEN,
} from "./pdf/felder";
import { fuelleVertrag } from "./pdf/fuellen";
import { Bestellung, VorOrtErfassung } from "./typen";

/** Der Ausschnitt eines Vertragsdatensatzes, den die PDF-Erzeugung braucht. */
export interface VertragsQuelle {
  vorgangsnummer: string;
  vertragsnummer: string | null;
  daten: Bestellung;
  vor_ort: VorOrtErfassung | null;
  unterschrift: string;
  erstellt_am: string;
}

export interface ErzeugtesPdf {
  pdf: Uint8Array;
  dateiname: string;
  pfad: string;
  warnungen: string[];
  /** Enthält das Dokument bereits den vor Ort erfassten Teil? */
  mitVorOrt: boolean;
}

/**
 * Erzeugt das Vertrags-PDF aus dem aktuellen Datenstand.
 *
 * Liegt bereits eine Vor-Ort-Erfassung vor, entsteht der Gesamtvertrag mit
 * allen vier Unterschriften; sonst der Kundenteil mit den Unterschriften des
 * Abschlusses. Beides läuft über dieselbe Zuordnung, damit eine
 * Nachbearbeitung im Backoffice nicht plötzlich anders befüllt als der
 * ursprüngliche Abschluss.
 */
export async function erzeugeVertragsPdf(
  quelle: VertragsQuelle,
): Promise<ErzeugtesPdf> {
  const stammdaten = await ladeStammdaten();
  const abschluss = new Date(quelle.erstellt_am).toLocaleDateString("de-DE");
  const mitVorOrt = Boolean(quelle.vor_ort);

  const werte = {
    ...kundenFelder(quelle.daten, stammdaten, {
      mandatsreferenz: quelle.vorgangsnummer,
      datum: abschluss,
      vertragsnummer: quelle.vertragsnummer ?? "",
    }),
    ...(quelle.vor_ort
      ? vorOrtFelder(quelle.vor_ort, quelle.daten, stammdaten)
      : {}),
  };

  const unterschriften = [
    ...kundenUnterschriftsfelder(quelle.daten).map((feld) => ({
      feld,
      bild: quelle.unterschrift,
    })),
    ...(quelle.vor_ort
      ? [
          {
            feld: VOR_ORT_UNTERSCHRIFTEN.leistungserbringer,
            bild: quelle.vor_ort.unterschriftLeistungserbringer,
          },
          {
            feld: VOR_ORT_UNTERSCHRIFTEN.teilnehmer,
            bild: quelle.vor_ort.unterschriftTeilnehmer,
          },
        ]
      : []),
  ].filter((u) => u.bild);

  const { pdf, warnungen } = await fuelleVertrag({ werte, unterschriften });

  const dateiname = `${quelle.vorgangsnummer}_${
    mitVorOrt ? "Gesamtvertrag" : "Servicevertrag"
  }_Hausnotruf.pdf`;
  const jahr = new Date(quelle.erstellt_am).getFullYear();
  const pfad = `${jahr}/${quelle.vorgangsnummer}/${dateiname}`;

  return { pdf, dateiname, pfad, warnungen, mitVorOrt };
}

/** Legt ein erzeugtes PDF im Storage ab. */
export async function legeAb(pfad: string, pdf: Uint8Array): Promise<void> {
  const { error } = await db()
    .storage.from(BUCKET)
    .upload(pfad, Buffer.from(pdf), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (error) throw new Error(`Ablage: ${error.message}`);
}

/** Anrede für die E-Mail an den Kunden. */
export function anredeFuer(bestellung: Bestellung): string {
  const person = bestellung.besteller ?? bestellung.teilnehmer;
  const nachname = bestellung.besteller
    ? bestellung.besteller.nachname
    : bestellung.teilnehmer.nachname;
  if (person.anrede === "Frau") return `Sehr geehrte Frau ${nachname}`;
  if (person.anrede === "Herr") return `Sehr geehrter Herr ${nachname}`;
  return `Guten Tag ${nachname}`;
}

/** Adresse, an die der Vertrag geht. */
export function empfaengerAdresse(bestellung: Bestellung): string {
  return bestellung.besteller?.email || bestellung.teilnehmer.email || "";
}

export function paketName(id: string): string {
  try {
    return paketById(id as PaketId).name;
  } catch {
    return id;
  }
}
