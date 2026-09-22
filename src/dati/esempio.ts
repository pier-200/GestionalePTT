import { TASK, type Task } from '../dominio/catalogo';
import { minimoMeta } from '../dominio/compliance';
import type { Anagrafica, Dati, DatiTraining, Istruttore, Registrazione, TipoEsecuzione, Utente } from '../dominio/tipi';

/**
 * Situazione esempio SINTETICA per la modalità dimostrativa: persone, matricole e
 * approvazioni sono inventate. Generata in modo deterministico (stesso seme, stessi dati).
 */

export const PASSWORD_DEMO = 'ptt-demo-2026';

function generatore(seme: number) {
  let a = seme;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    r,
    tra: (min: number, max: number) => min + Math.floor(r() * (max - min + 1)),
    uno: <T,>(lista: readonly T[]) => lista[Math.floor(r() * lista.length)],
    mescola: <T,>(lista: readonly T[]) => {
      const c = [...lista];
      for (let i = c.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [c[i], c[j]] = [c[j], c[i]];
      }
      return c;
    },
  };
}

const INIZIO = '2026-07-06';
const ISTANTE_BASE = '2026-07-01T08:00:00.000Z';

const ISTRUTTORI: Istruttore[] = [
  ['ist-rinaldi', 'Mar. Ca.', 'Paolo', 'Rinaldi'],
  ['ist-colombo', 'Lgt.', 'Andrea', 'Colombo'],
  ['ist-greco', '1° Mar.', 'Stefano', 'Greco'],
  ['ist-marino', 'Serg. Magg. Ca.', 'Davide', 'Marino'],
  ['ist-conti', 'Mar. Ord.', 'Fabio', 'Conti'],
].map(([id, grado, nome, cognome]) => ({ id, grado, nome, cognome, created_at: ISTANTE_BASE, created_by: 'u-tm' }));

const utente = (id: string, username: string, ruolo: Utente['ruolo'], nome = '', istruttore_id: string | null = null): Utente => ({
  id,
  username,
  ruolo,
  nome,
  istruttore_id,
  attivo: true,
  deve_cambiare_password: false,
  created_at: ISTANTE_BASE,
  updated_at: ISTANTE_BASE,
});

interface Profilo {
  id: string;
  username: string;
  anagrafica: [string, string, string, string, string, string] | null;
  /** quanti task eseguire e con quali vincoli */
  obiettivo: { conforme: 'si' | 'quasi' | 'no'; task: number; chapterScoperti?: string[] };
}

const FREQUENTATORI: Profilo[] = [
  { id: 'u-romano', username: 'giulia.romano', anagrafica: ['Serg. Magg.', 'Giulia', 'Romano', '1994-03-18', 'Viterbo', 'MAML-IT-0417'], obiettivo: { conforme: 'si', task: 118 } },
  {
    id: 'u-bruno',
    username: 'alessandro.bruno',
    anagrafica: ['Serg.', 'Alessandro', 'Bruno', '1996-11-02', 'Caserta', 'MAML-IT-0388'],
    obiettivo: { conforme: 'quasi', task: 104, chapterScoperti: ['44', '46', 'AVES 3'] },
  },
  { id: 'u-gallo', username: 'matteo.gallo', anagrafica: ['C.le Magg. Sc.', 'Matteo', 'Gallo', '1998-07-25', 'Rieti', 'MAML-IT-0452'], obiettivo: { conforme: 'no', task: 71 } },
  { id: 'u-costa', username: 'francesca.costa', anagrafica: ['Serg.', 'Francesca', 'Costa', '1997-01-09', 'Bracciano', ''], obiettivo: { conforme: 'no', task: 44 } },
  { id: 'u-ricci', username: 'luca.ricci', anagrafica: ['C.le Magg. Ca.', 'Luca', 'Ricci', '1995-05-30', 'Orvieto', ''], obiettivo: { conforme: 'no', task: 19 } },
  { id: 'u-fontana', username: 'simone.fontana', anagrafica: null, obiettivo: { conforme: 'no', task: 0 } },
];

/** Giorni lavorativi del corso fino a ieri (rispetto al 22/09/2026, data di preparazione dell'esempio). */
function giorniLavorativi(fino: string): string[] {
  const giorni: string[] = [];
  for (let d = new Date(`${INIZIO}T12:00:00Z`); d.toISOString().slice(0, 10) <= fino; d.setUTCDate(d.getUTCDate() + 1)) {
    const g = d.getUTCDay();
    const iso = d.toISOString().slice(0, 10);
    // pausa estiva di Ferragosto
    if (g !== 0 && g !== 6 && !(iso >= '2026-08-10' && iso <= '2026-08-21')) giorni.push(iso);
  }
  return giorni;
}

