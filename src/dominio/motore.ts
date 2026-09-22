import { TASK_PER_ID } from './catalogo';
import { ErroreApp } from './errori';
import type { Anagrafica, Dati, DatiTraining, ID, Istruttore, Registrazione, Ruolo, TipoEsecuzione, Utente } from './tipi';

/**
 * Comandi di modifica dei dati, con permessi e validazioni. Il motore è eseguito
 * nel browser dagli archivi demo e GitHub; con Supabase le stesse regole sono
 * ripetute dal database (schema.sql) e il motore serve solo per i messaggi immediati.
 */

export type CampiRegistrazione = Pick<
  Registrazione,
  'id' | 'user_id' | 'task_id' | 'maintenance_location' | 'data' | 'tipo_esecuzione' | 'matricola' | 'et_minuti' | 'instructor_id'
>;
export type CampiAnagrafica = Omit<Anagrafica, 'updated_at' | 'updated_by'>;
export type CampiTraining = Omit<DatiTraining, 'user_id' | 'updated_at' | 'updated_by'>;
export type CampiIstruttore = Pick<Istruttore, 'id' | 'grado' | 'nome' | 'cognome'>;
export type CampiUtente = Pick<Utente, 'id' | 'username' | 'ruolo' | 'nome' | 'istruttore_id'>;

export type Comando =
  | { tipo: 'anagrafica.salva'; anagrafica: CampiAnagrafica }
  | { tipo: 'training.salva'; user_ids: ID[]; training: CampiTraining }
  | { tipo: 'istruttore.crea'; istruttore: CampiIstruttore }
  | { tipo: 'istruttore.modifica'; istruttore: CampiIstruttore }
  | { tipo: 'registrazione.salva'; registrazione: CampiRegistrazione }
  | { tipo: 'registrazione.elimina'; id: ID }
  | { tipo: 'utente.crea'; utente: CampiUtente; password: string }
  | { tipo: 'utente.modifica'; utente: Pick<Utente, 'id' | 'nome' | 'attivo' | 'istruttore_id'>; password?: string }
  | { tipo: 'utente.passwordCambiata' };

/** Operazioni sulle credenziali che l'archivio deve eseguire dopo il salvataggio dei dati. */
export type Effetto =
  | { tipo: 'credenziali.imposta'; username: string; password: string; admin: boolean }
  | { tipo: 'credenziali.rimuovi'; username: string };

export interface Contesto {
  utenteId: ID;
  ora: string;
  oggi: string;
}

export interface Esito {
  dati: Dati;
  effetti: Effetto[];
}

export const RE_USERNAME = /^[a-z0-9][a-z0-9._-]{2,39}$/;
export const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
export const TIPI_ESECUZIONE: TipoEsecuzione[] = ['AC', 'SIM', 'CLA'];

export const oggiISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function errorePassword(p: string): string | null {
  if (p.length < 10) return 'La password deve contenere almeno 10 caratteri';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'La password deve contenere almeno una lettera e una cifra';
  if (p.length > 128) return 'La password è troppo lunga';
  return null;
}

const dataValida = (s: string) => RE_DATA.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

class Controlli {
  readonly errori: Record<string, string> = {};

  testo(campo: string, etichetta: string, valore: string | null | undefined, max: number, obbligatorio = true): string {
    const t = (valore ?? '').trim();
    if (!t && obbligatorio) this.errori[campo] = `${etichetta}: campo obbligatorio`;
    else if (t.length > max) this.errori[campo] = `${etichetta}: massimo ${max} caratteri`;
    return t;
  }

  data(campo: string, etichetta: string, valore: string | null | undefined, obbligatoria: boolean, massima?: string): string | null {
    const v = (valore ?? '').trim();
    if (!v) {
      if (obbligatoria) this.errori[campo] = `${etichetta}: campo obbligatorio`;
      return null;
    }
    if (!dataValida(v)) this.errori[campo] = `${etichetta}: data non valida`;
    else if (massima && v > massima) this.errori[campo] = `${etichetta}: la data non può essere futura`;
    return v;
  }

