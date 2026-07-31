# Verzeichnis von Verarbeitungstätigkeiten

**Verarbeitungstätigkeit:** Online-Bestellung und Vertragsabschluss Hausnotruf/Mobilruf
**Stand:** siehe Git-Historie dieser Datei
**Status:** Entwurf — vor dem Echtbetrieb durch den Kreisverband zu prüfen und freizugeben

> Dieses Dokument beschreibt, was die Anwendung tatsächlich tut. Es ersetzt keine
> rechtliche Prüfung. Die mit **offen** gekennzeichneten Punkte sind vor der
> Freigabe zu klären.

---

## 1. Verantwortlicher

| | |
|---|---|
| Verantwortlicher | BRK-Kreisverband Miltenberg-Obernburg, Römerstraße 93, 63785 Obernburg |
| Vertreten durch | Uwe Eisner, Kreisgeschäftsführer |
| Kontakt | Telefon 06022 6181-0, info.mil@brk.de |
| Datenschutzbeauftragter | Martin Plomitzer, 06022 6181-0, info.mil@brk.de |
| Aufsichtsbehörde | Bayerisches Landesamt für Datenschutzaufsicht, Promenade 27, 91522 Ansbach |

## 2. Zwecke der Verarbeitung

1. Anbahnung und Abschluss des BRK-Servicevertrags für den Hausnotruf/Mobilruf
2. Erzeugung des ausgefüllten Vertragsdokuments und Zustellung an Kunde und Backoffice
3. Beantragung der Kostenübernahme bei der Pflegekasse, sofern beauftragt
4. Vorbereitung und Dokumentation der Installation vor Ort
5. Abrechnung der Beiträge per SEPA-Lastschrift
6. Auswertung des Bestellablaufs zur Verbesserung des Formulars

## 3. Kategorien betroffener Personen

- Teilnehmer des Hausnotrufs
- Bestellende Angehörige oder bevollmächtigte Personen
- Als Notfallkontakt benannte Personen
- Beschäftigte des Kreisverbands mit Zugang zum Backoffice oder Technikbereich

## 4. Kategorien personenbezogener Daten

| Kategorie | Einzelangaben | Rechtsgrundlage |
|---|---|---|
| Stammdaten Teilnehmer | Anrede, Name, Geburtsdatum, Anschrift, Telefon, E-Mail | Art. 6 Abs. 1 lit. b DSGVO |
| Stammdaten Besteller | Anrede, Name, Telefon, E-Mail, Bestätigung der Bevollmächtigung | Art. 6 Abs. 1 lit. b DSGVO |
| Sozialdaten | Pflegegrad, Pflegekasse, Versichertennummer, Antragsgründe | Art. 6 Abs. 1 lit. b, Art. 9 Abs. 2 lit. h DSGVO |
| Notfallkontakte | Name, Beziehung, Telefon, Anschrift, Schlüsselbesitz | Art. 6 Abs. 1 lit. b, Art. 6 Abs. 1 lit. d DSGVO |
| Zugangsdaten Wohnung | Standort Schlüsseltresor, Hinweise zum Zugang | Art. 6 Abs. 1 lit. b DSGVO |
| Gesundheitsdaten | Hausarzt und Hinweise für die Zentrale (online); Diagnosenliste, Medikamente, Allergien nach Anlage 11 (erst vor Ort) | Art. 9 Abs. 2 lit. a DSGVO (ausdrückliche Einwilligung) |
| Zahlungsdaten | Kontoinhaber, Anschrift, IBAN, BIC, Kreditinstitut | Art. 6 Abs. 1 lit. b DSGVO |
| Nachweis der Unterschrift | Unterschriftenbild, Zeitpunkt, IP-Adresse | Art. 6 Abs. 1 lit. f DSGVO |
| Nutzungsereignisse | Schritt, Ereignisart, Gerätekategorie, Referrer-Host, Zeitstempel, tabgebundene Zufallskennung | Art. 6 Abs. 1 lit. f DSGVO |

**Zu den Gesundheitsdaten:** Über das Online-Formular werden bewusst keine
Diagnosen erhoben. Die Diagnosenliste nach Anlage 11 des Vertrags nimmt die
Technikerin oder der Techniker erst beim Termin vor Ort auf, mit ausdrücklicher
Einwilligung der betroffenen Person.

