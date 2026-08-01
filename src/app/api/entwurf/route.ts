import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
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
import { SCHRITTE } from "@/lib/typen";

/**
 * Zwischenstand der Bestellung speichern und wieder laden.
 *
 * Der Token im Link ist das einzige Geheimnis; er ist 32 Byte lang und wird
 * nur an die vom Kunden angegebene E-Mail-Adresse geschickt. Entwürfe werden
 * nach 30 Tagen automatisch gelöscht (siehe /api/aufraeumen).
 */
const speichernSchema = z.object({
  // Nur Hexadezimalziffern: der Token wird direkt in eine Abfrage gegeben.
  token: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  sitzungId: z.string().min(8).max(64).optional(),
  schritt: z.enum(SCHRITTE),
  daten: z.record(z.unknown()),
  email: z.string().max(200).email().optional().or(z.literal("")),
});

export async function POST(anfrage: NextRequest) {
  if (!herkunftStimmt(anfrage)) return fremdeHerkunftAntwort();

  const koerper = await leseKoerper(anfrage, 256 * 1024);
  if (koerper === ZU_GROSS) return zuGrossAntwort();

  if (!(await imRahmen("entwurf", klientAdresse(anfrage)))) {
    return zuVieleAnfragenAntwort(
      "Es wurden zu viele Zwischenstände gespeichert. Bitte versuchen Sie es später erneut.",
    );
  }

  const eingabe = speichernSchema.safeParse(koerper);
  if (!eingabe.success) {
    return NextResponse.json({ fehler: "Ungültige Daten" }, { status: 400 });
  }

  // IBAN und Unterschrift gehören nicht in einen Zwischenstand, der über
  // einen Link erreichbar ist. Sie werden erst beim Abschluss übertragen.
  const daten = { ...eingabe.data.daten };
  delete daten.sepaIban;
  delete daten.unterschrift;

  const satz = {
    schritt: eingabe.data.schritt,
    daten,
    email: eingabe.data.email || null,
    sitzung_id: eingabe.data.sitzungId ?? null,
  };

  try {
    if (eingabe.data.token) {
      const { data, error } = await db()
        .from("entwuerfe")
        .update(satz)
        .eq("token", eingabe.data.token)
        .eq("abgeschlossen", false)
        .select("id, token")
        .maybeSingle();
      if (error) throw error;
      if (data) return NextResponse.json({ id: data.id, token: data.token });
      // Token unbekannt oder bereits abgeschlossen: neuen Entwurf anlegen.
    }

    const token = randomBytes(32).toString("hex");
    const { data, error } = await db()
      .from("entwuerfe")
      .insert({ ...satz, token })
      .select("id, token")
      .single();
    if (error) throw error;
    return NextResponse.json({ id: data.id, token: data.token });
  } catch (fehler) {
    // Der Wortlaut der Datenbank gehört nicht in den Browser: er verrät
    // Tabellen- und Spaltennamen.
    console.error("Entwurf speichern fehlgeschlagen:", fehler);
    return NextResponse.json(
      { fehler: "Der Zwischenstand konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}

export async function GET(anfrage: NextRequest) {
  const token = anfrage.nextUrl.searchParams.get("token");
  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.json({ fehler: "Kein gültiger Link" }, { status: 400 });
  }
  const { data, error } = await db()
    .from("entwuerfe")
    .select("id, token, schritt, daten, email, abgeschlossen")
    .eq("token", token)
    .maybeSingle();
  if (error) {
    console.error("Entwurf laden fehlgeschlagen:", error);
    return NextResponse.json(
      { fehler: "Der Zwischenstand konnte nicht geladen werden." },
      { status: 500 },
    );
  }
  if (!data || data.abgeschlossen) {
    return NextResponse.json({ fehler: "Dieser Link ist nicht mehr gültig." }, { status: 404 });
  }
  return NextResponse.json(data);
}