/** Sceglie i task da eseguire rispettando (o no) i requisiti di conformità. */
function scegliTask(p: Profilo, g: ReturnType<typeof generatore>): Task[] {
  const { conforme, task: quanti, chapterScoperti = [] } = p.obiettivo;
  if (!quanti) return [];
  const scelti = new Set<Task>();
  const disponibili = TASK.filter((t) => !chapterScoperti.includes(t.chapter));
  if (conforme !== 'no') {
    // un task per ogni chapter coperto, poi il 50% di ogni modulo e task type
    for (const ch of new Set(disponibili.map((t) => t.chapter))) scelti.add(g.uno(disponibili.filter((t) => t.chapter === ch)));
    const gruppi = (chiave: (t: Task) => string | number) => [...new Set(TASK.map(chiave))].map((k) => TASK.filter((t) => chiave(t) === k));
    for (const gruppo of [...gruppi((t) => t.modulo), ...gruppi((t) => t.tipo)]) {
      const candidati = g.mescola(gruppo.filter((t) => disponibili.includes(t)));
      for (const t of candidati) {
        if ([...scelti].filter((s) => gruppo.includes(s)).length >= minimoMeta(gruppo.length)) break;
        scelti.add(t);
      }
    }
    for (const t of g.mescola(disponibili)) if (scelti.size < quanti) scelti.add(t);
  } else {
    // avanzamento parziale: si procede per moduli, con qualche salto in avanti
    const pesati = [...disponibili].sort((a, b) => a.modulo + g.r() * 3.2 - (b.modulo + g.r() * 3.2));
    for (const t of pesati) if (scelti.size < quanti && g.r() < 0.78) scelti.add(t);
    for (const t of pesati) if (scelti.size < quanti) scelti.add(t);
  }
  return [...scelti].sort((a, b) => a.modulo - b.modulo || a.id - b.id);
}

const ET: Record<string, [number, number]> = { LOC: [20, 45], SGH: [30, 90], FOT: [40, 120], 'R/I': [60, 180], TS: [45, 150] };
const MATRICOLE = ['MM81781 · EI-901', 'MM81783 · EI-903', 'MM81786 · EI-906', 'MM81790 · EI-910'];

function registrazioni(p: Profilo, g: ReturnType<typeof generatore>): Registrazione[] {
  const task = scegliTask(p, g);
  if (!task.length) return [];
  const giorni = giorniLavorativi('2026-09-21');
  // tutti registrano fino agli ultimi giorni; chi è più indietro registra meno spesso
  const finestra = giorni.slice(0, giorni.length - g.tra(0, 3));
  const elenco: Registrazione[] = [];
  task.forEach((t, i) => {
    const volte = g.r() < 0.12 ? 2 : 1;
    for (let v = 0; v < volte; v++) {
      const indice = Math.min(finestra.length - 1, Math.floor((i / task.length) * finestra.length) + v * g.tra(2, 6));
      const data = finestra[indice];
      const x = g.r();
      const tipo: TipoEsecuzione = x < 0.86 ? 'AC' : x < 0.93 ? 'SIM' : 'CLA';
      const [min, max] = ET[t.tipo];
      const ora = `${data}T${String(g.tra(13, 17)).padStart(2, '0')}:${String(g.tra(0, 59)).padStart(2, '0')}:00.000Z`;
      elenco.push({
        id: `r-${p.id.slice(2)}-${t.id}-${v}`,
        user_id: p.id,
        task_id: t.id,
        maintenance_location: tipo === 'AC' ? g.uno(['Viterbo – Hangar 3', 'Viterbo – Hangar 3', 'Viterbo – Linea volo']) : tipo === 'SIM' ? 'Viterbo – Simulatore CH-47F' : 'Viterbo – Aula didattica 2',
        data,
        tipo_esecuzione: tipo,
        matricola: tipo === 'AC' ? g.uno(MATRICOLE) : '',
        et_minuti: Math.round(g.tra(min, max) / 5) * 5,
        instructor_id: g.uno([...ISTRUTTORI, ISTRUTTORI[0], ISTRUTTORI[1]]).id,
        creato_il: ora,
        creato_da: p.id,
        modificato_il: ora,
        modificato_da: p.id,
      });
    }
  });
  // un paio di correzioni del Training Manager
  for (const r of elenco.filter((_, i) => i % 37 === 5)) {
    r.modificato_il = `${r.data}T19:10:00.000Z`;
    r.modificato_da = 'u-tm';
  }
  return elenco;
}

export function datiEsempio(): Dati {
  const g = generatore(147);
  const training: DatiTraining[] = FREQUENTATORI.map((p) => ({
    user_id: p.id,
    data_inizio: INIZIO,
    data_fine: '2026-10-02',
    maintenance_organization: '1° Reggimento AVES "Antares" – appr. DAAA n. 00/ESEMPIO',
    location: 'Viterbo',
    updated_at: ISTANTE_BASE,
    updated_by: 'u-tm',
  }));
  const anagrafiche: Anagrafica[] = FREQUENTATORI.filter((p) => p.anagrafica).map((p) => {
    const [grado, nome, cognome, data_nascita, citta_nascita, maml] = p.anagrafica!;
    return { user_id: p.id, grado, nome, cognome, data_nascita, citta_nascita, maml, updated_at: '2026-07-06T09:00:00.000Z', updated_by: p.id };
  });
  const fontana = utente('u-fontana', 'simone.fontana', 'trainee');
  fontana.created_at = fontana.updated_at = '2026-09-21T10:00:00.000Z';
  return {
    utenti: [
      utente('u-tm', 'tm.ferri', 'admin', 'Magg. Luca Ferri'),
      utente('u-rinaldi', 'paolo.rinaldi', 'instructor', 'Mar. Ca. Paolo Rinaldi', 'ist-rinaldi'),
      utente('u-colombo', 'andrea.colombo', 'instructor', 'Lgt. Andrea Colombo', 'ist-colombo'),
      ...FREQUENTATORI.filter((p) => p.id !== 'u-fontana').map((p) => utente(p.id, p.username, 'trainee')),
      fontana,
    ],
    anagrafiche,
    training,
    istruttori: ISTRUTTORI,
    registrazioni: FREQUENTATORI.flatMap((p) => registrazioni(p, g)),
  };
}
