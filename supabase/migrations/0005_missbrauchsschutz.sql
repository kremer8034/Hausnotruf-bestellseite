-- Bremse gegen automatisierte Zugriffe.
--
-- Die Seite läuft auf mehreren Instanzen gleichzeitig; ein Zähler im
-- Arbeitsspeicher würde deshalb nichts bringen. Er gehört in die Datenbank,
-- die alle Instanzen gemeinsam sehen.
--
-- Gespeichert wird nie die IP-Adresse selbst, sondern nur ihr Abdruck
-- (SHA-256 mit Zweck-Präfix). Für die Zählung genügt das, und aus der Tabelle
-- lässt sich niemand zurückverfolgen.

create table if not exists zugriffszaehler (
  id          bigserial primary key,
  schluessel  text        not null,
  erstellt_am timestamptz not null default now()
);

comment on table zugriffszaehler is
  'Zeitstempel je Zugriffsabdruck für die Missbrauchsbremse. Enthält keine Klardaten.';

create index if not exists zugriffszaehler_schluessel_idx
  on zugriffszaehler (schluessel, erstellt_am desc);

alter table zugriffszaehler enable row level security;
revoke all on zugriffszaehler from anon, authenticated;
revoke all on sequence zugriffszaehler_id_seq from anon, authenticated;

/**
 * Prüft und zählt in einem Schritt.
 *
 * Liefert true, wenn der Zugriff im Rahmen liegt - und vermerkt ihn dann
 * gleich. Liefert false, wenn die Grenze erreicht ist; abgewiesene Versuche
 * werden nicht mitgezählt, sonst könnte sich eine Sperre endlos verlängern.
 */
create or replace function zugriff_erlaubt(
  p_schluessel text,
  p_sekunden   integer,
  p_grenze     integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  anzahl integer;
begin
  -- Alte Einträge gelegentlich wegräumen. Bei jedem Aufruf zu löschen wäre
  -- teurer als der eigentliche Zweck der Funktion.
  if random() < 0.01 then
    delete from public.zugriffszaehler
     where erstellt_am < now() - interval '2 days';
  end if;

  select count(*) into anzahl
    from public.zugriffszaehler
   where schluessel = p_schluessel
     and erstellt_am > now() - make_interval(secs => p_sekunden);

  if anzahl >= p_grenze then
    return false;
  end if;

  insert into public.zugriffszaehler (schluessel) values (p_schluessel);
  return true;
end;
$$;

revoke execute on function zugriff_erlaubt(text, integer, integer)
  from anon, authenticated, public;

/** Räumt die Zähler auf; wird vom täglichen Lauf mit aufgerufen. */
create or replace function raeume_zugriffszaehler()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  anzahl integer;
begin
  delete from public.zugriffszaehler
   where erstellt_am < now() - interval '2 days';
  get diagnostics anzahl = row_count;
  return anzahl;
end;
$$;

revoke execute on function raeume_zugriffszaehler() from anon, authenticated, public;
