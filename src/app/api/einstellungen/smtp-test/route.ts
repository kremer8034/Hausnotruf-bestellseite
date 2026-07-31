import { NextResponse } from "next/server";

import { verlangeRolle } from "@/lib/auth";
import { pruefeSmtp } from "@/lib/mail";

export async function POST() {
  await verlangeRolle(["admin"]);
  try {
    await pruefeSmtp();
    return NextResponse.json({ ok: true });
  } catch (fehler) {
    return NextResponse.json({ fehler: (fehler as Error).message }, { status: 400 });
  }
}
