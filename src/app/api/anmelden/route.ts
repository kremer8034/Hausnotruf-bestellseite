import { NextRequest, NextResponse } from "next/server";

import { authClient } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(anfrage: NextRequest) {
  const { email, passwort } = await anfrage.json().catch(() => ({}));
  if (typeof email !== "string" || typeof passwort !== "string") {
    return NextResponse.json({ fehler: "Ungültige Eingabe" }, { status: 400 });
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

export async function DELETE() {
  await (await authClient()).auth.signOut();
  return NextResponse.json({ ok: true });
}
