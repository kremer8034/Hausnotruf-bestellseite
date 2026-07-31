# Technische und organisatorische Maßnahmen

Nach Art. 32 DSGVO für die Online-Bestellseite Hausnotruf.
**Status:** Entwurf — beschreibt den umgesetzten Stand der Anwendung.

---

## 1. Vertraulichkeit

### Zutrittskontrolle

Die Anwendung läuft nicht auf eigener Hardware. Rechenzentrumssicherheit liegt
bei den Auftragsverarbeitern:

- **Supabase** (Datenbank, Dateiablage, Anmeldung) — Region `eu-west-1`, Irland
- **Vercel** (Ausführung der Anwendung) — Region `fra1`, Frankfurt

Beide betreiben zertifizierte Rechenzentren (ISO 27001, SOC 2). Die jeweiligen
Nachweise sind zur Akte zu nehmen.

### Zugangskontrolle

- Backoffice und Technikbereich sind nur nach Anmeldung erreichbar. Die
  Anmeldung läuft über Supabase Auth mit E-Mail und Passwort; Passwörter werden
  dort als bcrypt-Hash gespeichert und sind für die Anwendung nicht lesbar.
- Sitzungen laufen über HTTP-only-Cookies, die JavaScript im Browser nicht
  auslesen kann.
- Zugänge legt ausschließlich ein Administrator an. Ein Profil ohne Eintrag in
  der Tabelle `profile` oder mit `aktiv = false` wird abgewiesen, selbst wenn
  das Passwort stimmt.
- **Zwei-Faktor-Anmeldung ist derzeit nicht aktiv** — auf ausdrücklichen Wunsch
  des Kreisverbands. Supabase Auth unterstützt sie; sie lässt sich ohne
  Codeänderung nachrüsten und ist bei Zugriff auf Bank- und Gesundheitsdaten
  zu empfehlen.
- **Passwort-Rücksetzung** läuft über einen Einmal-Link, der per E-Mail
  zugestellt wird:
  - Gespeichert wird nur der SHA-256-Abdruck des Tokens. Wer die Tabelle oder
    eine Sicherung liest, kann daraus keinen gültigen Link bauen.
  - Der Link gilt 60 Minuten und lässt sich genau einmal verwenden. Mit der
    Verwendung verfallen zugleich alle anderen offenen Links desselben Zugangs.
  - Höchstens drei Anfragen je Zugang und Stunde, damit sich fremde Postfächer
    nicht zumüllen lassen.
  - Die Antwort ist immer dieselbe, unabhängig davon, ob es den Zugang gibt.
    Sonst ließe sich über die Route ermitteln, welche Adressen im Kreisverband
    einen Zugang haben.
  - Nach erfolgreicher Änderung werden **alle bestehenden Anmeldungen beendet**
    und der Zugang per E-Mail informiert. So fällt es auf, wenn jemand Fremdes
    das Passwort gewechselt hat.
  - Mindestlänge 10 Zeichen; die E-Mail-Adresse und offensichtliche Wörter
    sind ausgeschlossen.
- **Offen:** In Supabase ist der Abgleich gegen bekannte Passwortlecks
  (HaveIBeenPwned) noch abgeschaltet. Er lässt sich unter
  Authentication → Policies mit einem Schalter aktivieren und sollte es auch.

### Zugriffskontrolle

- Drei Rollen mit unterschiedlichem Umfang:

  | Rolle | Verträge lesen | Status ändern | Vor Ort erfassen | Einstellungen |
  |---|---|---|---|---|
  | `admin` | ja | ja | ja | ja |
  | `mitarbeiter` | ja | ja | ja | nein |
  | `techniker` | nur eigene Terminliste | nein | ja | nein |

- Auf allen Tabellen ist Row Level Security aktiv, **ohne jede Policy**. Damit
  kommt der öffentliche `anon`-Schlüssel an keinen einzigen Datensatz, selbst
  wenn er bekannt würde. Jeder Zugriff läuft über den Service-Role-Schlüssel,
  der nur serverseitig verwendet wird; das Modul `src/lib/db.ts` ist mit
  `server-only` markiert und bricht den Build, falls es je in Client-Code
  importiert würde.
- Vertrags-PDF liegen in einem nicht öffentlichen Storage-Bucket und werden nur
  über eine Route ausgeliefert, die zuvor die Rolle prüft.

### Trennungskontrolle

- Entwürfe und abgeschlossene Verträge liegen in getrennten Tabellen mit
  getrennten Löschfristen.
