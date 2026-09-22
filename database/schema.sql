-- Gestionale Type Training – schema Supabase (PostgreSQL). Lo script si può rieseguire.
--
-- Corsi con parte teorica (MTT) e/o pratica (PTT). I programmi (catalogo task e materie)
-- stanno nell'applicazione, non qui: il database conserva solo i dati del corso.
--
-- Sicurezza (Row Level Security), sempre limitata ai corsi a cui si è iscritti:
--   frequentatore  legge e scrive solo le proprie righe (Personal Data, logbook);
--   istruttore     legge tutto il corso, non scrive;
--   direttore      come l'istruttore, più programma teorico, iscrizioni e dati del corso;
--   admin (TM)     tutto, su tutti i corsi; crea gli account con la Edge Function "gestione-utenti".

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
  ruolo text not null check (ruolo in ('admin', 'direttore', 'instructor', 'trainee')),
  nome text not null default '' check (length(nome) <= 100),
  attivo boolean not null default true,
  istruttore_id uuid references public.istruttori on delete set null,
  deve_cambiare_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.corsi (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique check (length(trim(codice)) between 1 and 30),
  nome text not null check (length(trim(nome)) between 1 and 120),
  programma_teorico text,
  programma_pratico text,
  data_inizio date,
  data_fine date,
  maintenance_organization text not null default '' check (length(maintenance_organization) <= 200),
  location text not null default '' check (length(location) <= 100),
  ora_inizio text not null default '08:30' check (ora_inizio ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  minuti_giorno int[] not null default '{360,360,360,360,180}',
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (programma_teorico is not null or programma_pratico is not null),
  check (data_fine is null or data_inizio is null or data_fine >= data_inizio),
  check (array_length(minuti_giorno, 1) = 5)
);

create table if not exists public.iscrizioni (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi on delete cascade,
  user_id uuid not null references public.profili on delete cascade,
  ruolo text not null check (ruolo in ('direttore', 'instructor', 'trainee')),
  created_at timestamptz not null default now(),
  unique (corso_id, user_id)
);
create index if not exists iscrizioni_utente on public.iscrizioni (user_id);

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
  corso_id uuid not null references public.corsi on delete cascade,
  user_id uuid not null references public.profili on delete cascade,
  data_inizio date,
  data_fine date,
  maintenance_organization text not null default '' check (length(maintenance_organization) <= 200),
  location text not null default '' check (length(location) <= 100),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (corso_id, user_id),
  check (data_fine is null or data_inizio is null or data_fine >= data_inizio)
);

create table if not exists public.registrazioni (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi on delete cascade,
  user_id uuid not null references public.profili on delete cascade,
  -- il task appartiene al programma pratico del corso, che vive nell'applicazione
  task_id int not null check (task_id > 0),
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
create index if not exists registrazioni_utente on public.registrazioni (corso_id, user_id);

create table if not exists public.lezioni (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi on delete cascade,
  data date not null,
  ordine int not null check (ordine between 0 and 20),
  minuti int not null check (minuti between 15 and 600),
  -- id della materia nel programma teorico del corso
  materia text not null,
  istruttore_id uuid references public.profili on delete set null,
  note text not null default '' check (length(note) <= 300),
  creato_il timestamptz not null default now(),
  modificato_il timestamptz not null default now(),
  modificato_da uuid,
  unique (corso_id, data, ordine)
);
create index if not exists lezioni_corso on public.lezioni (corso_id, data);

create table if not exists public.abilitazioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profili on delete cascade,
  programma text not null,
  materia text not null,
  unique (user_id, programma, materia)
);

-- ---------------------------------------------------------------------------
-- Funzioni di supporto
-- ---------------------------------------------------------------------------

-- ruolo dell'utente collegato, solo se l'account è attivo
create or replace function public.ptt_ruolo() returns text
language sql stable security definer set search_path = public as $$
  select ruolo from public.profili where id = auth.uid() and attivo
$$;

create or replace function public.ptt_e_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ptt_ruolo() = 'admin', false)
$$;

