import { Fusszeile, Kopfzeile } from "@/components/ui";
import { ladeStammdatenSicher } from "@/lib/db";
import { AGB } from "@/lib/rechtstexte";

export const metadata = {
  title: "Allgemeine Geschäftsbedingungen – BRK Hausnotruf",
};

export default async function AgbSeite() {
  const stammdaten = await ladeStammdatenSicher();
  return (
    <>
      <Kopfzeile telefon={stammdaten.telefon} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-tinte-900 sm:text-3xl">
          Allgemeine Geschäftsbedingungen
        </h1>
        <p className="mt-2 text-sm text-tinte-500">
          Anlage 7 zum BRK-Servicevertrag für den Hausnotruf/Mobilruf,{" "}
          {stammdaten.verbandsName}.
        </p>

        <div className="mt-8 space-y-3">
          {AGB.map((block, i) =>
            block.titel ? (
              <h2
                key={i}
                className="pt-4 text-sm font-bold text-tinte-900 first:pt-0"
              >
                {block.text}
              </h2>
            ) : (
              <p key={i} className="text-sm leading-relaxed text-tinte-700">
                {block.text}
              </p>
            ),
          )}
        </div>
      </main>
      <Fusszeile impressumUrl={stammdaten.impressumUrl} />
    </>
  );
}
