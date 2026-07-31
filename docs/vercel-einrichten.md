# Auf Vercel bereitstellen

Etwa fünf Minuten. Die Datenbank ist bereits eingerichtet — Schema, Storage-Bucket
und Zugriffsschutz stehen.

## 1. Projekt anlegen

1. [vercel.com/new](https://vercel.com/new) öffnen
2. Repository `kremer8034/Hausnotruf-bestellseite` importieren
3. Als Branch **`claude/hausnotruf-order-form-hx276x`** wählen (oder den Branch
   vorher nach `main` mergen, dann greift die Voreinstellung)
4. Framework wird als Next.js erkannt, Build- und Ausgabeeinstellungen bleiben
   unverändert

## 2. Umgebungsvariablen eintragen

Unter **Settings → Environment Variables**, jeweils für Production, Preview und
Development:

| Name | Wert |
|---|---|
| `SUPABASE_URL` | `https://qbkjpfpxpoydtlasbbuz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qbkjpfpxpoydtlasbbuz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFia2pwZnB4cG95ZHRsYXNiYnV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTgyMjQsImV4cCI6MjA5MDM3NDIyNH0.gvVZAcaxDSDMbYYjMN4-WzuNIMSNcppBsdpapTZlY0Y` |
| `SUPABASE_SERVICE_ROLE_KEY` | **selbst eintragen**, siehe unten |
| `NEXT_PUBLIC_BASIS_URL` | die Adresse, die Vercel vergibt, z. B. `https://hausnotruf-bestellseite.vercel.app` |
| `CRON_SECRET` | `798a642e2462e594dd3441c617cc91c496ecca0477813c2623df89ff3806e596` |

Den **Service-Role-Schlüssel** findet man im Supabase-Projekt unter
**Project Settings → API Keys → `service_role`**. Er gewährt vollen Zugriff auf
die Datenbank und darf nur als Umgebungsvariable in Vercel stehen — nie im Code,
nie in einer Datei im Repository.

Der `anon`-Schlüssel darf dagegen öffentlich sein: auf allen Tabellen ist RLS
aktiv, es gibt keine Policy, und `anon` wurden zusätzlich sämtliche Rechte
entzogen.

`NEXT_PUBLIC_BASIS_URL` erst nach dem ersten Deploy eintragen, wenn die Adresse
feststeht, und dann einmal neu bereitstellen.

## 3. Ersten Zugang anlegen

Ohne Zugang bleiben Backoffice und Technikbereich verschlossen. Die Anmeldung
liegt unter `/anmelden`.

Ein Zugang besteht immer aus **zwei** Teilen: dem Benutzer in Supabase Auth und
einem Eintrag in der Tabelle `profile`. Fehlt der zweite, wird die Anmeldung
abgewiesen, auch wenn das Passwort stimmt — das ist Absicht, damit ein
versehentlich angelegter Benutzer nicht sofort an die Verträge kommt.

### Weg 1: über die Oberfläche

1. Supabase → **Authentication → Users → Add user**
2. E-Mail und Passwort vergeben, **„Auto Confirm User" aktivieren**
3. Supabase → **SQL Editor**, mit derselben Adresse ausführen:

```sql
insert into profile (id, name, rolle)
select id, 'Daniel Zimmermann', 'admin'
from auth.users where email = 'hier.die@adresse.de';
```

### Weg 2: alles in einem Rutsch

Im **SQL Editor** ausführen, die drei Werte oben vorher anpassen:

```sql
with angaben as (
  select
    'hier.die@adresse.de'::text  as email,
    'BitteSofortAendern!'::text  as passwort,
    'Daniel Zimmermann'::text    as name,
    'admin'::benutzer_rolle      as rolle
),
neu as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  select
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    email, crypt(passwort, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', ''
  from angaben
  returning id
)
insert into profile (id, name, rolle)
select neu.id, angaben.name, angaben.rolle from neu, angaben
returning id, name, rolle;
```

Das Passwort steht dabei kurzzeitig im Klartext im SQL-Editor. Es sollte nach
der ersten Anmeldung über Supabase → **Authentication → Users → Reset password**
geändert werden.

### Rollen

| Rolle | Darf |
|---|---|
| `admin` | alles, einschließlich Einstellungen und SMTP-Zugang |
| `mitarbeiter` | Verträge sehen, Status ändern, exportieren |
| `techniker` | Terminliste und Vor-Ort-Erfassung |

Rolle nachträglich ändern oder Zugang sperren:

```sql
update profile set rolle = 'techniker' where id = (
  select id from auth.users where email = 'hier.die@adresse.de');

update profile set aktiv = false where id = (
  select id from auth.users where email = 'hier.die@adresse.de');
```

## 4. Erste Kontrolle

1. Startseite aufrufen, Preisrechner durchspielen
2. Unter `/anmelden` anmelden, **Backoffice → Einstellungen** öffnen
3. Die als Platzhalter markierten Werte ersetzen: IK-Nummer, Gläubiger-ID,
   Impressum-Adresse
4. SMTP-Zugang eintragen und über **Verbindung testen** prüfen
5. Eine Testbestellung bis zum Ende durchlaufen und das PDF gegenlesen

Solange kein SMTP-Zugang hinterlegt ist, wird der Vertrag zwar erzeugt und
gespeichert, aber nicht verschickt. Er liegt dann im Backoffice zum Herunterladen
bereit.

## 5. Täglicher Lauf

`vercel.json` richtet ihn automatisch ein: jeden Tag um 8 Uhr verschickt
`/api/aufraeumen` die Erinnerungsmails an abgebrochene Bestellungen und löscht
Entwürfe, die älter als 30 Tage sind. Ohne `CRON_SECRET` weist der Endpunkt jeden
Aufruf ab.