  verifica() {
    const valori = Object.values(this.errori);
    if (valori.length) throw new ErroreApp('VALIDAZIONE', valori.length === 1 ? valori[0] : `Dati non validi: ${valori.join('; ')}`, this.errori);
  }
}

/** Normalizza e valida i campi di una registrazione (usato anche dal form). */
export function validaRegistrazione(r: CampiRegistrazione, oggi: string, istruttori: readonly Istruttore[]): CampiRegistrazione {
  const c = new Controlli();
  if (!TASK_PER_ID.has(r.task_id)) c.errori.task_id = 'Task non presente nel catalogo';
  const maintenance_location = c.testo('maintenance_location', 'Maintenance location', r.maintenance_location, 100);
  const data = c.data('data', 'Data', r.data, true, oggi) ?? '';
  if (!TIPI_ESECUZIONE.includes(r.tipo_esecuzione)) c.errori.tipo_esecuzione = 'Indicare aeromobile, SIM o CLA';
  const matricola = r.tipo_esecuzione === 'AC' ? c.testo('matricola', 'Matricola aeromobile', r.matricola, 60) : '';
  const et = Number(r.et_minuti);
  if (!Number.isInteger(et) || et <= 0) c.errori.et_minuti = 'ET: indicare i minuti (numero intero maggiore di zero)';
  else if (et > 1440) c.errori.et_minuti = 'ET: massimo 1440 minuti';
  if (!r.instructor_id) c.errori.instructor_id = 'Instructor: campo obbligatorio';
  else if (!istruttori.some((i) => i.id === r.instructor_id)) c.errori.instructor_id = 'Instructor non presente in elenco';
  c.verifica();
  return { ...r, maintenance_location, data, matricola, et_minuti: et };
}

function permesso(ok: boolean, messaggio = 'Non hai i permessi per questa operazione.') {
  if (!ok) throw new ErroreApp('PERMESSO_NEGATO', messaggio);
}

const sostituisci = <T,>(lista: T[], trova: (x: T) => boolean, nuovo: T) => {
  const i = lista.findIndex(trova);
  return i < 0 ? [...lista, nuovo] : lista.map((x, j) => (j === i ? nuovo : x));
};

const chiaveIstruttore = (i: Pick<Istruttore, 'grado' | 'nome' | 'cognome'>) =>
  [i.grado, i.nome, i.cognome].map((s) => s.trim().toLowerCase().replace(/\s+/g, ' ')).join('|');

