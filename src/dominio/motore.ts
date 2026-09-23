import { ErroreApp } from './errori';
import { mdsDi, indice, programmaPratico, programmaTeorico, programmiPer } from './programmi';
import { indiceGiorno, periodiDelGiorno } from './pianificazione';
import { conMateria, type Anagrafica, type Corso, type Dati, type DatiTraining, type ID, type Iscrizione, type Istruttore, type Lezione, type Presenza, type Rapportino, type Registrazione, type Ruolo, type RuoloCorso, type StatoPresenza, type TipoEsecuzione, type TipoPeriodo, type Utente } from './tipi';

/**
 * Comandi di modifica dei dati, con permessi e validazioni. Il motore è eseguito
 * nel browser dagli archivi demo e GitHub; con Supabase le stesse regole sono
 * ripetute dal database (database/schema.sql) e il motore serve per i messaggi immediati.
 */

export type CampiRegistrazione = Pick<
  Registrazione,
  'id' | 'corso_id' | 'user_id' | 'task_id' | 'maintenance_location' | 'data' | 'tipo_esecuzione' | 'matricola' | 'et_minuti' | 'instructor_id'
>;
export type CampiAnagrafica = Omit<Anagrafica, 'updated_at' | 'updated_by'>;
export type CampiTraining = Omit<DatiTraining, 'corso_id' | 'user_id' | 'updated_at' | 'updated_by'>;
export type CampiIstruttore = Pick<Istruttore, 'id' | 'grado' | 'nome' | 'cognome'>;
export type CampiUtente = Pick<Utente, 'id' | 'username' | 'ruolo' | 'nome' | 'istruttore_id'>;
/** I programmi non si scelgono a mano: seguono mezzo e categoria. */
export type CampiCorso = Pick<
  Corso,
  'id' | 'codice' | 'nome' | 'mds' | 'categoria' | 'data_inizio' | 'data_fine' | 'maintenance_organization' | 'location' | 'ora_inizio' | 'minuti_giorno' | 'attivo'
>;
export type CampiLezione = Pick<Lezione, 'id' | 'corso_id' | 'data' | 'ordine' | 'minuti' | 'materia' | 'istruttore_id' | 'tipo' | 'note'>;
export type CampiPresenza = Pick<Presenza, 'id' | 'user_id' | 'stato' | 'dalle' | 'alle' | 'motivo'>;

export type Comando =
  | { tipo: 'corso.salva'; corso: CampiCorso }
  | { tipo: 'corso.iscrivi'; iscrizione: Pick<Iscrizione, 'id' | 'corso_id' | 'user_id' | 'ruolo'> }
  | { tipo: 'corso.disiscrivi'; id: ID }
  | { tipo: 'anagrafica.salva'; anagrafica: CampiAnagrafica }
  | { tipo: 'training.salva'; corso_id: ID; user_ids: ID[]; training: CampiTraining }
  | { tipo: 'istruttore.crea'; istruttore: CampiIstruttore }
  | { tipo: 'istruttore.modifica'; istruttore: CampiIstruttore }
  | { tipo: 'registrazione.salva'; registrazione: CampiRegistrazione }
  | { tipo: 'registrazione.elimina'; id: ID }
  | { tipo: 'lezioni.sostituisci'; corso_id: ID; giorni: string[]; lezioni: CampiLezione[] }
  | { tipo: 'lezione.modifica'; lezione: Pick<CampiLezione, 'id' | 'istruttore_id' | 'note'> }
  | { tipo: 'settimana.valida'; corso_id: ID; giorni: string[]; valida: boolean }
  | { tipo: 'rapportino.salva'; corso_id: ID; data: string; note: string; presenze: CampiPresenza[] }
  | { tipo: 'rapportino.valida'; corso_id: ID; data: string; valida: boolean }
  | { tipo: 'abilitazioni.imposta'; user_id: ID; programma: string; materie: string[] }
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
export const TIPI_PERIODO: TipoPeriodo[] = ['lezione', 'recupero', 'meo', 'sospensione', 'esame'];