**Zu den Notfallkontakten:** Deren Daten gibt der Teilnehmer an. Nach Nr. 4.2
des Vertrags versichert er, deren Einverständnis vorab eingeholt und ihnen die
Datenschutzhinweise ausgehändigt zu haben. Die Information nach Art. 14 DSGVO
erfolgt damit über den Teilnehmer. **Offen:** ob der Kreisverband die
Kontaktpersonen zusätzlich unmittelbar informieren möchte.

## 5. Empfänger

| Empfänger | Zweck | Grundlage |
|---|---|---|
| Hausnotrufzentrale | Notfallbearbeitung | Auftragsverarbeitung bzw. Vertragserfüllung |
| Pflegekasse des Teilnehmers | Antrag auf Kostenübernahme | Vollmacht des Teilnehmers, Anlage 13 |
| Im Vertrag benannte Stellen (Rettungsdienst, Ärzte, Krankenhäuser, Pflegedienst, Angehörige) | Hilfeleistung im Notfall | Schweigepflichtentbindung, Anlage 6 |
| Kreditinstitut | SEPA-Lastschrifteinzug | Vertragserfüllung |
| Vercel Inc. | Betrieb der Anwendung | Auftragsverarbeitung nach Art. 28 DSGVO |
| Supabase Inc. | Datenbank, Dateiablage, Anmeldung | Auftragsverarbeitung nach Art. 28 DSGVO |
| SMTP-Betreiber des Kreisverbands | Versand der Vertragsunterlagen | Auftragsverarbeitung nach Art. 28 DSGVO |

**Offen:** Auftragsverarbeitungsverträge mit Vercel und Supabase abschließen und
zur Akte nehmen.

## 6. Drittlandübermittlung

Die Datenbank und die Dateiablage liegen in der Region `eu-west-1` (Irland), die
Ausführung der Anwendung ist auf `fra1` (Frankfurt) festgelegt. Eine
Übermittlung in Drittländer ist nicht vorgesehen.

**Offen:** Vercel und Supabase sind US-Unternehmen. Für den Fall eines
Supportzugriffs greifen die Standardvertragsklauseln der jeweiligen
Auftragsverarbeitungsverträge. Dieser Punkt gehört in die Risikoabwägung.

## 7. Löschfristen

| Datenbestand | Frist | Umsetzung |
|---|---|---|
| Abgebrochene Bestellungen (Entwürfe) | 30 Tage nach der letzten Änderung | täglicher Lauf `/api/aufraeumen` |
| Abgeschlossene Verträge und Vertrags-PDF | Vertragsdauer, danach 10 Jahre | **offen: noch kein automatischer Lauf, siehe Abschnitt 9** |
| Nutzungsereignisse der Trichteransicht | unbegrenzt, da ohne Personenbezug | — |
| Zwischengespeicherte IBAN | wird nicht zwischengespeichert | Feld wird serverseitig aus jedem Entwurf entfernt |

## 8. Technische und organisatorische Maßnahmen

Siehe [tom.md](tom.md).

## 9. Offene Punkte vor der Freigabe

1. Auftragsverarbeitungsverträge mit Vercel und Supabase abschließen.
2. Automatische Löschung der Verträge nach Ablauf der zehnjährigen
   Aufbewahrungsfrist umsetzen — derzeit muss sie von Hand angestoßen werden.
   Die Frist beginnt erst mit Vertragsende, das System kennt bislang nur den
   Status „gekündigt", nicht das Kündigungsdatum.
3. Klären, ob die Notfallkontakte unmittelbar nach Art. 14 DSGVO informiert
   werden sollen.
4. Datenschutzerklärung der Website (`/datenschutz`) prüfen und freigeben.
5. Einwilligungstext für die Gesundheitsdaten vor Ort festlegen — derzeit wird
   die Einwilligung mündlich eingeholt und über die Unterschrift auf Anlage 9
   dokumentiert.
6. Verfahren für Auskunftsersuchen festlegen (wer beantwortet sie, in welcher
   Frist, mit welchem Datenexport).
