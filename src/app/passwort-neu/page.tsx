import Link from "next/link";

import { PasswortNeuFormular } from "@/components/passwortformulare";
import { Hinweisbox, Knopf, Logo } from "@/components/ui";

export const metadata = {
  title: "Neues Passwort vergeben – BRK Hausnotruf",
  robots: { index: false, follow: false },
};

export default async function PasswortNeu({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameter = await searchParams;
  const roh = parameter.token;
  const token = Array.isArray(roh) ? roh[0] : roh;
  const brauchbar = typeof token === "string" && /^[0-9a-f]{64}$/.test(token);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-xl border border-tinte-200 bg-white p-6 shadow-xs">
          <h1 className="mb-4 text-lg font-bold text-tinte-900">
            Neues Passwort vergeben
          </h1>
          {brauchbar ? (
            <PasswortNeuFormular token={token} />
          ) : (
            <div className="space-y-4">
              <Hinweisbox art="warnung">
                Dieser Link ist unvollständig. Kopieren Sie ihn bitte vollständig aus
                der E-Mail in die Adresszeile.
              </Hinweisbox>
              <Link href="/passwort-vergessen" className="block">
                <Knopf breit type="button">
                  Neuen Link anfordern
                </Knopf>
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