export const oggiISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Lunghezza minima volutamente bassa (richiesta dell'utente: credenziali di avvio semplici).
 * Con l'archivio GitHub la password protegge il token nel portachiavi: per i dati veri usarne una lunga.
 */
export const PASSWORD_MINIMA = 4;

export function errorePassword(p: string): string | null {
  if (p.length < PASSWORD_MINIMA) return `La password deve contenere almeno ${PASSWORD_MINIMA} caratteri`;
  if (p.length > 128) return 'La password è troppo lunga';
  return null;
}

const dataValida = (s: string) => RE_DATA.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

/** Ruolo dell'utente nel corso indicato ('admin' se Training Manager). */
export function ruoloNelCorso(dati: Dati, utente: Utente, corsoId: ID | null | undefined): Ruolo | null {
  if (utente.ruolo === 'admin') return 'admin';
  const i = dati.iscrizioni.find((x) => x.corso_id === corsoId && x.user_id === utente.id);
  return i ? i.ruolo : null;
}

/** Corsi visibili all'utente. */
export function corsiDi(dati: Dati, utente: Utente): Corso[] {
  const miei = new Set(dati.iscrizioni.filter((i) => i.user_id === utente.id).map((i) => i.corso_id));
  return dati.corsi.filter((c) => utente.ruolo === 'admin' || miei.has(c.id)).sort((a, b) => Number(b.attivo) - Number(a.attivo) || b.codice.localeCompare(a.codice));
}

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
export function validaRegistrazione(r: CampiRegistrazione, oggi: string, istruttori: readonly Istruttore[], programma: string | null | undefined): CampiRegistrazione {
  const c = new Controlli();
  const p = programmaPratico(programma);
  if (!p) c.errori.corso_id = 'Il corso non prevede la parte pratica';
  else if (!indice(p).taskPerId.has(r.task_id)) c.errori.task_id = 'Task non presente nel programma del corso';
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
  const admin = io.ruolo === 'admin';
  const traccia = { updated_at: ctx.ora, updated_by: io.id };
  const corso = (id: ID) => {
    const c = dati.corsi.find((x) => x.id === id);
    if (!c) throw new ErroreApp('NON_TROVATO', 'Corso non trovato.');
    return c;
  };
  /** Chi guida il corso: Training Manager o direttore iscritto. */
  const guida = (corsoId: ID) => admin || ruoloNelCorso(dati, io, corsoId) === 'direttore';
  const iscrittoCome = (corsoId: ID, userId: ID, ruolo: RuoloCorso) => dati.iscrizioni.some((i) => i.corso_id === corsoId && i.user_id === userId && i.ruolo === ruolo);

  switch (comando.tipo) {
    case 'corso.salva': {
      const c = comando.corso;
      const esistente = dati.corsi.find((x) => x.id === c.id);
      permesso(esistente ? guida(c.id) : admin, esistente ? 'Solo il Training Manager o il direttore modificano il corso.' : 'Solo il Training Manager crea i corsi.');
      const v = new Controlli();
      const codice = v.testo('codice', 'Codice', c.codice, 30);
      if (codice && dati.corsi.some((x) => x.id !== c.id && x.codice.toLowerCase() === codice.toLowerCase())) v.errori.codice = `Il codice "${codice}" è già usato da un altro corso`;
      const nome = v.testo('nome', 'Nome', c.nome, 120);
      const data_inizio = v.data('data_inizio', 'Data di inizio', c.data_inizio, false);
      const data_fine = v.data('data_fine', 'Data di fine', c.data_fine, false);
      if (data_inizio && data_fine && data_fine < data_inizio) v.errori.data_fine = 'La data di fine precede la data di inizio';
      const mezzo = mdsDi(c.mds);
      if (!mezzo) v.errori.mds = 'Indicare il mezzo (MDS)';
      else if (!mezzo.categorie.includes(c.categoria)) v.errori.categoria = `Il ${mezzo.codice} non prevede la categoria "${c.categoria}"`;
      // i programmi seguono mezzo e categoria (le categorie C hanno solo la parte teorica)
      const attesi = programmiPer(c.mds, c.categoria);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.ora_inizio)) v.errori.ora_inizio = 'Ora di inizio non valida (es. 08:30)';
      const minuti_giorno = (c.minuti_giorno ?? []).slice(0, 5).map((x) => Math.max(0, Math.min(600, Math.round(Number(x) / 60) * 60)));
      if (minuti_giorno.length !== 5) v.errori.minuti_giorno = 'Indicare i minuti di lezione per i cinque giorni';
      v.verifica();
      const nuovo: Corso = {
        ...(esistente ?? { id: c.id, created_at: ctx.ora }),
        id: c.id,
        codice,
        nome,
        mds: c.mds,
        categoria: c.categoria,
        programma_teorico: attesi.teorico?.id ?? null,
        programma_pratico: attesi.pratico?.id ?? null,
        data_inizio,
        data_fine,
        maintenance_organization: v.testo('maintenance_organization', 'Maintenance Organisation', c.maintenance_organization, 200, false),
        location: v.testo('location', 'Location', c.location, 100, false),
        ora_inizio: c.ora_inizio,
        minuti_giorno,
        attivo: c.attivo,
        created_at: esistente?.created_at ?? ctx.ora,
        updated_at: ctx.ora,
      };
      return { dati: { ...dati, corsi: sostituisci(dati.corsi, (x) => x.id === c.id, nuovo) }, effetti: [] };
    }

    case 'corso.iscrivi': {
      const i = comando.iscrizione;
      permesso(guida(i.corso_id), 'Solo il Training Manager o il direttore iscrivono al corso.');
      corso(i.corso_id);
      const utente = dati.utenti.find((u) => u.id === i.user_id);
      if (!utente) throw new ErroreApp('NON_TROVATO', 'Account non trovato.');
      if (utente.ruolo === 'admin') throw new ErroreApp('VINCOLO', 'Il Training Manager vede già tutti i corsi.');
      if (utente.ruolo === 'trainee' && i.ruolo !== 'trainee') throw new ErroreApp('VINCOLO', 'Un frequentatore può essere iscritto solo come frequentatore.');
      if (utente.ruolo === 'instructor' && i.ruolo === 'direttore') throw new ErroreApp('VINCOLO', 'Solo un account «Direttore del corso» può dirigere un corso.');
      if (dati.iscrizioni.some((x) => x.corso_id === i.corso_id && x.user_id === i.user_id)) throw new ErroreApp('DUPLICATO', 'Account già iscritto a questo corso.');
      return { dati: { ...dati, iscrizioni: [...dati.iscrizioni, { ...i, created_at: ctx.ora }] }, effetti: [] };
    }

    case 'corso.disiscrivi': {
      const i = dati.iscrizioni.find((x) => x.id === comando.id);
      if (!i) throw new ErroreApp('NON_TROVATO', 'Iscrizione non trovata.');
      permesso(guida(i.corso_id), 'Solo il Training Manager o il direttore gestiscono le iscrizioni.');
      if (dati.registrazioni.some((r) => r.corso_id === i.corso_id && r.user_id === i.user_id)) {
        throw new ErroreApp('VINCOLO', 'Il frequentatore ha già registrazioni in questo corso: i dati resterebbero senza iscrizione.');
      }
      return { dati: { ...dati, iscrizioni: dati.iscrizioni.filter((x) => x.id !== comando.id), lezioni: dati.lezioni.map((l) => (l.corso_id === i.corso_id && l.istruttore_id === i.user_id ? { ...l, istruttore_id: null } : l)) }, effetti: [] };
    }

    case 'anagrafica.salva': {
      const a = comando.anagrafica;
      permesso(admin || (io.ruolo === 'trainee' && a.user_id === io.id));
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
      permesso(guida(comando.corso_id), 'Solo il Training Manager o il direttore inseriscono i Practical Type Training Data.');
      corso(comando.corso_id);
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
        if (!iscrittoCome(comando.corso_id, user_id, 'trainee')) throw new ErroreApp('NON_TROVATO', 'Frequentatore non iscritto a questo corso.');
        training = sostituisci(training, (x) => x.user_id === user_id && x.corso_id === comando.corso_id, { corso_id: comando.corso_id, user_id, ...campi, ...traccia });
      }
      return { dati: { ...dati, training }, effetti: [] };
    }

    case 'istruttore.crea':
    case 'istruttore.modifica': {
      const i = comando.istruttore;
      const esistente = dati.istruttori.find((x) => x.id === i.id);
      if (comando.tipo === 'istruttore.crea') {
        permesso(admin || io.ruolo === 'direttore' || io.ruolo === 'trainee');
        if (esistente) throw new ErroreApp('DUPLICATO', 'Istruttore già presente.');
      } else {
        permesso(admin || io.ruolo === 'direttore', 'Solo il Training Manager o un direttore modificano l’elenco istruttori.');
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
      const c = corso(comando.registrazione.corso_id);
      const r = validaRegistrazione(comando.registrazione, ctx.oggi, dati.istruttori, c.programma_pratico);
      const esistente = dati.registrazioni.find((x) => x.id === r.id);
      permesso(admin || (io.ruolo === 'trainee' && r.user_id === io.id && (!esistente || esistente.user_id === io.id)));
      if (!iscrittoCome(r.corso_id, r.user_id, 'trainee')) throw new ErroreApp('NON_TROVATO', 'Frequentatore non iscritto a questo corso.');
      if (esistente && esistente.corso_id !== r.corso_id) throw new ErroreApp('VINCOLO', 'La registrazione non si può spostare su un altro corso.');
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
      permesso(admin || (io.ruolo === 'trainee' && esistente.user_id === io.id));
      return { dati: { ...dati, registrazioni: dati.registrazioni.filter((x) => x.id !== comando.id) }, effetti: [] };
    }

    case 'lezioni.sostituisci': {
      permesso(guida(comando.corso_id), 'Solo il Training Manager o il direttore preparano il programma settimanale.');
      const c = corso(comando.corso_id);
      const p = programmaTeorico(c.programma_teorico);
      if (!p) throw new ErroreApp('VINCOLO', 'Il corso non prevede la parte teorica.');
      const v = new Controlli();
      const giorni = new Set(comando.giorni.filter((g) => dataValida(g)));
      if (giorni.size !== comando.giorni.length) v.errori.giorni = 'Giorni non validi';
      for (const l of comando.lezioni) {
        if (!giorni.has(l.data)) v.errori.lezioni = 'Una lezione cade fuori dai giorni indicati';
        if (!TIPI_PERIODO.includes(l.tipo)) v.errori.tipo = 'Tipo di periodo non valido';
        else if (conMateria(l.tipo) && !p.materie.some((m) => m.id === l.materia)) v.errori.materia = 'Materia non presente nel programma del corso';
        if (l.ordine < 0 || l.ordine >= periodiDelGiorno(c.minuti_giorno, indiceGiorno(l.data))) v.errori.ordine = 'Periodo fuori dalla giornata';
        // i periodi si compongono a quarti d'ora: 15, 30, 45 minuti e multipli
        if (!Number.isInteger(l.minuti) || l.minuti < 15 || l.minuti > 600 || l.minuti % 15 !== 0) v.errori.minuti = 'Durata della lezione non valida: quarti d’ora da 15 a 600 minuti';
        if (l.istruttore_id && !iscrittoCome(comando.corso_id, l.istruttore_id, 'instructor') && !iscrittoCome(comando.corso_id, l.istruttore_id, 'direttore')) {
          v.errori.istruttore = 'Istruttore non iscritto al corso';
        }
      }
      v.verifica();
      const restanti = dati.lezioni.filter((l) => l.corso_id !== comando.corso_id || !giorni.has(l.data));
      // dopo ogni modifica la settimana torna da validare: i frequentatori vedono solo i programmi validati
      const nuove: Lezione[] = comando.lezioni.map((l) => ({
        ...l,
        materia: conMateria(l.tipo) ? l.materia : '',
        validata: false,
        validata_da: null,
        validata_il: null,
        note: (l.note ?? '').slice(0, 300),
        creato_il: dati.lezioni.find((x) => x.id === l.id)?.creato_il ?? ctx.ora,
        modificato_il: ctx.ora,
        modificato_da: io.id,
      }));
      return { dati: { ...dati, lezioni: [...restanti, ...nuove] }, effetti: [] };
    }

    case 'settimana.valida': {
      permesso(guida(comando.corso_id), 'Solo il Training Manager o il direttore validano il programma.');
      corso(comando.corso_id);
      const giorni = new Set(comando.giorni);
      const coinvolte = dati.lezioni.filter((l) => l.corso_id === comando.corso_id && giorni.has(l.data));
      if (!coinvolte.length) throw new ErroreApp('VINCOLO', 'Nessuna lezione da validare in questi giorni.');
      const validate = comando.valida ? { validata: true, validata_da: io.id, validata_il: ctx.ora } : { validata: false, validata_da: null, validata_il: null };
      return { dati: { ...dati, lezioni: dati.lezioni.map((l) => (coinvolte.includes(l) ? { ...l, ...validate } : l)) }, effetti: [] };
    }

    case 'rapportino.salva': {
      const c = corso(comando.corso_id);
      const mio = ruoloNelCorso(dati, io, comando.corso_id);
      // il rapportino lo compila chiunque frequenti il corso, per tutti i frequentatori
      permesso(admin || mio === 'direttore' || mio === 'trainee' || mio === 'instructor', 'Solo chi partecipa al corso compila il rapportino.');
      if (!c.programma_teorico) throw new ErroreApp('VINCOLO', 'Il corso non prevede la parte teorica.');
      const esistente = dati.rapportini.find((r) => r.corso_id === comando.corso_id && r.data === comando.data);
      if (esistente?.validato_il && !guida(comando.corso_id)) {
        throw new ErroreApp('VINCOLO', 'Rapportino già validato: chiederne la riapertura al direttore del corso.');
      }
      const v = new Controlli();
      const data = v.data('data', 'Data', comando.data, true, ctx.oggi) ?? '';
      const note = v.testo('note', 'Note', comando.note, 300, false);
      const orario = (campo: string, valore: string | null | undefined) => {
        const t = (valore ?? '').trim();
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) v.errori[campo] = 'Orario non valido (es. 08:30)';
        return t;
      };
      const presenze: Presenza[] = comando.presenze.map((p) => {
        if (!iscrittoCome(comando.corso_id, p.user_id, 'trainee')) throw new ErroreApp('NON_TROVATO', 'Frequentatore non iscritto a questo corso.');
        const stato: StatoPresenza = p.stato === 'assente' || p.stato === 'parziale' ? p.stato : 'presente';
        const parziale = stato === 'parziale';
        const dalle = parziale ? orario(`dalle_${p.user_id}`, p.dalle) : null;
        const alle = parziale ? orario(`alle_${p.user_id}`, p.alle) : null;
        if (parziale && dalle && alle && alle <= dalle) v.errori[`alle_${p.user_id}`] = 'L’orario di uscita precede quello di ingresso';
        return {
          id: p.id,
          corso_id: comando.corso_id,
          data: comando.data,
          user_id: p.user_id,
          stato,
          dalle,
          alle,
          motivo: stato === 'presente' ? '' : v.testo(`motivo_${p.user_id}`, 'Motivo', p.motivo, 200, false),
        };
      });
      if (new Set(presenze.map((p) => p.user_id)).size !== presenze.length) v.errori.presenze = 'Frequentatore indicato due volte';
      v.verifica();
      const rapportino: Rapportino = {
        ...(esistente ?? { id: `${comando.corso_id}|${data}`, corso_id: comando.corso_id, data, validato_da: null, validato_il: null }),
        note,
        compilato_da: io.id,
        compilato_il: ctx.ora,
      };
      const altre = dati.presenze.filter((p) => p.corso_id !== comando.corso_id || p.data !== data);
      return {
        dati: { ...dati, rapportini: sostituisci(dati.rapportini, (r) => r.id === rapportino.id, rapportino), presenze: [...altre, ...presenze] },
        effetti: [],
      };
    }

    case 'rapportino.valida': {
      permesso(guida(comando.corso_id), 'Solo il Training Manager o il direttore validano il rapportino.');
      const esistente = dati.rapportini.find((r) => r.corso_id === comando.corso_id && r.data === comando.data);
      if (!esistente) throw new ErroreApp('NON_TROVATO', 'Rapportino non ancora compilato.');
      const nuovo: Rapportino = comando.valida
        ? { ...esistente, validato_da: io.id, validato_il: ctx.ora }
        : { ...esistente, validato_da: null, validato_il: null };
      return { dati: { ...dati, rapportini: sostituisci(dati.rapportini, (r) => r.id === nuovo.id, nuovo) }, effetti: [] };
    }

    case 'lezione.modifica': {
      const esistente = dati.lezioni.find((x) => x.id === comando.lezione.id);
      if (!esistente) throw new ErroreApp('NON_TROVATO', 'Lezione non trovata.');
      permesso(guida(esistente.corso_id), 'Solo il Training Manager o il direttore modificano le lezioni.');
      const istruttore_id = comando.lezione.istruttore_id;
      if (istruttore_id && !iscrittoCome(esistente.corso_id, istruttore_id, 'instructor') && !iscrittoCome(esistente.corso_id, istruttore_id, 'direttore')) {
        throw new ErroreApp('VALIDAZIONE', 'Istruttore non iscritto al corso.');
      }
      const nuova: Lezione = { ...esistente, istruttore_id, note: (comando.lezione.note ?? '').slice(0, 300), modificato_il: ctx.ora, modificato_da: io.id };
      return { dati: { ...dati, lezioni: sostituisci(dati.lezioni, (x) => x.id === nuova.id, nuova) }, effetti: [] };
    }

    case 'abilitazioni.imposta': {
      permesso(admin || io.ruolo === 'direttore', 'Solo il Training Manager o un direttore assegnano le materie agli istruttori.');
      const p = programmaTeorico(comando.programma);
      if (!p) throw new ErroreApp('NON_TROVATO', 'Programma teorico non trovato.');
      const utente = dati.utenti.find((u) => u.id === comando.user_id);
      if (!utente || (utente.ruolo !== 'instructor' && utente.ruolo !== 'direttore')) throw new ErroreApp('NON_TROVATO', 'Istruttore non trovato.');
      const materie = [...new Set(comando.materie)].filter((m) => p.materie.some((x) => x.id === m));
      const altre = dati.abilitazioni.filter((a) => a.user_id !== comando.user_id || a.programma !== comando.programma);
      return {
        dati: { ...dati, abilitazioni: [...altre, ...materie.map((materia) => ({ id: `${comando.user_id}|${comando.programma}|${materia}`, user_id: comando.user_id, programma: comando.programma, materia }))] },
        effetti: [],
      };
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
      if (!['admin', 'direttore', 'instructor', 'trainee'].includes(u.ruolo)) c.errori.ruolo = 'Ruolo non valido';
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
