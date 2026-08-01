import Link from "next/link";

import { Abmelden } from "@/components/abmelden";
import { Logo } from "@/components/ui";
import { verlangeRolle } from "@/lib/auth";

export const metadata = { title: "Backoffice – BRK Hausnotruf" };

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const benutzer = await verlangeRolle(["admin", "mitarbeiter"]);
  const istAdmin = benutzer.rolle === "admin";

  const navigation = [
    { pfad: "/backoffice", text: "Verträge" },
    // Backoffice und Technik greifen auf dieselben Vorgänge zu; der Wechsel
    // soll ohne Umweg über die Adresszeile möglich sein.
    { pfad: "/techniker", text: "Installationen" },
    { pfad: "/backoffice/trichter", text: "Trichter" },
    ...(istAdmin
      ? [
          { pfad: "/backoffice/benutzer", text: "Benutzer" },
          { pfad: "/backoffice/einstellungen", text: "Einstellungen" },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-tinte-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Logo klein />
            <nav className="flex gap-1">
              {navigation.map((n) => (
                <Link
                  key={n.pfad}
                  href={n.pfad}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-tinte-600 transition hover:bg-tinte-100 hover:text-tinte-900"
                >
                  {n.text}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-tinte-500">
              {benutzer.name}
              <span className="ml-1.5 rounded-full bg-tinte-100 px-2 py-0.5 text-xs">
                {istAdmin ? "Administrator" : "Mitarbeiter"}
              </span>
            </span>
            <Abmelden />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
