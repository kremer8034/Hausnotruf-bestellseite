import { Fusszeile, Karte, Kopfzeile } from "@/components/ui";
import { ladeStammdatenSicher } from "@/lib/db";

export const metadata = { title: "Widerrufsbelehrung – BRK Hausnotruf" };

/**
 * Wortlaut aus Anlage 3 des BRK-Servicevertrags (Seite 7), ergänzt um die
 * Anschrift des Kreisverbands aus den Stammdaten.
 */
export default async function WiderrufSeite() {
  const s = await ladeStammdatenSicher();
  const empfaenger = `${s.verbandsName}, ${s.verbandsAnschrift}, Telefon ${s.telefon}, E-Mail ${s.email}`;

  return (
    <>
      <Kopfzeile telefon={s.telefon} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-tinte-900 sm:text-3xl">
          Widerrufsbelehrung
        </h1>

        <section className="mt-8 space-y-4 text-sm leading-relaxed text-tinte-700">
          <h2 className="text-base font-bold text-tinte-900">Widerrufsrecht</h2>
          <p>
            Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen
            Vertrag zu widerrufen.
          </p>
          <p>
            Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
            Um Ihr Widerrufsrecht auszuüben, müssen Sie uns ({empfaenger}) mittels einer
            eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail)
            über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können
            dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht
            vorgeschrieben ist.
          </p>
          <p>
            Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die
            Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
          </p>

          <h2 className="pt-4 text-base font-bold text-tinte-900">Folgen des Widerrufs</h2>
          <p>
            Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von
            Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der
            zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der
            Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt
            haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag
            zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei
            uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel,
            das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit
            Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen
            wegen dieser Rückzahlung Entgelte berechnet.
          </p>
          <p>
            Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist
            beginnen sollen, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem
            Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des
            Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten
            Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen
            Dienstleistungen entspricht.
          </p>
        </section>

        <Karte className="mt-10">
          <h2 className="text-base font-bold text-tinte-900">Muster-Widerrufsformular</h2>
          <p className="mt-1 mb-4 text-sm text-tinte-500">
            Wenn Sie den Vertrag widerrufen wollen, füllen Sie dieses Formular aus und
            senden Sie es zurück. Es liegt auch dem Vertrags-PDF bei, das Sie per E-Mail
            erhalten haben.
          </p>
          <div className="space-y-3 border-l-2 border-tinte-200 pl-4 text-sm text-tinte-700">
            <p>An: {empfaenger}</p>
            <p>
              Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag
              über die Erbringung der folgenden Dienstleistungen: Hausnotruf/Mobilruf
            </p>
            <p>Bestellt am: ____________________</p>
            <p>Name des/der Verbraucher(s): ____________________</p>
            <p>Anschrift des/der Verbraucher(s): ____________________</p>
            <p>Datum und Unterschrift: ____________________</p>
            <p className="text-xs text-tinte-500">(*) Unzutreffendes streichen.</p>
          </div>
        </Karte>
      </main>
      <Fusszeile impressumUrl={s.impressumUrl} />
    </>
  );
}