-- iscritto al corso (o Training Manager): può leggerne i dati
create or replace function public.ptt_membro(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ptt_e_admin() or (public.ptt_ruolo() is not null and exists (
    select 1 from public.iscrizioni i where i.corso_id = c and i.user_id = auth.uid()))
$$;

-- guida il corso: Training Manager o direttore iscritto
create or replace function public.ptt_guida(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ptt_e_admin() or exists (
    select 1 from public.iscrizioni i where i.corso_id = c and i.user_id = auth.uid() and i.ruolo = 'direttore')
$$;

-- fa parte dello staff (direttore o istruttore) di un corso frequentato dall'utente indicato
create or replace function public.ptt_staff_di(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.ptt_e_admin() or exists (
    select 1 from public.iscrizioni mia
    join public.iscrizioni sua on sua.corso_id = mia.corso_id
    where mia.user_id = auth.uid() and mia.ruolo in ('direttore', 'instructor') and sua.user_id = u)
$$;

-- traccia autore e istante di ogni modifica; la data non può essere futura.
-- Senza utente collegato (SQL Editor, chiave di servizio, importazioni) si conservano i valori forniti.
create or replace function public.ptt_traccia_registrazione() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.data > current_date then
    raise exception 'La data del task non può essere futura' using errcode = 'P0001';
  end if;
  if new.tipo_esecuzione <> 'AC' then new.matricola := ''; end if;
  if not exists (select 1 from public.iscrizioni i where i.corso_id = new.corso_id and i.user_id = new.user_id and i.ruolo = 'trainee') then
    raise exception 'Il frequentatore non è iscritto a questo corso' using errcode = 'P0001';
  end if;
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.creato_il := now();
    new.creato_da := auth.uid();
  else
    new.creato_il := old.creato_il;
    new.creato_da := old.creato_da;
    if new.user_id <> old.user_id or new.corso_id <> old.corso_id then
      raise exception 'Non è possibile spostare una registrazione su un altro frequentatore o corso' using errcode = 'P0001';
    end if;
  end if;
  new.modificato_il := now();
  new.modificato_da := auth.uid();
  return new;
end $$;

drop trigger if exists traccia on public.registrazioni;
create trigger traccia before insert or update on public.registrazioni
for each row execute function public.ptt_traccia_registrazione();

create or replace function public.ptt_traccia_aggiornamento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
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
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_at := now();
    new.created_by := auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists traccia on public.istruttori;
create trigger traccia before insert on public.istruttori
for each row execute function public.ptt_traccia_istruttore();

create or replace function public.ptt_traccia_lezione() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then new.creato_il := now(); else new.creato_il := old.creato_il; end if;
  new.modificato_il := now();
  new.modificato_da := auth.uid();
  return new;
end $$;
drop trigger if exists traccia on public.lezioni;
create trigger traccia before insert or update on public.lezioni
for each row execute function public.ptt_traccia_lezione();

create or replace function public.ptt_aggiornato() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists aggiornato on public.profili;
create trigger aggiornato before update on public.profili
for each row execute function public.ptt_aggiornato();
drop trigger if exists aggiornato on public.corsi;
create trigger aggiornato before update on public.corsi
for each row execute function public.ptt_aggiornato();

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
alter table public.corsi enable row level security;
alter table public.iscrizioni enable row level security;
alter table public.anagrafiche enable row level security;
alter table public.training_data enable row level security;
alter table public.istruttori enable row level security;
alter table public.registrazioni enable row level security;
alter table public.lezioni enable row level security;
alter table public.abilitazioni enable row level security;

drop policy if exists lettura on public.profili;
-- i nomi degli account servono per gli elenchi (istruttore della lezione, autore di una modifica)
create policy lettura on public.profili for select to authenticated using (public.ptt_ruolo() is not null);
drop policy if exists admin on public.profili;
create policy admin on public.profili for update to authenticated
  using (public.ptt_e_admin()) with check (public.ptt_e_admin());

drop policy if exists lettura on public.corsi;
create policy lettura on public.corsi for select to authenticated using (public.ptt_membro(id));
drop policy if exists creazione on public.corsi;
create policy creazione on public.corsi for insert to authenticated with check (public.ptt_e_admin());
drop policy if exists modifica on public.corsi;
create policy modifica on public.corsi for update to authenticated using (public.ptt_guida(id)) with check (public.ptt_guida(id));
drop policy if exists eliminazione on public.corsi;
create policy eliminazione on public.corsi for delete to authenticated using (public.ptt_e_admin());

drop policy if exists lettura on public.iscrizioni;
create policy lettura on public.iscrizioni for select to authenticated using (public.ptt_membro(corso_id));
drop policy if exists scrittura on public.iscrizioni;
create policy scrittura on public.iscrizioni for all to authenticated
  using (public.ptt_guida(corso_id)) with check (public.ptt_guida(corso_id));

drop policy if exists lettura on public.anagrafiche;
create policy lettura on public.anagrafiche for select to authenticated
  using (user_id = auth.uid() or public.ptt_staff_di(user_id));
drop policy if exists scrittura on public.anagrafiche;
create policy scrittura on public.anagrafiche for all to authenticated
  using (public.ptt_e_admin() or (user_id = auth.uid() and public.ptt_ruolo() = 'trainee'))
  with check (public.ptt_e_admin() or (user_id = auth.uid() and public.ptt_ruolo() = 'trainee'));

drop policy if exists lettura on public.training_data;
create policy lettura on public.training_data for select to authenticated
  using ((user_id = auth.uid() and public.ptt_membro(corso_id)) or (public.ptt_membro(corso_id) and public.ptt_staff_di(user_id)));
drop policy if exists scrittura on public.training_data;
create policy scrittura on public.training_data for all to authenticated
  using (public.ptt_guida(corso_id)) with check (public.ptt_guida(corso_id));

drop policy if exists lettura on public.istruttori;
create policy lettura on public.istruttori for select to authenticated using (public.ptt_ruolo() is not null);
drop policy if exists inserimento on public.istruttori;
create policy inserimento on public.istruttori for insert to authenticated with check (public.ptt_ruolo() in ('admin', 'direttore', 'trainee'));
drop policy if exists modifica on public.istruttori;
create policy modifica on public.istruttori for update to authenticated
  using (public.ptt_ruolo() in ('admin', 'direttore')) with check (public.ptt_ruolo() in ('admin', 'direttore'));

drop policy if exists lettura on public.registrazioni;
create policy lettura on public.registrazioni for select to authenticated
  using ((user_id = auth.uid() and public.ptt_membro(corso_id)) or (public.ptt_membro(corso_id) and public.ptt_staff_di(user_id)));
drop policy if exists scrittura on public.registrazioni;
create policy scrittura on public.registrazioni for all to authenticated
  using (public.ptt_e_admin() or (user_id = auth.uid() and public.ptt_ruolo() = 'trainee'))
  with check (public.ptt_e_admin() or (user_id = auth.uid() and public.ptt_ruolo() = 'trainee'));

drop policy if exists lettura on public.lezioni;
create policy lettura on public.lezioni for select to authenticated using (public.ptt_membro(corso_id));
drop policy if exists scrittura on public.lezioni;
create policy scrittura on public.lezioni for all to authenticated
  using (public.ptt_guida(corso_id)) with check (public.ptt_guida(corso_id));

drop policy if exists lettura on public.abilitazioni;
create policy lettura on public.abilitazioni for select to authenticated using (public.ptt_ruolo() is not null);
drop policy if exists scrittura on public.abilitazioni;
create policy scrittura on public.abilitazioni for all to authenticated
  using (public.ptt_ruolo() in ('admin', 'direttore')) with check (public.ptt_ruolo() in ('admin', 'direttore'));

-- ---------------------------------------------------------------------------
-- Permessi e tempo reale
-- ---------------------------------------------------------------------------

revoke all on public.profili, public.corsi, public.iscrizioni, public.anagrafiche, public.training_data,
  public.istruttori, public.registrazioni, public.lezioni, public.abilitazioni from anon;
grant select, update on public.profili to authenticated;
grant select, insert, update, delete on public.corsi, public.iscrizioni, public.anagrafiche, public.training_data,
  public.registrazioni, public.lezioni, public.abilitazioni to authenticated;
grant select, insert, update on public.istruttori to authenticated;
-- chiave di servizio (Edge Function gestione-utenti e script di amministrazione): scavalca RLS ma servono i privilegi
grant select, insert, update, delete on public.profili, public.corsi, public.iscrizioni, public.anagrafiche,
  public.training_data, public.istruttori, public.registrazioni, public.lezioni, public.abilitazioni to service_role;
grant execute on function public.ptt_stato() to anon, authenticated;
grant execute on function public.ptt_primo_admin(text, text), public.ptt_password_cambiata() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['profili', 'corsi', 'iscrizioni', 'anagrafiche', 'training_data', 'istruttori', 'registrazioni', 'lezioni', 'abilitazioni'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