export function applica(dati: Dati, comando: Comando, ctx: Contesto): Esito {
  const io = dati.utenti.find((u) => u.id === ctx.utenteId);
  if (!io || !io.attivo) throw new ErroreApp('AUTENTICAZIONE', 'Utente non abilitato: accedere di nuovo.');
  const ruolo: Ruolo = io.ruolo;
  const admin = ruolo === 'admin';
  const traccia = { updated_at: ctx.ora, updated_by: io.id };

  switch (comando.tipo) {
    case 'anagrafica.salva': {
      const a = comando.anagrafica;
      permesso(admin || (ruolo === 'trainee' && a.user_id === io.id));
      if (!dati.utenti.some((u) => u.id === a.user_id && u.ruolo === 'trainee')) throw new ErroreApp('NON_TROVATO', 'Frequentatore non trovato.');
      const c = new Controlli();
      const nuova: Anagrafica = {
        user_id: a.user_id,
        grado: c.testo('grado', 'Grado', a.grado, 60),
        nome: c.testo('nome', 'Nome', a.nome, 80),
        cognome: c.testo('cognome', 'Cognome', a.cognome, 80),
        data_nascita: c.data('data_nascita', 'Data di nascita', a.data_nascita, true, ctx.oggi),
        citta_nascita: c.testo('citta_nascita', 'Città di nascita', a.citta_nascita, 80),
        maml: c.testo('maml', 'MAML', a.maml, 40, false),
        ...traccia,
      };
      c.verifica();
      return { dati: { ...dati, anagrafiche: sostituisci(dati.anagrafiche, (x) => x.user_id === a.user_id, nuova) }, effetti: [] };
    }

    case 'training.salva': {
      permesso(admin, 'Solo il Training Manager inserisce i Practical Type Training Data.');
      const t = comando.training;
      const c = new Controlli();
      const data_inizio = c.data('data_inizio', 'Data di inizio', t.data_inizio, false);
      const data_fine = c.data('data_fine', 'Data di fine', t.data_fine, false);
      if (data_inizio && data_fine && data_fine < data_inizio) c.errori.data_fine = 'La data di fine precede la data di inizio';
      const campi = {
        data_inizio,
        data_fine,
        maintenance_organization: c.testo('maintenance_organization', 'Maintenance Organisation', t.maintenance_organization, 200, false),
        location: c.testo('location', 'Location', t.location, 100, false),
      };
      if (!comando.user_ids.length) c.errori.user_ids = 'Selezionare almeno un frequentatore';
      c.verifica();
      let training = dati.training;
      for (const user_id of comando.user_ids) {
        if (!dati.utenti.some((u) => u.id === user_id && u.ruolo === 'trainee')) throw new ErroreApp('NON_TROVATO', 'Frequentatore non trovato.');
        training = sostituisci(training, (x) => x.user_id === user_id, { user_id, ...campi, ...traccia });
      }
      return { dati: { ...dati, training }, effetti: [] };
    }

    case 'istruttore.crea':
    case 'istruttore.modifica': {
      const i = comando.istruttore;
      const esistente = dati.istruttori.find((x) => x.id === i.id);
      if (comando.tipo === 'istruttore.crea') {
        permesso(admin || ruolo === 'trainee');
        if (esistente) throw new ErroreApp('DUPLICATO', 'Istruttore già presente.');
      } else {
        permesso(admin, 'Solo il Training Manager modifica l’elenco istruttori.');
        if (!esistente) throw new ErroreApp('NON_TROVATO', 'Istruttore non trovato.');
      }
      const c = new Controlli();
      const campi = {
        grado: c.testo('grado', 'Grado', i.grado, 60),
        nome: c.testo('nome', 'Nome', i.nome, 80),
        cognome: c.testo('cognome', 'Cognome', i.cognome, 80),
      };
      c.verifica();
      const doppio = dati.istruttori.find((x) => x.id !== i.id && chiaveIstruttore(x) === chiaveIstruttore(campi));
      if (doppio) throw new ErroreApp('DUPLICATO', `${campi.grado} ${campi.nome} ${campi.cognome} è già nell'elenco istruttori.`);
      const nuovo: Istruttore = esistente ? { ...esistente, ...campi } : { id: i.id, ...campi, created_at: ctx.ora, created_by: io.id };
      return { dati: { ...dati, istruttori: sostituisci(dati.istruttori, (x) => x.id === i.id, nuovo) }, effetti: [] };
    }

    case 'registrazione.salva': {
      const r = validaRegistrazione(comando.registrazione, ctx.oggi, dati.istruttori);
      const esistente = dati.registrazioni.find((x) => x.id === r.id);
      permesso(admin || (ruolo === 'trainee' && r.user_id === io.id && (!esistente || esistente.user_id === io.id)));
      if (!dati.utenti.some((u) => u.id === r.user_id && u.ruolo === 'trainee')) throw new ErroreApp('NON_TROVATO', 'Frequentatore non trovato.');
      const nuova: Registrazione = {
        ...r,
        creato_il: esistente?.creato_il ?? ctx.ora,
        creato_da: esistente?.creato_da ?? io.id,
        modificato_il: ctx.ora,
        modificato_da: io.id,
      };
      return { dati: { ...dati, registrazioni: sostituisci(dati.registrazioni, (x) => x.id === r.id, nuova) }, effetti: [] };
    }

    case 'registrazione.elimina': {
      const esistente = dati.registrazioni.find((x) => x.id === comando.id);
      if (!esistente) throw new ErroreApp('NON_TROVATO', 'Registrazione già eliminata.');
      permesso(admin || (ruolo === 'trainee' && esistente.user_id === io.id));
      return { dati: { ...dati, registrazioni: dati.registrazioni.filter((x) => x.id !== comando.id) }, effetti: [] };
    }

    case 'utente.crea': {
      permesso(admin, 'Solo il Training Manager crea gli account.');
      const u = comando.utente;
      const c = new Controlli();
      const username = u.username.trim().toLowerCase();
      if (!RE_USERNAME.test(username)) c.errori.username = 'Username: 3-40 caratteri tra lettere minuscole, cifre, punto e trattini';
      else if (dati.utenti.some((x) => x.username === username)) c.errori.username = `Lo username "${username}" è già in uso`;
      const nome = c.testo('nome', 'Nome', u.nome, 100, u.ruolo !== 'trainee');
      const problema = errorePassword(comando.password);
      if (problema) c.errori.password = problema;
      if (!['admin', 'instructor', 'trainee'].includes(u.ruolo)) c.errori.ruolo = 'Ruolo non valido';
      if (u.istruttore_id && !dati.istruttori.some((i) => i.id === u.istruttore_id)) c.errori.istruttore_id = 'Istruttore non trovato';
      c.verifica();
      const nuovo: Utente = {
        id: u.id,
        username,
        ruolo: u.ruolo,
        nome,
        istruttore_id: u.ruolo === 'instructor' ? u.istruttore_id : null,
        attivo: true,
        deve_cambiare_password: true,
        created_at: ctx.ora,
        updated_at: ctx.ora,
      };
      return {
        dati: { ...dati, utenti: [...dati.utenti, nuovo] },
        effetti: [{ tipo: 'credenziali.imposta', username, password: comando.password, admin: u.ruolo === 'admin' }],
      };
    }

    case 'utente.modifica': {
      permesso(admin, 'Solo il Training Manager modifica gli account.');
      const u = comando.utente;
      const esistente = dati.utenti.find((x) => x.id === u.id);
      if (!esistente) throw new ErroreApp('NON_TROVATO', 'Account non trovato.');
      if (esistente.id === io.id && !u.attivo) throw new ErroreApp('VINCOLO', 'Non puoi disattivare il tuo stesso account.');
      const c = new Controlli();
      const nome = c.testo('nome', 'Nome', u.nome, 100, esistente.ruolo !== 'trainee');
      if (comando.password != null) {
        const problema = errorePassword(comando.password);
        if (problema) c.errori.password = problema;
      } else if (u.attivo && !esistente.attivo) {
        c.errori.password = 'Per riattivare l’account indicare una nuova password provvisoria';
      }
      if (u.istruttore_id && !dati.istruttori.some((i) => i.id === u.istruttore_id)) c.errori.istruttore_id = 'Istruttore non trovato';
      c.verifica();
      const nuovo: Utente = {
        ...esistente,
        nome,
        attivo: u.attivo,
        istruttore_id: esistente.ruolo === 'instructor' ? u.istruttore_id : null,
        deve_cambiare_password: comando.password != null ? true : esistente.deve_cambiare_password,
        updated_at: ctx.ora,
      };
      const effetti: Effetto[] = !u.attivo
        ? [{ tipo: 'credenziali.rimuovi', username: esistente.username }]
        : comando.password != null
          ? [{ tipo: 'credenziali.imposta', username: esistente.username, password: comando.password, admin: esistente.ruolo === 'admin' }]
          : [];
      return { dati: { ...dati, utenti: dati.utenti.map((x) => (x.id === u.id ? nuovo : x)) }, effetti };
    }

    case 'utente.passwordCambiata':
      return {
        dati: { ...dati, utenti: dati.utenti.map((x) => (x.id === io.id ? { ...x, deve_cambiare_password: false, updated_at: ctx.ora } : x)) },
        effetti: [],
      };
  }
}
