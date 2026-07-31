import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verlangeRolle } from "@/lib/auth";
import { BUCKET, db, ladeStammdaten } from "@/lib/db";
import { mailVorlage, sendeMail } from "@/lib/mail";
import {
  kundenFelder,
  kundenUnterschriftsfelder,
  vorOrtFelder,
  VOR_ORT_UNTERSCHRIFTEN,
} from "@/lib/pdf/felder";
import { fuelleVertrag } from "@/lib/pdf/fuellen";
import { Bestellung, VorOrtErfassung } from "@/lib/typen";

export const runtime = "nodejs";
export const maxDuration = 60;

const geraetSchema = z.object({
  bezeichnung: z.string().trim().default(""),
  idNummer: z.string().trim().default(""),
});

const schema = z.object({
  mietgeraete: z.array(geraetSchema).max(5),
  technischeVoraussetzungen: z.string().trim().default(""),
  gesundheit: z.object({
    koerperlich: z.array(z.string()),
    geistig: z.array(z.string()),
    anmerkungKoerperlich: z.string().trim().default(""),
    anmerkungGeistig: z.string().trim().default(""),
    medikamente: z.string().trim().default(""),
    medikamentenallergien: z.string().trim().default(""),
  }),
  datumInbetriebnahme: z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/, "Datum als TT.MM.JJJJ"),
  vorgangsnummer: z.string().trim(),
  versorgungAb: z.string().trim().default(""),
  anwesendVertreter: z.boolean(),
  anwesendBetreuer: z.boolean(),
  anwesendSonstige: z.boolean(),
  ortInbetriebnahme: z.string().trim().min(1, "Ort bitte angeben"),
  unterschriftLeistungserbringer: z.string().startsWith("data:image/png;base64,"),
  unterschriftTeilnehmer: z.string().startsWith("data:image/png;base64,"),
  kaufGeraete: z
    .array(
      z.object({
        bezeichnung: z.string().trim().default(""),
        seriennummer: z.string().trim().default(""),
        kosten: z.string().trim().default(""),
      }),
    )
    .max(3),
});

/**
 * Nimmt die Erfassung des Technikers entgegen und erzeugt daraus den
 * Gesamtvertrag: Kundenteil und Vor-Ort-Teil in einem Dokument, mit allen
 * vier Unterschriften.
 */
export async function POST(
  anfrage: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const benutzer = await verlangeRolle(["techniker", "admin", "mitarbeiter"]);
  const { id } = await params;

  const geprueft = schema.safeParse(await anfrage.json().catch(() => null));
  if (!geprueft.success) {
    return NextResponse.json(
      { fehler: geprueft.error.errors[0]?.message ?? "Ungültige Angaben" },
      { status: 422 },
    );
  }
  const vorOrt = geprueft.data as VorOrtErfassung;

  const { data: vertrag } = await db()
    .from("vertraege")
    .select("vorgangsnummer, daten, unterschrift, erstellt_am")
    .eq("id", id)
    .maybeSingle();
  if (!vertrag) {
    return NextResponse.json({ fehler: "Vertrag nicht gefunden" }, { status: 404 });
  }

  try {
    const bestellung = vertrag.daten as Bestellung;
    const stammdaten = await ladeStammdaten();
    const abschluss = new Date(vertrag.erstellt_am).toLocaleDateString("de-DE");

    const { pdf, warnungen } = await fuelleVertrag({
      werte: {
        ...kundenFelder(bestellung, stammdaten, vertrag.vorgangsnummer, abschluss),
        ...vorOrtFelder(vorOrt, bestellung, stammdaten),
      },
      unterschriften: [
        ...kundenUnterschriftsfelder(bestellung).map((feld) => ({
          feld,
          bild: vertrag.unterschrift as string,
        })),
        {
          feld: VOR_ORT_UNTERSCHRIFTEN.leistungserbringer,
          bild: vorOrt.unterschriftLeistungserbringer,
        },
        {
          feld: VOR_ORT_UNTERSCHRIFTEN.teilnehmer,
          bild: vorOrt.unterschriftTeilnehmer,
        },
      ],
    });
    if (warnungen.length) {
      console.warn(`Gesamtvertrag ${vertrag.vorgangsnummer}: ${warnungen.join("; ")}`);
    }

    const dateiname = `${vertrag.vorgangsnummer}_Gesamtvertrag_Hausnotruf.pdf`;
    const pfad = `${new Date(vertrag.erstellt_am).getFullYear()}/${vertrag.vorgangsnummer}/${dateiname}`;
    const { error: uploadFehler } = await db()
      .storage.from(BUCKET)
      .upload(pfad, Buffer.from(pdf), { contentType: "application/pdf", upsert: true });
    if (uploadFehler) throw new Error(`Ablage: ${uploadFehler.message}`);

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

    // Backoffice informieren; ein Fehlschlag darf die Erfassung nicht verwerfen.
    try {
      await sendeMail({
        an: stammdaten.backofficeEmail,
        betreff: `Installation abgeschlossen – ${vertrag.vorgangsnummer}`,
        text: `Die Installation für ${bestellung.teilnehmer.vorname} ${bestellung.teilnehmer.nachname} ist am ${vorOrt.datumInbetriebnahme} abgeschlossen worden. Der Gesamtvertrag liegt im Anhang.`,
        html: mailVorlage(
          "Installation abgeschlossen",
          [
            `Die Installation für <strong>${bestellung.teilnehmer.vorname} ${bestellung.teilnehmer.nachname}</strong> ist am ${vorOrt.datumInbetriebnahme} abgeschlossen worden.`,
            `Erfasst durch ${benutzer.name}. Der Gesamtvertrag mit allen Unterschriften liegt im Anhang und im Backoffice.`,
          ],
          vertrag.vorgangsnummer,
        ),
        anhaenge: [{ dateiname, inhalt: pdf }],
      });
    } catch (fehler) {
      console.error("Mail zur Installation fehlgeschlagen:", fehler);
    }

    return NextResponse.json({ ok: true });
  } catch (fehler) {
    console.error("Vor-Ort-Erfassung fehlgeschlagen:", fehler);
    return NextResponse.json({ fehler: (fehler as Error).message }, { status: 500 });
  }
}
