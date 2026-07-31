import { Einstellungsformular } from "@/components/einstellungsformular";
import { Hinweisbox } from "@/components/ui";
import { verlangeRolle } from "@/lib/auth";
import { ladeSmtp, ladeStammdatenSicher } from "@/lib/db";
import { STAMMDATEN_STANDARD } from "@/lib/stammdaten";
import { SMTP_STANDARD } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Einstellungen() {
  await verlangeRolle(["admin"]);

  const stammdaten = await ladeStammdatenSicher();
  const smtp = await ladeSmtp().catch(() => SMTP_STANDARD);

  // Platzhalter kennzeichnen, damit sie vor dem Echtbetrieb auffallen.
  const platzhalter = [
    stammdaten.ik === STAMMDATEN_STANDARD.ik && "IK-Nummer",
    stammdaten.glaeubigerId === STAMMDATEN_STANDARD.glaeubigerId &&
      "SEPA-Gläubiger-Identifikationsnummer",
    stammdaten.impressumUrl === STAMMDATEN_STANDARD.impressumUrl && "Impressum-Adresse",
  ].filter(Boolean) as string[];

  return (
    <>
      <h1 className="text-2xl font-bold text-tinte-900">Einstellungen</h1>
      <p className="mt-1 mb-6 text-sm text-tinte-500">
        Diese Angaben erscheinen auf jeder Seite des Vertrags und in den E-Mails.
      </p>

      {platzhalter.length > 0 && (
        <div className="mb-6">
          <Hinweisbox art="warnung">
            <strong>Vor dem Echtbetrieb zu ersetzen:</strong> {platzhalter.join(", ")}.
            Solange dort Platzhalter stehen, sind Kassenabrechnung und Lastschrifteinzug
            nicht möglich.
          </Hinweisbox>
        </div>
      )}

      <Einstellungsformular
        stammdaten={stammdaten}
        smtp={{ ...smtp, passwort: smtp.passwort ? "········" : "" }}
      />
    </>
  );
}
