-- Gestionale Practical Type Training – schema Supabase (PostgreSQL).
-- Eseguire DOPO database/catalogo.sql. Lo script si può rieseguire.
--
-- Sicurezza (Row Level Security):
--   frequentatore  legge e scrive solo le proprie righe (Personal Data, logbook);
--   istruttore     legge tutto, non scrive;
--   admin (TM)     legge e scrive tutto; crea gli account tramite la Edge Function "gestione-utenti".


-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------

create table if not exists public.istruttori (
  id uuid primary key default gen_random_uuid(),
  grado text not null check (length(trim(grado)) between 1 and 60),
  nome text not null check (length(trim(nome)) between 1 and 80),
  cognome text not null check (length(trim(cognome)) between 1 and 80),
  created_at timestamptz not null default now(),
  created_by uuid
);
create unique index if not exists istruttori_unico on public.istruttori (lower(grado), lower(nome), lower(cognome));

create table if not exists public.profili (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,39}$'),
  ruolo text not null check (ruolo in ('admin', 'instructor', 'trainee')),
  nome text not null default '' check (length(nome) <= 100),
  attivo boolean not null default true,
  istruttore_id uuid references public.istruttori on delete set null,
  deve_cambiare_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.anagrafiche (
  user_id uuid primary key references public.profili on delete cascade,
  grado text not null check (length(trim(grado)) between 1 and 60),
  nome text not null check (length(trim(nome)) between 1 and 80),
  cognome text not null check (length(trim(cognome)) between 1 and 80),
  data_nascita date not null check (data_nascita <= current_date),
  citta_nascita text not null check (length(trim(citta_nascita)) between 1 and 80),
  maml text not null default '' check (length(maml) <= 40),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.training_data (
  user_id uuid primary key references public.profili on delete cascade,
  data_inizio date,
  data_fine date,
  maintenance_organization text not null default '' check (length(maintenance_organization) <= 200),
  location text not null default '' check (length(location) <= 100),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (data_fine is null or data_inizio is null or data_fine >= data_inizio)
);

create table if not exists public.registrazioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profili on delete cascade,
  task_id int not null references public.task,
  maintenance_location text not null check (length(trim(maintenance_location)) between 1 and 100),
  data date not null,
  tipo_esecuzione text not null check (tipo_esecuzione in ('AC', 'SIM', 'CLA')),
  matricola text not null default '' check (length(matricola) <= 60),
  et_minuti int not null check (et_minuti between 1 and 1440),
  instructor_id uuid not null references public.istruttori,
  creato_il timestamptz not null default now(),
  creato_da uuid,
  modificato_il timestamptz not null default now(),
  modificato_da uuid,
  check ((tipo_esecuzione = 'AC') = (length(trim(matricola)) > 0))
);
create index if not exists registrazioni_utente on public.registrazioni (user_id);

-- ---------------------------------------------------------------------------
-- Funzioni di supporto
-- ---------------------------------------------------------------------------

-- ruolo dell'utente collegato, solo se l'account è attivo
create or replace function public.ptt_ruolo() returns text
language sql stable security definer set search_path = public as $$
  select ruolo from public.profili where id = auth.uid() and attivo
$$;

create or replace function public.ptt_legge_tutto() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ptt_ruolo() in ('admin', 'instructor'), false)
$$;

-- traccia autore e istante di ogni modifica; la data non può essere futura
create or replace function public.ptt_traccia_registrazione() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.data > current_date then
    raise exception 'La data del task non può essere futura' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    new.creato_il := now();
    new.creato_da := auth.uid();
  else
    new.creato_il := old.creato_il;
    new.creato_da := old.creato_da;
    if new.user_id <> old.user_id then
      raise exception 'Non è possibile spostare una registrazione su un altro frequentatore' using errcode = 'P0001';
    end if;
  end if;
  new.modificato_il := now();
  new.modificato_da := auth.uid();
  if new.tipo_esecuzione <> 'AC' then new.matricola := ''; end if;
  return new;
end $$;

drop trigger if exists traccia on public.registrazioni;
create trigger traccia before insert or update on public.registrazioni
for each row execute function public.ptt_traccia_registrazione();

create or replace function public.ptt_traccia_aggiornamento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists traccia on public.anagrafiche;
create trigger traccia before insert or update on public.anagrafiche
for each row execute function public.ptt_traccia_aggiornamento();
drop trigger if exists traccia on public.training_data;
create trigger traccia before insert or update on public.training_data
for each row execute function public.ptt_traccia_aggiornamento();

create or replace function public.ptt_traccia_istruttore() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists traccia on public.istruttori;
create trigger traccia before insert on public.istruttori
for each row execute function public.ptt_traccia_istruttore();

create or replace function public.ptt_profilo_aggiornato() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists aggiornato on public.profili;
create trigger aggiornato before update on public.profili
for each row execute function public.ptt_profilo_aggiornato();

