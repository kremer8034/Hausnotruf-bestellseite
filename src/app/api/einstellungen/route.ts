import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verlangeRolle } from "@/lib/auth";
import { ladeSmtp, speichereKonfiguration } from "@/lib/db";

const stammdatenSchema = z.object({
  verbandsName: z.string().trim().min(1),
  verbandsAnschrift: z.string().trim().min(1),
  vertretenDurch: z.string().trim(),
  telefon: z.string().trim(),
  fax: z.string().trim(),
  email: z.string().trim(),
  backofficeEmail: z.string().trim().email("Die Backoffice-Adresse ist nicht gültig."),
  ik: z.string().trim(),
  glaeubigerId: z.string().trim(),
  sepaFristTage: z.string().trim(),
  datenschutzbeauftragter: z.string().trim(),
  aufsichtsbehoerde: z.string().trim(),
  hausnotrufbeauftragter: z.string().trim(),
  impressumUrl: z.string().trim(),
  mobilrufRegion: z.string().trim(),
  schweigepflichtentbindung: z.array(z.string().trim()).max(7),
});

const smtpSchema = z.object({
  host: z.string().trim(),
  port: z.number().int().min(1).max(65535),
  sicher: z.boolean(),
  benutzer: z.string().trim(),
  // Fehlt das Passwort, bleibt das gespeicherte erhalten.
  passwort: z.string().optional(),
  absenderName: z.string().trim(),
  absenderAdresse: z.string().trim(),
});

export async function POST(anfrage: NextRequest) {
  await verlangeRolle(["admin"]);

  const roh = await anfrage.json().catch(() => null);
  const stammdaten = stammdatenSchema.safeParse(roh?.stammdaten);
  const smtp = smtpSchema.safeParse(roh?.smtp);

  if (!stammdaten.success) {
    return NextResponse.json(
      { fehler: stammdaten.error.errors[0]?.message ?? "Ungültige Stammdaten" },
      { status: 422 },
    );
  }
  if (!smtp.success) {
    return NextResponse.json(
      { fehler: smtp.error.errors[0]?.message ?? "Ungültige SMTP-Angaben" },
      { status: 422 },
    );
  }

  try {
    const bisher = await ladeSmtp();
    await speichereKonfiguration("stammdaten", {
      ...stammdaten.data,
      schweigepflichtentbindung: stammdaten.data.schweigepflichtentbindung.filter(
        (z) => z.length > 0,
      ),
    });
    await speichereKonfiguration("smtp", {
      ...smtp.data,
      passwort: smtp.data.passwort ?? bisher.passwort,
    });
    return NextResponse.json({ ok: true });
  } catch (fehler) {
    return NextResponse.json({ fehler: (fehler as Error).message }, { status: 500 });
  }
}
