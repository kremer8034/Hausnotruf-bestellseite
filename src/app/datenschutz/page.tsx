import { Fusszeile, Hinweisbox, Kopfzeile } from "@/components/ui";
import { ladeStammdatenSicher } from "@/lib/db";

export const metadata = { title: "Datenschutzhinweise – BRK Hausnotruf" };

/**
 * ENTWURF. Der Text beschreibt, was diese Anwendung tatsächlich verarbeitet,
 * und stützt sich inhaltlich auf Anlage 5 des BRK-Servicevertrags. Er ist vor
 * dem Echtbetrieb von der zuständigen Stelle des Kreisverbands zu prüfen.
 */
export default async function DatenschutzSeite() {
  const s = await ladeStammdatenSicher();

  const abschnitte: { titel: string; absaetze: (string | string[])[] }[] = [
    {
      titel: "Wer ist verantwortlich?",
      absaetze: [
        `Verantwortlich für die Verarbeitung Ihrer Daten auf dieser Seite ist der ${s.verbandsName}, ${s.verbandsAnschrift}, Telefon ${s.telefon}, E-Mail ${s.email}.`,
        `Unser Datenschutzbeauftragter: ${s.datenschutzbeauftragter}.`,
      ],
    },
    {
      titel: "Welche Daten verarbeiten wir und wozu?",
      absaetze: [
        "Um den Servicevertrag für den Hausnotruf abschließen und durchführen zu können, verarbeiten wir die Angaben, die Sie in das Bestellformular eintragen:",
        [
          "Angaben zur Person des Teilnehmers: Anrede, Name, Geburtsdatum, Anschrift, Telefonnummer, E-Mail-Adresse",
          "Angaben zur bestellenden Person, wenn ein Angehöriger für den Teilnehmer bestellt",
          "Pflegegrad, Pflegekasse und Versichertennummer, sofern Sie eine Kostenübernahme beantragen",
          "Kontaktpersonen für den Notfall mit Name, Beziehung, Telefonnummer und Anschrift",
          "Angaben zum Wohnungszugang und Hinweise für die Notrufzentrale",
          "Bankverbindung für das SEPA-Lastschriftmandat",
          "Ihre Unterschrift sowie Zeitpunkt und IP-Adresse der Unterzeichnung",
        ],
        "Rechtsgrundlage ist Artikel 6 Absatz 1 Buchstabe b DSGVO (Erfüllung des Vertrags) sowie Artikel 6 Absatz 1 Buchstabe c DSGVO, soweit uns gesetzliche Pflichten treffen — etwa steuerliche Aufbewahrungspflichten.",
        "Zeitpunkt und IP-Adresse der Unterzeichnung speichern wir, um den Vertragsschluss nachweisen zu können. Das ist unser berechtigtes Interesse nach Artikel 6 Absatz 1 Buchstabe f DSGVO.",
      ],
    },
    {
      titel: "Gesundheitsdaten",
      absaetze: [
        "Über dieses Formular erheben wir bewusst keine detaillierten Gesundheitsdaten. Sie können freiwillig Ihre Hausärztin oder Ihren Hausarzt sowie Hinweise angeben, die für die Notrufzentrale wichtig sind.",
        "Die ausführlichen Gesundheitsangaben nach Anlage 11 des Vertrags nimmt unsere Mitarbeiterin oder unser Mitarbeiter erst beim Termin vor Ort mit Ihnen auf. Rechtsgrundlage ist dann Ihre ausdrückliche Einwilligung nach Artikel 9 Absatz 2 Buchstabe a DSGVO. Diese Einwilligung können Sie jederzeit für die Zukunft widerrufen.",
      ],
    },
    {
      titel: "Wer bekommt Ihre Daten?",
      absaetze: [
        "Innerhalb des Kreisverbands erhalten nur die Personen Zugriff, die mit dem Hausnotruf befasst sind. Darüber hinaus geben wir Daten weiter an:",
        [
          "die Hausnotrufzentrale, damit im Notfall Hilfe organisiert werden kann",
          "Ihre Pflegekasse, wenn Sie uns mit dem Antrag auf Kostenübernahme beauftragen",
          "die im Vertrag benannten Stellen, soweit Sie uns von der Schweigepflicht entbunden haben",
          "unsere technischen Dienstleister als Auftragsverarbeiter nach Artikel 28 DSGVO",
        ],
        "Diese Anwendung wird bei Vercel Inc. betrieben, die Daten liegen in einer Datenbank von Supabase in der Europäischen Union. Mit beiden Anbietern bestehen Verträge zur Auftragsverarbeitung. Eine Übermittlung in Drittländer findet darüber hinaus nicht statt.",
      ],
    },
    {
      titel: "Wie lange speichern wir Ihre Daten?",
      absaetze: [
        "Abgeschlossene Verträge bewahren wir für die Dauer des Vertragsverhältnisses und anschließend zehn Jahre auf. Diese Frist ergibt sich aus den handels- und steuerrechtlichen Aufbewahrungspflichten. Danach werden die Daten gelöscht.",
        "Wenn Sie das Bestellformular abbrechen, löschen wir den gespeicherten Zwischenstand automatisch nach 30 Tagen.",
      ],
    },
    {
      titel: "Zwischenspeichern Ihrer Eingaben",
      absaetze: [
        "Damit Sie die Bestellung unterbrechen und später fortsetzen können, speichern wir Ihre bisherigen Eingaben auf unserem Server. Der Zugang erfolgt über einen zufälligen Link, den nur Sie erhalten.",
        "Bankverbindung und Unterschrift werden dabei bewusst nicht zwischengespeichert. Sie geben diese Angaben erst im letzten Schritt ein, und sie werden nur mit dem abgeschlossenen Vertrag gespeichert.",
      ],
    },
    {
      titel: "Auswertung der Nutzung",
      absaetze: [
        "Um das Formular zu verbessern, erfassen wir, welche Schritte aufgerufen und welche abgeschlossen wurden. Dazu erzeugt Ihr Browser eine zufällige Kennung, die nur für die Dauer des geöffneten Tabs gilt und danach verschwindet.",
        "Wir setzen dafür keine Cookies, verwenden keine Dienste Dritter und speichern zu diesen Ereignissen weder Ihre IP-Adresse noch andere Angaben, die Sie identifizieren.",
      ],
    },
    {
      titel: "Welche Rechte haben Sie?",
      absaetze: [
        "Sie haben das Recht auf Auskunft (Artikel 15 DSGVO), Berichtigung (Artikel 16), Löschung (Artikel 17), Einschränkung der Verarbeitung (Artikel 18), Datenübertragbarkeit (Artikel 20) und Widerspruch gegen die Verarbeitung (Artikel 21). Wenden Sie sich dafür an die oben genannten Kontaktdaten.",
        `Außerdem können Sie sich bei der zuständigen Aufsichtsbehörde beschweren: ${s.aufsichtsbehoerde}.`,
      ],
    },
  ];

  return (
    <>
      <Kopfzeile telefon={s.telefon} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-tinte-900 sm:text-3xl">
          Datenschutzhinweise
        </h1>
        <p className="mt-2 text-sm text-tinte-500">
          Informationen nach Artikel 13 und 14 DSGVO zur Verarbeitung Ihrer Daten auf
          dieser Bestellseite.
        </p>

        <div className="mt-6">
          <Hinweisbox art="warnung">
            <strong>Entwurf.</strong> Dieser Text ist vor dem Echtbetrieb noch von der
            zuständigen Stelle des Kreisverbands zu prüfen und freizugeben.
          </Hinweisbox>
        </div>

        <div className="mt-8 space-y-8">
          {abschnitte.map((a) => (
            <section key={a.titel}>
              <h2 className="mb-2 text-base font-bold text-tinte-900">{a.titel}</h2>
              <div className="space-y-3">
                {a.absaetze.map((absatz, i) =>
                  Array.isArray(absatz) ? (
                    <ul key={i} className="ml-5 list-disc space-y-1">
                      {absatz.map((punkt) => (
                        <li key={punkt} className="text-sm leading-relaxed text-tinte-700">
                          {punkt}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i} className="text-sm leading-relaxed text-tinte-700">
                      {absatz}
                    </p>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Fusszeile impressumUrl={s.impressumUrl} />
    </>
  );
}
