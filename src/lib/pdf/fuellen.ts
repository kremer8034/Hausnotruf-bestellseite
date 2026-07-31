/**
 * Befüllt die aufbereitete Vertragsvorlage und stempelt die Unterschriften.
 *
 * Die Vorlage (assets/vertrag/vertrag-vorlage.pdf) entsteht aus dem Original
 * über tools/prepare_template.py. Dort sind doppeldeutige Feldnamen getrennt
 * und die Signaturfelder entfernt worden; deren Positionen stehen in
 * assets/vertrag/signaturfelder.json.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  PDFDocument,
  PDFCheckBox,
  PDFDropdown,
  PDFFont,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
} from "pdf-lib";

import type { Feldwerte } from "./felder";

export interface Signaturposition {
  name: string;
  page: number;
  rect: [number, number, number, number];
}

const VORLAGE = path.join(process.cwd(), "assets", "vertrag", "vertrag-vorlage.pdf");
const SIGNATUREN = path.join(process.cwd(), "assets", "vertrag", "signaturfelder.json");

let vorlageCache: Uint8Array | null = null;
let signaturCache: Signaturposition[] | null = null;

async function ladeVorlage(): Promise<Uint8Array> {
  if (!vorlageCache) vorlageCache = new Uint8Array(await readFile(VORLAGE));
  return vorlageCache;
}

export async function ladeSignaturpositionen(): Promise<Signaturposition[]> {
  if (!signaturCache) {
    signaturCache = JSON.parse(await readFile(SIGNATUREN, "utf-8"));
  }
  return signaturCache!;
}

export interface Unterschrift {
  /** Name des ursprünglichen Signaturfelds, z. B. "Unterschriftsfeld 12". */
  feld: string;
  /** PNG als Data-URL, wie sie das Unterschriftenfeld im Browser liefert. */
  bild: string;
}

export interface FuellAuftrag {
  werte: Feldwerte;
  unterschriften?: Unterschrift[];
  /** Formularfelder nach dem Befüllen sperren, damit nichts überschrieben wird. */
  sperren?: boolean;
}

const SCHRIFT_MAX = 10;
const SCHRIFT_MIN = 5.5;

/**
 * Wählt eine Schriftgröße, bei der der Text ins Feld passt.
 *
 * Ohne das greift die automatische Größe von pdf-lib: sie skaliert einzeilige
 * Werte auf Feldhöhe hoch, sodass "Römerstraße 93, 63785 Obernburg" in
 * 24 Punkt gesetzt und abgeschnitten wird.
 */
function passendeSchriftgroesse(feld: PDFTextField, text: string, font: PDFFont): number {
  const widgets = feld.acroField.getWidgets();
  if (widgets.length === 0 || text.length === 0) return SCHRIFT_MAX;
  // Ein Feld kann auf mehreren Seiten unterschiedlich breit sein (z. B.
  // HNR_System). Es zählt das kleinste Widget, sonst läuft dort der Text über.
  const masse = widgets.map((w) => w.getRectangle());
  const width = Math.min(...masse.map((m) => m.width));
  const height = Math.min(...masse.map((m) => m.height));
  const nutzbareBreite = Math.max(width - 6, 1);

  if (feld.isMultiline()) {
    // Grob abschätzen, wie viele Zeilen der Text bei einer Größe braucht,
    // und prüfen, ob diese Zeilen in die Feldhöhe passen.
    for (let groesse = SCHRIFT_MAX; groesse >= SCHRIFT_MIN; groesse -= 0.5) {
      const textbreite = font.widthOfTextAtSize(text, groesse);
      const zeilen = Math.max(1, Math.ceil(textbreite / nutzbareBreite));
      if (zeilen * groesse * 1.25 <= height - 4) return groesse;
    }
    return SCHRIFT_MIN;
  }

  const hoehenGrenze = Math.min(SCHRIFT_MAX, Math.max(SCHRIFT_MIN, (height - 4) / 1.2));
  const textbreite = font.widthOfTextAtSize(text, hoehenGrenze);
  if (textbreite <= nutzbareBreite) return hoehenGrenze;
  return Math.max(SCHRIFT_MIN, (hoehenGrenze * nutzbareBreite) / textbreite);
}

/**
 * Setzt die Schriftgröße. Einige Felder der Vorlage haben keine oder eine
 * unvollständige Default-Appearance; dann wird sie hier ergänzt, sonst
 * verweigert pdf-lib das Setzen der Größe.
 */
