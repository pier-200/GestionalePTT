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
const leggi = (f: string) => readFileSync(resolve(__dirname, '../database', f), 'utf8');

const U = { tm: '00000000-0000-4000-8000-000000000001', ist: '00000000-0000-4000-8000-000000000002', a: '00000000-0000-4000-8000-000000000003', b: '00000000-0000-4000-8000-000000000004', off: '00000000-0000-4000-8000-000000000005' };
const I1 = '10000000-0000-4000-8000-000000000001';
let db: PGlite;

async function come<T>(utente: string | null, fn: (tx: Transaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${utente ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [utente ?? '']);
    return fn(tx);
  });
}
const righe = (u: string | null, sql: string, p: unknown[] = []) => come(u, async (tx) => (await tx.query<Record<string, unknown>>(sql, p)).rows);
const errore = async (u: string | null, sql: string, p: unknown[] = []) => {
  try {
    await righe(u, sql, p);
  } catch (e) {
    return (e as Error).message;
  }
  return 'NESSUN ERRORE';
};
const reg = (user: string, extra = '') =>
  `insert into public.registrazioni (user_id, task_id, maintenance_location, data, tipo_esecuzione, matricola, et_minuti, instructor_id) values ('${user}', 1, 'Hangar', current_date, 'AC', 'MM81781', 30, '${I1}') ${extra} returning *`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB);
  for (let i = 0; i < 2; i++) {
    // due volte: gli script devono poter essere rieseguiti
    await db.exec(leggi('catalogo.sql'));
    await db.exec(leggi('schema.sql'));
  }
  for (const id of Object.values(U)) await db.query('insert into auth.users values ($1, $2)', [id, `${id}@ptt.local`]);
  expect((await righe(null, 'select public.ptt_stato() as s'))[0].s).toEqual({ admin: false });
  await righe(U.tm, `select public.ptt_primo_admin('tm.ferri', 'Magg. Ferri')`);
  expect(await errore(U.a, `select public.ptt_primo_admin('furbo', 'x')`)).toMatch(/già configurato/);
  await db.exec(`
    insert into public.istruttori (id, grado, nome, cognome) values ('${I1}', 'Mar.', 'Paolo', 'Rinaldi');
    insert into public.profili (id, username, ruolo, istruttore_id) values ('${U.ist}', 'paolo.rinaldi', 'instructor', '${I1}');
    insert into public.profili (id, username, ruolo) values ('${U.a}', 'utente.a', 'trainee'), ('${U.b}', 'utente.b', 'trainee');
    insert into public.profili (id, username, ruolo, attivo) values ('${U.off}', 'utente.off', 'trainee', false);`);
});

describe('schema Supabase', () => {
  it('catalogo completo', async () => {
    expect((await righe(U.a, 'select count(*)::int n from public.task'))[0].n).toBe(190);
    expect((await righe(null, 'select count(*)::int n from public.task').catch(() => [{ n: -1 }]))[0].n).not.toBe(190);
  });

  it('il frequentatore scrive solo il proprio logbook e lo vede solo lui', async () => {
    const [r] = await righe(U.a, reg(U.a));
    expect(r.creato_da).toBe(U.a);
    expect(await errore(U.a, reg(U.b))).toMatch(/row-level security/);
    await righe(U.b, reg(U.b));
    expect((await righe(U.a, 'select user_id from public.registrazioni')).map((x) => x.user_id)).toEqual([U.a]);
    expect(await righe(U.a, `update public.registrazioni set et_minuti = 99 where user_id = '${U.b}' returning id`)).toEqual([]);
    expect(await errore(U.a, `update public.registrazioni set user_id = '${U.b}' where user_id = '${U.a}'`)).toMatch(/row-level security|altro frequentatore/);
  });

  it('istruttore legge tutto ma non scrive; account disattivato non vede nulla', async () => {
    expect((await righe(U.ist, 'select count(*)::int n from public.registrazioni'))[0].n).toBe(2);
    expect(await errore(U.ist, reg(U.a))).toMatch(/row-level security/);
    expect(await righe(U.ist, `delete from public.registrazioni returning id`)).toEqual([]);
    expect((await righe(U.off, 'select count(*)::int n from public.istruttori'))[0].n).toBe(0);
  });

  it('validazioni: data futura, matricola solo per AC, ET', async () => {
    expect(await errore(U.a, reg(U.a).replace('current_date', "current_date + 1"))).toMatch(/futura/);
    expect(await errore(U.a, reg(U.a).replace("'MM81781'", "''"))).toMatch(/check/);
    expect(await errore(U.a, reg(U.a).replace(', 30,', ', 0,'))).toMatch(/check/);
  });

  it('training data solo dal TM; personal data dal frequentatore per sé', async () => {
    expect(await errore(U.a, `insert into public.training_data (user_id, location) values ('${U.a}', 'x')`)).toMatch(/row-level security/);
    await righe(U.tm, `insert into public.training_data (user_id, location) values ('${U.a}', 'Viterbo')`);
    expect((await righe(U.a, 'select location from public.training_data'))[0].location).toBe('Viterbo');
    await righe(U.a, `insert into public.anagrafiche (user_id, grado, nome, cognome, data_nascita, citta_nascita) values ('${U.a}', 'Serg.', 'A', 'B', '1990-01-01', 'Roma')`);
    expect(await errore(U.a, `insert into public.anagrafiche (user_id, grado, nome, cognome, data_nascita, citta_nascita) values ('${U.b}', 'Serg.', 'A', 'B', '1990-01-01', 'Roma')`)).toMatch(/row-level security/);
  });

  it('istruttori: il frequentatore aggiunge, solo il TM modifica; profili modificabili solo dal TM', async () => {
    await righe(U.a, `insert into public.istruttori (grado, nome, cognome) values ('Lgt.', 'Andrea', 'Colombo')`);
    expect(await errore(U.a, `insert into public.istruttori (grado, nome, cognome) values ('lgt.', 'andrea', 'colombo')`)).toMatch(/unique|duplicate/);
    expect(await righe(U.a, `update public.istruttori set nome = 'X' returning id`)).toEqual([]);
    expect(await righe(U.a, `update public.profili set ruolo = 'admin' returning id`)).toEqual([]);
    await righe(U.a, 'select public.ptt_password_cambiata()');
    expect((await righe(U.a, 'select deve_cambiare_password d, ruolo from public.profili'))[0]).toEqual({ d: false, ruolo: 'trainee' });
  });
});
