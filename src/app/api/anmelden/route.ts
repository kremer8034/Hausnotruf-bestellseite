import { NextRequest, NextResponse } from "next/server";

import { authClient } from "@/lib/auth";
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

export const runtime = "nodejs";

const ZU_VIELE =
  "Zu viele Anmeldeversuche. Bitte warten Sie eine Viertelstunde und versuchen Sie es dann erneut.";

export async function POST(anfrage: NextRequest) {
  if (!herkunftStimmt(anfrage)) return fremdeHerkunftAntwort();

  const koerper = await leseKoerper(anfrage, 8 * 1024);
  if (koerper === ZU_GROSS) return zuGrossAntwort();
  const { email, passwort } = (koerper ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || typeof passwort !== "string") {
    return NextResponse.json({ fehler: "Ungültige Eingabe" }, { status: 400 });
  }

  // Zwei Bremsen: eine gegen das Durchprobieren vieler Konten von einem
  // Anschluss aus, eine gegen das Durchprobieren vieler Passwörter zu einem
  // Konto von wechselnden Anschlüssen aus.
  if (!(await imRahmen("anmeldenIp", klientAdresse(anfrage)))) {
    return zuVieleAnfragenAntwort(ZU_VIELE);
  }
  if (!(await imRahmen("anmeldenKonto", email.trim().toLowerCase()))) {
    return zuVieleAnfragenAntwort(ZU_VIELE);
  }

  const client = await authClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: passwort,
  });
  if (error || !data.user) {
    // Bewusst unspezifisch, damit sich keine gültigen Adressen ausprobieren lassen.
    return NextResponse.json(
      { fehler: "E-Mail-Adresse oder Passwort stimmen nicht." },
      { status: 401 },
    );
  }

  const { data: profil } = await db()
    .from("profile")
    .select("rolle, aktiv")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profil || !profil.aktiv) {
    await client.auth.signOut();
    return NextResponse.json(
      { fehler: "Für diesen Zugang ist kein aktives Profil hinterlegt." },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ziel: profil.rolle === "techniker" ? "/techniker" : "/backoffice",
  });
}

export async function DELETE(anfrage: NextRequest) {
  if (!herkunftStimmt(anfrage)) return fremdeHerkunftAntwort();
  await (await authClient()).auth.signOut();
  return NextResponse.json({ ok: true });
}
