// Crea il Training Manager e (facoltativo) carica la situazione esempio in un progetto Supabase.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_KEY=<chiave di servizio> \
//   node scripts/semina-supabase.mjs <username TM> "<Grado Nome Cognome>" [--esempio] --credenziali <file>
//
// Le password (provvisoria del TM e comune agli account esempio) sono generate a caso e scritte
// solo nel file indicato con --credenziali, mai a video. La chiave di servizio non va mai nel repository.
// Gli account esempio si eliminano con database/elimina_esempio.sql.
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const [username, nomeTm] = process.argv.slice(2);
const esempio = process.argv.includes('--esempio');
const fileCredenziali = process.argv[process.argv.indexOf('--credenziali') + 1];
const { SUPABASE_URL: url, SUPABASE_SERVICE_KEY: chiave } = process.env;
if (!url || !chiave || !username || !nomeTm || !process.argv.includes('--credenziali')) {
  console.error('Uso: SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node scripts/semina-supabase.mjs <username> "<nome>" [--esempio] --credenziali <file>');
  process.exit(1);
}
const DOMINIO = 'ptt.local';
const sb = createClient(url, chiave, { auth: { persistSession: false, autoRefreshToken: false } });
const password = () => `${randomBytes(9).toString('base64url')}7a`;
const verifica = (r, cosa) => {
  if (r.error) throw new Error(`${cosa}: ${r.error.message}`);
  return r.data;
};

async function creaUtente(u, pw, meta = {}) {
  const r = await sb.auth.admin.createUser({ email: `${u}@${DOMINIO}`, password: pw, email_confirm: true, user_metadata: { username: u, ...meta } });
  return verifica(r, `creazione di ${u}`).user.id;
}

const righe = [`Gestionale PTT – credenziali (${new Date().toLocaleString('it-IT')})`, `App: https://pier-200.github.io/GestionalePTT/`, ''];
const pwTm = password();
const tm = await creaUtente(username, pwTm);
verifica(await sb.from('profili').insert({ id: tm, username, ruolo: 'admin', nome: nomeTm, deve_cambiare_password: true }), 'profilo TM');
righe.push(`Training Manager: username ${username}  password provvisoria ${pwTm}  (da cambiare al primo accesso)`);

if (esempio) {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  const { datiEsempio } = await vite.ssrLoadModule('/src/dati/esempio.ts');
  await vite.close();
  const d = datiEsempio();
  const pwEsempio = password();
  const id = new Map([['u-tm', tm]]);
  for (const u of d.utenti.filter((x) => x.ruolo !== 'admin')) id.set(u.id, await creaUtente(u.username, pwEsempio, { esempio: true }));
  for (const i of d.istruttori) id.set(i.id, randomUUID());
  const m = (x) => (x == null ? null : (id.get(x) ?? x));
  verifica(await sb.from('istruttori').insert(d.istruttori.map((i) => ({ ...i, id: m(i.id), created_by: m(i.created_by) }))), 'istruttori');
  verifica(
    await sb.from('profili').insert(
      d.utenti.filter((u) => u.ruolo !== 'admin').map((u) => ({ id: m(u.id), username: u.username, ruolo: u.ruolo, nome: u.nome, attivo: u.attivo, istruttore_id: m(u.istruttore_id), deve_cambiare_password: false, created_at: u.created_at })),
    ),
    'profili',
  );
  verifica(await sb.from('anagrafiche').insert(d.anagrafiche.map((a) => ({ ...a, user_id: m(a.user_id), updated_by: m(a.updated_by) }))), 'anagrafiche');
  verifica(await sb.from('training_data').insert(d.training.map((t) => ({ ...t, user_id: m(t.user_id), updated_by: m(t.updated_by) }))), 'training data');
  const regs = d.registrazioni.map((r) => ({ ...r, id: randomUUID(), user_id: m(r.user_id), instructor_id: m(r.instructor_id), creato_da: m(r.creato_da), modificato_da: m(r.modificato_da) }));
  for (let i = 0; i < regs.length; i += 200) verifica(await sb.from('registrazioni').insert(regs.slice(i, i + 200)), 'registrazioni');
  righe.push('', `Account della situazione esempio (dati inventati), password comune: ${pwEsempio}`);
  for (const u of d.utenti.filter((x) => x.ruolo !== 'admin')) righe.push(`  ${u.username}  (${u.ruolo === 'instructor' ? 'istruttore' : 'frequentatore'})`);
  righe.push('', 'Prima dell’uso reale eliminarli con database/elimina_esempio.sql (SQL Editor di Supabase).');
  console.log(`Situazione esempio caricata: ${id.size - 1 - d.istruttori.length} account, ${d.istruttori.length} istruttori, ${regs.length} registrazioni.`);
}
writeFileSync(fileCredenziali, `${righe.join('\r\n')}\r\n`);
console.log(`Training Manager "${username}" creato. Credenziali scritte in ${fileCredenziali}`);
