-- Benutzerverwaltung im Backoffice.
--
-- Die Anmeldedaten liegen in auth.users, die Rolle in public.profile. Über
-- PostgREST ist das auth-Schema nicht erreichbar, deshalb liefert diese
-- Funktion die zusammengeführte Liste.

create or replace function benutzerliste()
returns table (
  id               uuid,
  email            text,
  name             text,
  rolle            benutzer_rolle,
  aktiv            boolean,
  erstellt_am      timestamptz,
  letzte_anmeldung timestamptz,
  bestaetigt       boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    p.id,
    u.email::text,
    p.name,
    p.rolle,
    p.aktiv,
    p.erstellt_am,
    u.last_sign_in_at,
    u.email_confirmed_at is not null
  from public.profile p
  join auth.users u on u.id = p.id
  order by
    case p.rolle when 'admin' then 1 when 'mitarbeiter' then 2 else 3 end,
    lower(p.name),
    u.email;
$$;

revoke execute on function benutzerliste() from anon, authenticated, public;