function setzeSchriftgroesse(
  feld: PDFTextField | PDFDropdown,
  groesse: number,
): void {
  try {
    feld.setFontSize(groesse);
  } catch {
    feld.acroField.setDefaultAppearance(`/Helv ${groesse.toFixed(2)} Tf 0 g`);
    try {
      feld.setFontSize(groesse);
    } catch {
      // Größe bleibt bei der Vorgabe des Dokuments – Inhalt ist wichtiger.
    }
  }
}

/**
 * Setzt einen einzelnen Feldwert. Unbekannte Felder werden übersprungen,
 * damit ein Tippfehler in der Zuordnung nicht die ganze Erzeugung kippt –
 * das Ergebnis wird stattdessen als Warnung zurückgegeben.
 */
function setzeFeld(
  form: ReturnType<PDFDocument["getForm"]>,
  name: string,
  wert: string | boolean,
  warnungen: string[],
  font: PDFFont,
): void {
  let feld;
  try {
    feld = form.getField(name);
  } catch {
    warnungen.push(`Feld nicht gefunden: ${name}`);
    return;
  }

  try {
    if (feld instanceof PDFTextField) {
      const text = typeof wert === "boolean" ? (wert ? "X" : "") : wert;
      feld.setText(text);
      setzeSchriftgroesse(feld, passendeSchriftgroesse(feld, text, font));
      feld.enableReadOnly();
    } else if (feld instanceof PDFCheckBox) {
      if (wert === true) feld.check();
      else feld.uncheck();
      feld.enableReadOnly();
    } else if (feld instanceof PDFRadioGroup) {
      if (typeof wert === "string" && wert.startsWith("/")) {
        const option = wert.slice(1);
        if (feld.getOptions().includes(option)) feld.select(option);
        else warnungen.push(`Auswahl "${option}" fehlt bei ${name}`);
      } else if (wert === true) {
        const erste = feld.getOptions()[0];
        if (erste) feld.select(erste);
      }
      feld.enableReadOnly();
    } else if (feld instanceof PDFDropdown) {
      const text = String(wert);
      if (text) {
        setzeSchriftgroesse(feld, SCHRIFT_MAX);
        // Freitext ist erlaubt: mehrere Auswahlfelder im Original haben
        // keine hinterlegte Optionsliste (z. B. TN_Anrede).
        feld.setOptions(Array.from(new Set([...feld.getOptions(), text])));
        feld.select(text);
      }
      feld.enableReadOnly();
    }
  } catch (fehler) {
    warnungen.push(`${name}: ${(fehler as Error).message}`);
  }
}

export interface FuellErgebnis {
  pdf: Uint8Array;
  warnungen: string[];
}

export async function fuelleVertrag(auftrag: FuellAuftrag): Promise<FuellErgebnis> {
  const doc = await PDFDocument.load(await ladeVorlage());
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const warnungen: string[] = [];

  for (const [name, wert] of Object.entries(auftrag.werte)) {
    if (wert === "" || wert === false) {
      // Leerwerte trotzdem setzen, damit Restwerte einer Vorbefüllung verschwinden.
      setzeFeld(form, name, wert, [], font);
      continue;
    }
    setzeFeld(form, name, wert, warnungen, font);
  }

  if (auftrag.unterschriften?.length) {
    const positionen = await ladeSignaturpositionen();
    for (const unterschrift of auftrag.unterschriften) {
      const treffer = positionen.filter((p) => p.name === unterschrift.feld);
      if (treffer.length === 0) {
        warnungen.push(`Signaturposition unbekannt: ${unterschrift.feld}`);
        continue;
      }
      const png = await doc.embedPng(unterschrift.bild);
      for (const pos of treffer) {
        const seite = doc.getPage(pos.page - 1);
        const [x0, y0, x1, y1] = pos.rect;
        const breite = x1 - x0;
        const hoehe = y1 - y0;
        // Bild proportional in das Feld einpassen, mit etwas Luft am Rand.
        const skala = Math.min((breite * 0.94) / png.width, (hoehe * 0.94) / png.height);
        const w = png.width * skala;
        const h = png.height * skala;
        seite.drawImage(png, {
          x: x0 + (breite - w) / 2,
          y: y0 + (hoehe - h) / 2,
          width: w,
          height: h,
        });
      }
    }
  }

  // Ohne NeedAppearances zeichnen manche Viewer nichts; mit gesetzten
  // Appearances und Read-only bleibt der Inhalt trotzdem stabil.
  form.updateFieldAppearances(font);
  if (auftrag.sperren !== false) form.flatten();

  return { pdf: await doc.save(), warnungen };
}
