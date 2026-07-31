-- Passwort-Rücksetzung für Backoffice- und Technikzugänge.
--
-- Der Versand läuft über den SMTP-Zugang der Anwendung, nicht über den
-- Mailversand von Supabase: sonst gäbe es zwei getrennte Wege, und der
-- eingebaute Versand von Supabase ist auf wenige Mails pro Stunde begrenzt.
--
-- Gespeichert wird nur der SHA-256-Abdruck des Tokens. Wer die Tabelle liest,
-- kann damit nichts anfangen - das Original steht ausschließlich im Link, den
-- der Empfänger per E-Mail bekommt.

create table if not exists passwort_anfragen (
  id            uuid primary key default gen_random_uuid(),
  benutzer_id   uuid not null references auth.users (id) on delete cascade,
  token_hash    text not null unique,
  gueltig_bis   timestamptz not null,
  verwendet_am  timestamptz,
  angefordert_von inet,
  erstellt_am   timestamptz not null default now()
);

create index if not exists passwort_anfragen_benutzer_idx
  on passwort_anfragen (benutzer_id, erstellt_am desc);

comment on table passwort_anfragen is
  'Einmal-Links zum Zurücksetzen des Passworts. Eine Stunde gültig.';

alter table passwort_anfragen enable row level security;
revoke all on table passwort_anfragen from anon, authenticated;

-- Nach einer Rücksetzung sollen bestehende Anmeldungen enden, sonst bliebe
-- ein Angreifer eingeloggt, obwohl das Passwort gewechselt wurde. Das
-- Supabase-SDK bietet dafür keinen Aufruf, deshalb dieser Umweg.
create or replace function beende_sitzungen(p_benutzer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.sessions where user_id = p_benutzer;
  delete from auth.refresh_tokens where user_id = p_benutzer::text;
end;
$$;

revoke execute on function beende_sitzungen(uuid) from anon, authenticated, public;

-- Aufräumen: abgelaufene und benutzte Anfragen verfallen nach sieben Tagen.
create or replace function raeume_passwort_anfragen()
returns integer
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  entfernt integer;
begin
  delete from passwort_anfragen
   where erstellt_am < now() - interval '7 days';
  get diagnostics entfernt = row_count;
  return entfernt;
end;
$$;

revoke execute on function raeume_passwort_anfragen() from anon, authenticated, public;

-- Supabase bietet im SDK keine Suche nach E-Mail-Adresse; listUsers müsste
-- alle Zugänge durchblättern. Diese Funktion trifft direkt.
create or replace function benutzer_id_zu_email(p_email text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke execute on function benutzer_id_zu_email(text) from anon, authenticated, public;