-- stato dell'installazione, leggibile prima dell'accesso
create or replace function public.ptt_stato() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('admin', exists (select 1 from public.profili where ruolo = 'admin' and attivo))
$$;

-- primo accesso: l'utente creato a mano nel pannello Supabase diventa Training Manager se non ne esiste uno
create or replace function public.ptt_primo_admin(p_username text, p_nome text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  if exists (select 1 from public.profili where ruolo = 'admin') then
    raise exception 'Il Training Manager è già configurato' using errcode = 'P0001';
  end if;
  insert into public.profili (id, username, ruolo, nome, deve_cambiare_password)
  values (auth.uid(), lower(trim(p_username)), 'admin', trim(p_nome), false);
end $$;

-- dopo il cambio della password provvisoria
create or replace function public.ptt_password_cambiata() returns void
language sql security definer set search_path = public as $$
  update public.profili set deve_cambiare_password = false where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profili enable row level security;
alter table public.anagrafiche enable row level security;
alter table public.training_data enable row level security;
alter table public.istruttori enable row level security;
alter table public.registrazioni enable row level security;
alter table public.moduli enable row level security;
alter table public.task_type enable row level security;
alter table public.chapter enable row level security;
alter table public.task enable row level security;

drop policy if exists lettura on public.moduli;
create policy lettura on public.moduli for select to authenticated using (true);
drop policy if exists lettura on public.task_type;
create policy lettura on public.task_type for select to authenticated using (true);
drop policy if exists lettura on public.chapter;
create policy lettura on public.chapter for select to authenticated using (true);
drop policy if exists lettura on public.task;
create policy lettura on public.task for select to authenticated using (true);

drop policy if exists lettura on public.profili;
create policy lettura on public.profili for select to authenticated
  using (id = auth.uid() or public.ptt_legge_tutto());
drop policy if exists admin on public.profili;
create policy admin on public.profili for update to authenticated
  using (public.ptt_ruolo() = 'admin') with check (public.ptt_ruolo() = 'admin');

drop policy if exists lettura on public.anagrafiche;
create policy lettura on public.anagrafiche for select to authenticated
  using ((user_id = auth.uid() and public.ptt_ruolo() is not null) or public.ptt_legge_tutto());
drop policy if exists scrittura on public.anagrafiche;
create policy scrittura on public.anagrafiche for all to authenticated
  using (public.ptt_ruolo() = 'admin' or (user_id = auth.uid() and public.ptt_ruolo() = 'trainee'))
  with check (public.ptt_ruolo() = 'admin' or (user_id = auth.uid() and public.ptt_ruolo() = 'trainee'));

drop policy if exists lettura on public.training_data;
create policy lettura on public.training_data for select to authenticated
  using ((user_id = auth.uid() and public.ptt_ruolo() is not null) or public.ptt_legge_tutto());
drop policy if exists scrittura on public.training_data;
create policy scrittura on public.training_data for all to authenticated
  using (public.ptt_ruolo() = 'admin') with check (public.ptt_ruolo() = 'admin');

drop policy if exists lettura on public.istruttori;
create policy lettura on public.istruttori for select to authenticated using (public.ptt_ruolo() is not null);
drop policy if exists inserimento on public.istruttori;
create policy inserimento on public.istruttori for insert to authenticated with check (public.ptt_ruolo() in ('admin', 'trainee'));
drop policy if exists modifica on public.istruttori;
create policy modifica on public.istruttori for update to authenticated
  using (public.ptt_ruolo() = 'admin') with check (public.ptt_ruolo() = 'admin');

drop policy if exists lettura on public.registrazioni;
create policy lettura on public.registrazioni for select to authenticated
  using ((user_id = auth.uid() and public.ptt_ruolo() is not null) or public.ptt_legge_tutto());
drop policy if exists scrittura on public.registrazioni;
create policy scrittura on public.registrazioni for all to authenticated
  using (public.ptt_ruolo() = 'admin' or (user_id = auth.uid() and public.ptt_ruolo() = 'trainee'))
  with check (public.ptt_ruolo() = 'admin' or (user_id = auth.uid() and public.ptt_ruolo() = 'trainee'));

-- ---------------------------------------------------------------------------
-- Permessi e tempo reale
-- ---------------------------------------------------------------------------

revoke all on public.profili, public.anagrafiche, public.training_data, public.istruttori, public.registrazioni from anon;
grant select, update on public.profili to authenticated;
grant select, insert, update, delete on public.anagrafiche, public.training_data, public.registrazioni to authenticated;
grant select, insert, update on public.istruttori to authenticated;
grant select on public.moduli, public.task_type, public.chapter, public.task to authenticated;
grant execute on function public.ptt_stato() to anon, authenticated;
grant execute on function public.ptt_primo_admin(text, text), public.ptt_password_cambiata() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['profili', 'anagrafiche', 'training_data', 'istruttori', 'registrazioni'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
