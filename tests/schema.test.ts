import { PGlite, type Transaction } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

/** Schema Supabase su PostgreSQL reale (PGlite) con una simulazione minima di auth, ruoli e pubblicazione realtime. */

const STUB = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
create publication supabase_realtime;
`;
const SCHEMA = readFileSync(resolve(__dirname, '../database/schema.sql'), 'utf8');

const U = {
  tm: '00000000-0000-4000-8000-000000000001',
  dir: '00000000-0000-4000-8000-000000000002',
  ist: '00000000-0000-4000-8000-000000000003',
  a: '00000000-0000-4000-8000-000000000004',
  b: '00000000-0000-4000-8000-000000000005',
  altro: '00000000-0000-4000-8000-000000000006',
  istAltro: '00000000-0000-4000-8000-000000000007',
};
const C1 = '10000000-0000-4000-8000-000000000001';
const C2 = '10000000-0000-4000-8000-000000000002';
const I1 = '20000000-0000-4000-8000-000000000001';
let db: PGlite;

async function come<T>(utente: string | null, fn: (tx: Transaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${utente ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [utente ?? '']);
    return fn(tx);
  });
}
const righe = (u: string | null, sql: string, p: unknown[] = []) => come(u, async (tx) => (await tx.query<Record<string, unknown>>(sql, p)).rows);
const uno = async (u: string | null, sql: string, p: unknown[] = []) => (await righe(u, sql, p))[0];
const errore = async (u: string | null, sql: string, p: unknown[] = []) => {
  try {
    await righe(u, sql, p);
  } catch (e) {
    return (e as Error).message;
  }
  return 'NESSUN ERRORE';
};
const reg = (corso: string, user: string) =>
  `insert into public.registrazioni (corso_id, user_id, task_id, maintenance_location, data, tipo_esecuzione, matricola, et_minuti, instructor_id)
   values ('${corso}', '${user}', 1, 'Hangar', current_date, 'AC', 'MM81781', 30, '${I1}') returning id`;
const lezione = (corso: string, data: string, istruttore: string | null) =>
  `insert into public.lezioni (corso_id, data, ordine, minuti, materia, istruttore_id) values ('${corso}', '${data}', 0, 120, 'm001', ${istruttore ? `'${istruttore}'` : 'null'}) returning id`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB);
  for (let i = 0; i < 2; i++) await db.exec(SCHEMA); // due volte: lo script deve poter essere rieseguito
  for (const id of Object.values(U)) await db.query('insert into auth.users values ($1, $2)', [id, `${id}@ptt.local`]);
  expect((await uno(null, 'select public.ptt_stato() as s')).s).toEqual({ admin: false });
  await righe(U.tm, `select public.ptt_primo_admin('tm.ferri', 'Magg. Ferri')`);
  expect(await errore(U.a, `select public.ptt_primo_admin('furbo', 'x')`)).toMatch(/già configurato/);
  await db.exec(`
    insert into public.istruttori (id, grado, nome, cognome) values ('${I1}', 'Mar.', 'Paolo', 'Rinaldi');
    insert into public.profili (id, username, ruolo) values
      ('${U.dir}', 'marco.neri', 'direttore'), ('${U.ist}', 'paolo.rinaldi', 'instructor'),
      ('${U.a}', 'utente.a', 'trainee'), ('${U.b}', 'utente.b', 'trainee'),
      ('${U.altro}', 'utente.altro', 'trainee'), ('${U.istAltro}', 'istruttore.altro', 'instructor');
    insert into public.corsi (id, codice, nome, programma_teorico, programma_pratico) values
      ('${C1}', 'T1-2026/1', 'Primo corso', 'mtt-ch47f-b13', 'ptr-ch47f-b13'),
      ('${C2}', 'T1-2026/2', 'Secondo corso', 'mtt-ch47f-b13', null);
    insert into public.iscrizioni (corso_id, user_id, ruolo) values
      ('${C1}', '${U.dir}', 'direttore'), ('${C1}', '${U.ist}', 'instructor'),
      ('${C1}', '${U.a}', 'trainee'), ('${C1}', '${U.b}', 'trainee'),
      ('${C2}', '${U.altro}', 'trainee'), ('${C2}', '${U.istAltro}', 'instructor');`);
});

describe('corsi e iscrizioni', () => {
  it('ognuno vede solo i corsi a cui è iscritto, il TM tutti', () => {
    return Promise.all([
      righe(U.a, 'select codice from public.corsi').then((r) => expect(r.map((x) => x.codice)).toEqual(['T1-2026/1'])),
      righe(U.istAltro, 'select codice from public.corsi').then((r) => expect(r.map((x) => x.codice)).toEqual(['T1-2026/2'])),
      righe(U.tm, 'select codice from public.corsi').then((r) => expect(r).toHaveLength(2)),
    ]);
  });

  it('solo TM e direttore iscrivono; il TM crea i corsi', async () => {
    expect(await righe(U.dir, `insert into public.iscrizioni (corso_id, user_id, ruolo) values ('${C1}', '${U.altro}', 'trainee') returning id`)).toHaveLength(1);
    expect(await errore(U.ist, `insert into public.iscrizioni (corso_id, user_id, ruolo) values ('${C2}', '${U.b}', 'trainee')`)).toMatch(/row-level security/);
    expect(await errore(U.dir, `insert into public.corsi (codice, nome, programma_teorico) values ('X', 'X', 'mtt-ch47f-b13')`)).toMatch(/row-level security/);
    await righe(U.tm, `delete from public.iscrizioni where corso_id = '${C1}' and user_id = '${U.altro}'`);
  });
});

describe('logbook (parte pratica)', () => {
  it('il frequentatore scrive solo nel proprio corso e vede solo le proprie righe', async () => {
    const [r] = await righe(U.a, reg(C1, U.a));
    expect(r.id).toBeTruthy();
    expect(await errore(U.a, reg(C1, U.b))).toMatch(/row-level security/);
    expect(await errore(U.altro, reg(C1, U.altro))).toMatch(/row-level security|non è iscritto/);
    await righe(U.b, reg(C1, U.b));
    expect((await righe(U.a, 'select user_id from public.registrazioni')).map((x) => x.user_id)).toEqual([U.a]);
  });

  it('lo staff vede le righe del proprio corso, non quelle degli altri corsi', async () => {
    expect((await uno(U.ist, 'select count(*)::int n from public.registrazioni')).n).toBe(2);
    expect((await uno(U.istAltro, 'select count(*)::int n from public.registrazioni')).n).toBe(0);
    expect(await errore(U.ist, reg(C1, U.a))).toMatch(/row-level security/);
    expect(await righe(U.ist, 'delete from public.registrazioni returning id')).toEqual([]);
  });

  it('personal data: li vede solo lo staff che condivide un corso', async () => {
    await righe(U.a, `insert into public.anagrafiche (user_id, grado, nome, cognome, data_nascita, citta_nascita) values ('${U.a}', 'Serg.', 'A', 'B', '1990-01-01', 'Roma')`);
    expect((await uno(U.dir, 'select count(*)::int n from public.anagrafiche')).n).toBe(1);
    expect((await uno(U.istAltro, 'select count(*)::int n from public.anagrafiche')).n).toBe(0);
    expect(await errore(U.a, `insert into public.anagrafiche (user_id, grado, nome, cognome, data_nascita, citta_nascita) values ('${U.b}', 'Serg.', 'A', 'B', '1990-01-01', 'Roma')`)).toMatch(/row-level security/);
  });

  it('validazioni: data futura, matricola solo per AC, ET, iscrizione', async () => {
    expect(await errore(U.a, reg(C1, U.a).replace('current_date', 'current_date + 1'))).toMatch(/futura/);
    expect(await errore(U.a, reg(C1, U.a).replace("'MM81781'", "''"))).toMatch(/check/);
    expect(await errore(U.a, reg(C1, U.a).replace(', 30,', ', 0,'))).toMatch(/check/);
  });
});

describe('programma teorico', () => {
  it('il direttore mette a calendario, l’istruttore legge e basta', async () => {
    expect(await righe(U.dir, lezione(C1, '2026-10-05', U.ist))).toHaveLength(1);
    expect(await errore(U.ist, lezione(C1, '2026-10-06', U.ist))).toMatch(/row-level security/);
    expect((await uno(U.ist, 'select count(*)::int n from public.lezioni')).n).toBe(1);
    expect((await uno(U.a, 'select count(*)::int n from public.lezioni')).n).toBe(1);
    expect((await uno(U.istAltro, 'select count(*)::int n from public.lezioni')).n).toBe(0);
    expect(await errore(U.dir, lezione(C2, '2026-10-05', null))).toMatch(/row-level security/);
    expect(await errore(U.dir, lezione(C1, '2026-10-05', U.ist))).toMatch(/unique|duplicate/);
  });

  it('abilitazioni: TM e direttore le impostano, gli altri le leggono', async () => {
    expect(await righe(U.dir, `insert into public.abilitazioni (user_id, programma, materia) values ('${U.ist}', 'mtt-ch47f-b13', 'm001') returning id`)).toHaveLength(1);
    expect(await errore(U.ist, `insert into public.abilitazioni (user_id, programma, materia) values ('${U.ist}', 'mtt-ch47f-b13', 'm002')`)).toMatch(/row-level security/);
    expect((await uno(U.ist, 'select count(*)::int n from public.abilitazioni')).n).toBe(1);
  });

  it('training data: li scrive chi guida il corso', async () => {
    expect(await errore(U.a, `insert into public.training_data (corso_id, user_id, location) values ('${C1}', '${U.a}', 'x')`)).toMatch(/row-level security/);
    await righe(U.dir, `insert into public.training_data (corso_id, user_id, location) values ('${C1}', '${U.a}', 'Viterbo')`);
    expect((await uno(U.a, 'select location from public.training_data')).location).toBe('Viterbo');
    expect((await uno(U.istAltro, 'select count(*)::int n from public.training_data')).n).toBe(0);
  });

  it('account disattivato: non vede più nulla', async () => {
    await righe(U.tm, `update public.profili set attivo = false where id = '${U.a}'`);
    expect((await uno(U.a, 'select count(*)::int n from public.corsi')).n).toBe(0);
    expect((await uno(U.a, 'select count(*)::int n from public.registrazioni')).n).toBe(0);
    await righe(U.tm, `update public.profili set attivo = true where id = '${U.a}'`);
  });
});
