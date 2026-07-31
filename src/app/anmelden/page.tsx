import { redirect } from "next/navigation";

import { Anmeldeformular } from "@/components/anmeldeformular";
import { Logo } from "@/components/ui";
import { aktuellerBenutzer } from "@/lib/auth";

export const metadata = { title: "Anmeldung – BRK Hausnotruf" };

export default async function Anmeldeseite({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const benutzer = await aktuellerBenutzer();
  if (benutzer) {
    redirect(benutzer.rolle === "techniker" ? "/techniker" : "/backoffice");
  }
  const parameter = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-xl border border-tinte-200 bg-white p-6 shadow-xs">
          <h1 className="text-lg font-bold text-tinte-900">Anmeldung</h1>
          <p className="mt-1 mb-5 text-sm text-tinte-500">
            Zugang für Backoffice und Technik.
          </p>
          <Anmeldeformular
            hinweis={
              parameter.fehler === "rolle"
                ? "Für diesen Bereich fehlt Ihrem Zugang die Berechtigung."
                : undefined
            }
          />
        </div>
      </div>
    </main>
  );
}