- Auswertungsdaten (`ereignisse`) enthalten weder Namen noch IP-Adresse noch
  eine dauerhafte Kennung und lassen sich nicht mit einem Vertrag verknüpfen.

### Pseudonymisierung und Datensparsamkeit

- **IBAN und Unterschrift werden nicht zwischengespeichert.** Beim Speichern
  eines Entwurfs entfernt der Server beide Felder, bevor er schreibt — der
  Fortsetzen-Link führt also nie zu Bankdaten.
- Gesundheitsdaten nach Anlage 11 werden im Online-Formular gar nicht erhoben,
  sondern erst vor Ort und nur mit ausdrücklicher Einwilligung.
- Die Trichteransicht arbeitet mit einer Zufallskennung, die im
  `sessionStorage` liegt und mit dem Schließen des Tabs verschwindet. Es werden
  keine Cookies gesetzt und keine Dienste Dritter eingebunden.

## 2. Integrität

### Weitergabekontrolle

- Alle Verbindungen laufen ausschließlich über HTTPS; Vercel erzwingt TLS.
- Der Versand der Vertragsunterlagen erfolgt über den SMTP-Zugang des
  Kreisverbands. **Hinweis:** E-Mail ist auf dem Transportweg nicht
  durchgehend verschlüsselt. Der Kreisverband hat sich bewusst gegen einen
  Passwortschutz der PDF-Anhänge entschieden. Da die Anhänge IBAN und
  Angaben zum Pflegegrad enthalten, bleibt dies ein bekanntes Restrisiko.

### Eingabekontrolle

- Jeder Vertragsabschluss wird mit Zeitstempel und IP-Adresse der
  Unterzeichnung festgehalten (`unterschrift_zeit`, `unterschrift_ip`).
- Die Vor-Ort-Erfassung speichert, wer sie vorgenommen hat (`vor_ort_von`) und
  wann (`vor_ort_am`).
- Änderungszeitpunkte werden per Datenbank-Trigger gesetzt und lassen sich
  nicht durch die Anwendung übergehen.

### Datenrichtigkeit

- Alle Eingaben werden zusätzlich serverseitig geprüft; die clientseitige
  Prüfung dient nur der Bedienbarkeit.
- Die IBAN wird gegen die Prüfziffer nach ISO 13616 validiert, sodass
  Zahlendreher auffallen, bevor eine Lastschrift scheitert.
- CSV-Exporte entschärfen führende Sonderzeichen, damit Excel Zellinhalte nicht
  als Formel auswertet.

## 3. Verfügbarkeit und Belastbarkeit

- Supabase erstellt automatische tägliche Sicherungen der Datenbank.
- Das Vertrags-PDF wird zusätzlich per E-Mail an Kunde und Backoffice zugestellt
  und liegt damit außerhalb der Anwendung ein zweites Mal vor.
- Schlägt der Mailversand fehl, bleibt der Vertrag trotzdem gespeichert; der
  Fehler wird protokolliert und das PDF ist im Backoffice abrufbar.
- **Offen:** Ein regelmäßiger Wiederherstellungstest ist noch nicht eingerichtet.

## 4. Verfahren zur Überprüfung

- Löschfristen laufen automatisch: Entwürfe werden nach 30 Tagen entfernt
  (täglicher Lauf `/api/aufraeumen`, per `CRON_SECRET` gegen fremden Aufruf
  geschützt).
- **Offen:** Die zehnjährige Aufbewahrungsfrist für abgeschlossene Verträge wird
  noch nicht automatisch durchgesetzt.
- **Offen:** Es gibt keine Auswertung fehlgeschlagener Anmeldeversuche.
  Supabase begrenzt Anmeldeversuche selbst; eine eigene Auswertung wäre
  zusätzlich sinnvoll.

## 5. Zusammenfassung der offenen Punkte

| Punkt | Bewertung |
|---|---|
| Zwei-Faktor-Anmeldung nicht aktiv | Bewusste Entscheidung des Kreisverbands, jederzeit nachrüstbar |
| Abgleich gegen bekannte Passwortlecks abgeschaltet | Ein Schalter in Supabase, sollte aktiviert werden |
| PDF-Anhänge ohne Passwortschutz | Bewusste Entscheidung des Kreisverbands, Restrisiko beim Mailtransport |
| Automatische Löschung nach zehn Jahren fehlt | Erfordert das Erfassen des Vertragsendes |
| Auftragsverarbeitungsverträge Vercel und Supabase | Noch abzuschließen |
| Wiederherstellungstest | Noch einzurichten |
