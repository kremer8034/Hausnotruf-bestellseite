import Link from "next/link";

import { Abmelden } from "@/components/abmelden";
import { Logo } from "@/components/ui";
import { verlangeRolle } from "@/lib/auth";

export const metadata = { title: "Technik – BRK Hausnotruf" };

export default async function TechnikerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Backoffice-Rollen dürfen mit, damit Rückfragen ohne Rollenwechsel gehen.
  const benutzer = await verlangeRolle(["techniker", "admin", "mitarbeiter"]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-tinte-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/techniker">
            <Logo klein />
          </Link>
          <div className="flex items-center gap-2 text-sm">
            {benutzer.rolle !== "techniker" && (
              <Link
                href="/backoffice"
                className="rounded-lg px-3 py-1.5 font-medium text-tinte-600 transition hover:bg-tinte-100 hover:text-tinte-900"
              >
                Backoffice
              </Link>
            )}
            <span className="hidden text-tinte-500 sm:inline">{benutzer.name}</span>
            <Abmelden />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
