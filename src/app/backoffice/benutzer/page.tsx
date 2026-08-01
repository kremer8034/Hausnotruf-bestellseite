import { Benutzerverwaltung } from "@/components/benutzerverwaltung";
import { Hinweisbox } from "@/components/ui";
import { verlangeRolle } from "@/lib/auth";
import { ladeBenutzer } from "@/lib/benutzer";

export const dynamic = "force-dynamic";

export default async function Benutzer() {
  const admin = await verlangeRolle(["admin"]);
  const benutzer = await ladeBenutzer().catch((fehler) => {
    console.error("Benutzerliste fehlgeschlagen:", fehler);
    return null;
  });

  return (
    <>
      <h1 className="text-2xl font-bold text-tinte-900">Benutzer</h1>
      <p className="mt-1 mb-6 text-sm text-tinte-500">
        Zugänge zum Backoffice und zum Technikerbereich. Wer ausscheidet, wird
        deaktiviert – gelöscht wird nur, wer noch nie mit dem System gearbeitet hat.
      </p>

      {benutzer === null ? (
        <Hinweisbox art="warnung">
          Die Zugänge konnten nicht geladen werden. Falls die Datenbank gerade erst
          aktualisiert wurde: Die Migration <code>0004_benutzerverwaltung.sql</code> muss
          eingespielt sein.
        </Hinweisbox>
      ) : (
        <Benutzerverwaltung benutzer={benutzer} eigeneId={admin.id} />
      )}
    </>
  );
}
