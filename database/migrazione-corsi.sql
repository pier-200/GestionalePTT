-- Migrazione del database installato prima dei corsi (settembre 2026): tutto ciò che c'era
-- apparteneva a un unico corso, che qui viene creato e collegato ai dati esistenti.
-- Eseguire UNA VOLTA nel SQL Editor, prima di rilanciare database/schema.sql. È ripetibile.

begin;

-- 1. il ruolo "direttore del corso"
alter table public.profili drop constraint if exists profili_ruolo_check;
alter table public.profili add constraint profili_ruolo_check check (ruolo in ('admin', 'direttore', 'instructor', 'trainee'));

-- 2. tabella dei corsi (se lo schema nuovo non è ancora stato eseguito)
create table if not exists public.corsi (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique,
  nome text not null,
  programma_teorico text,
  programma_pratico text,
  data_inizio date,
  data_fine date,
  maintenance_organization text not null default '',
  location text not null default '',
  ora_inizio text not null default '08:30',
  minuti_giorno int[] not null default '{360,360,360,360,180}',
  attivo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.iscrizioni (
  id uuid primary key default gen_random_uuid(),
  corso_id uuid not null references public.corsi on delete cascade,
  user_id uuid not null references public.profili on delete cascade,
  ruolo text not null check (ruolo in ('direttore', 'instructor', 'trainee')),
  created_at timestamptz not null default now(),
  unique (corso_id, user_id)
);

-- 3. il corso che raccoglie i dati già presenti
insert into public.corsi (codice, nome, programma_teorico, programma_pratico, data_inizio, data_fine, maintenance_organization, location)
select 'T1-2026/1', 'T1 Type Training CH-47F Cat. B1.3 – 1° corso 2026', 'mtt-ch47f-b13', 'ptr-ch47f-b13',
       (select min(data_inizio) from public.training_data),
       (select max(data_fine) from public.training_data),
       coalesce((select max(maintenance_organization) from public.training_data), ''),
       coalesce((select max(location) from public.training_data), '')
where not exists (select 1 from public.corsi);

-- 4. registrazioni e training data passano sotto quel corso
alter table public.registrazioni add column if not exists corso_id uuid references public.corsi on delete cascade;
update public.registrazioni set corso_id = (select id from public.corsi order by created_at limit 1) where corso_id is null;
alter table public.registrazioni alter column corso_id set not null;
-- il catalogo dei task ora vive nell'applicazione: via il vincolo verso le vecchie tabelle
alter table public.registrazioni drop constraint if exists registrazioni_task_id_fkey;
alter table public.registrazioni drop constraint if exists registrazioni_task_id_check;
alter table public.registrazioni add constraint registrazioni_task_id_check check (task_id > 0);
drop index if exists registrazioni_utente;
create index if not exists registrazioni_utente on public.registrazioni (corso_id, user_id);

alter table public.training_data add column if not exists corso_id uuid references public.corsi on delete cascade;
update public.training_data set corso_id = (select id from public.corsi order by created_at limit 1) where corso_id is null;
alter table public.training_data alter column corso_id set not null;
alter table public.training_data drop constraint if exists training_data_pkey;
alter table public.training_data add primary key (corso_id, user_id);

-- 5. iscrizioni: ogni account esistente entra nel corso con il proprio ruolo
insert into public.iscrizioni (corso_id, user_id, ruolo)
select c.id, p.id, case when p.ruolo = 'trainee' then 'trainee' when p.ruolo = 'direttore' then 'direttore' else 'instructor' end
from public.profili p cross join (select id from public.corsi order by created_at limit 1) c
where p.ruolo <> 'admin'
on conflict (corso_id, user_id) do nothing;

-- 6. le tabelle del catalogo non servono più (i programmi stanno nell'applicazione)
drop table if exists public.task, public.chapter, public.task_type, public.moduli cascade;

commit;
