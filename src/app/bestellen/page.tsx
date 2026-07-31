import { Bestellassistent } from "@/components/bestellassistent";
import { Fusszeile, Kopfzeile } from "@/components/ui";
import { ladeStammdatenSicher } from "@/lib/db";
import { OptionId, PAKETE, PaketId, ZUSATZOPTIONEN } from "@/lib/katalog";
import { Pflegegrad } from "@/lib/typen";

export const metadata = {
  title: "Hausnotruf bestellen – BRK-Kreisverband Miltenberg-Obernburg",
};

type Suchparameter = Promise<Record<string, string | string[] | undefined>>;

export default async function Bestellseite({
  searchParams,
}: {
  searchParams: Suchparameter;
}) {
  const stammdaten = await ladeStammdatenSicher();
  const parameter = await searchParams;
  const einzeln = (name: string) => {
    const wert = parameter[name];
    return Array.isArray(wert) ? wert[0] : wert;
  };

  // Vorbelegung aus dem Preisrechner der Startseite übernehmen.
  const paket = einzeln("paket");
  const pflegegrad = einzeln("pflegegrad");
  const optionen = (einzeln("optionen") ?? "")
    .split(",")
    .filter((o) => ZUSATZOPTIONEN.some((z) => z.id === o)) as OptionId[];

  const vorbelegung = {
    ...(PAKETE.some((p) => p.id === paket) ? { paketId: paket as PaketId } : {}),
    ...(["ohne", "1", "2", "3", "4", "5"].includes(pflegegrad ?? "")
      ? {
          pflegegrad: pflegegrad as Pflegegrad,
          kostenuebernahme: pflegegrad !== "ohne",
        }
      : {}),
    ...(optionen.length ? { optionen } : {}),
    ...(einzeln("vdk") === "1" ? { vdkMitglied: true } : {}),
  };

  const token = einzeln("fortsetzen");

  return (
    <>
      <Kopfzeile telefon={stammdaten.telefon} />
      <main>
        <Bestellassistent
          stammdaten={stammdaten}
          vorbelegung={vorbelegung}
          fortsetzenToken={token && token.length === 64 ? token : undefined}
        />
      </main>
      <Fusszeile impressumUrl={stammdaten.impressumUrl} />
    </>
  );
}
