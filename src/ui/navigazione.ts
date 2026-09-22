import {
  IconBook2,
  IconClipboardList,
  IconId,
  IconLayoutGrid,
  IconReportAnalytics,
  IconTable,
  IconUserCircle,
  IconUsersGroup,
  IconUserShield,
} from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';
import type { Dati, Utente } from '../dominio/tipi';
import { frequentatori } from '../dominio/viste';
import { usePosizione } from './router';
import { useStato } from './stato';

export interface Voce {
  a: string;
  etichetta: string;
  breve: string;
  icona: Icon;
  /** Pagina riferita a un frequentatore (per TM e istruttori richiede la selezione). */
  frequentatore?: boolean;
}

const PAGINE_FREQUENTATORE: Voce[] = [
  { a: '/tavola', etichetta: 'Tavola', breve: 'Tavola', icona: IconLayoutGrid, frequentatore: true },
  { a: '/logbook', etichetta: 'Logbook', breve: 'Logbook', icona: IconClipboardList, frequentatore: true },
  { a: '/report', etichetta: 'Compliance Report', breve: 'Report', icona: IconReportAnalytics, frequentatore: true },
  { a: '/istruttori', etichetta: 'Practical Instructors', breve: 'Istruttori', icona: IconUsersGroup, frequentatore: true },
  { a: '/dati', etichetta: 'Personal & Training Data', breve: 'Dati', icona: IconId, frequentatore: true },
];

export const GENERALITA: Voce = { a: '/generalita', etichetta: 'Generality and Purpose', breve: 'Generality', icona: IconBook2 };
export const PROFILO: Voce = { a: '/profilo', etichetta: 'Profilo e password', breve: 'Profilo', icona: IconUserCircle };
export const CORSO: Voce = { a: '/', etichetta: 'Situazione del corso', breve: 'Corso', icona: IconTable };
export const ACCOUNT: Voce = { a: '/account', etichetta: 'Account e corso', breve: 'Account', icona: IconUserShield };

export function vociPer(utente: Utente) {
  if (utente.ruolo === 'trainee') {
    return { corso: [] as Voce[], frequentatore: [{ ...PAGINE_FREQUENTATORE[0], a: '/' }, ...PAGINE_FREQUENTATORE.slice(1)], altro: [GENERALITA, PROFILO] };
  }
  return { corso: utente.ruolo === 'admin' ? [CORSO, ACCOUNT] : [CORSO], frequentatore: PAGINE_FREQUENTATORE, altro: [GENERALITA, PROFILO] };
}

const CHIAVE = 'ptt:frequentatore';

function ultimoScelto(): string | null {
  try {
    return sessionStorage.getItem(CHIAVE);
  } catch {
    return null;
  }
}

export function ricordaFrequentatore(id: string) {
  try {
    sessionStorage.setItem(CHIAVE, id);
  } catch {
    /* ignorato */
  }
}

/** Il frequentatore a cui si riferiscono le pagine: sé stesso per il trainee, quello scelto per TM e istruttori. */
export function scegliFrequentatore(dati: Dati, utente: Utente, query: URLSearchParams): Utente | null {
  if (utente.ruolo === 'trainee') return utente;
  const elenco = frequentatori(dati, true);
  const id = query.get('f') ?? ultimoScelto();
  return elenco.find((u) => u.id === id) ?? null;
}

export function useFrequentatore(): Utente | null {
  const { dati, utente } = useStato();
  const { query } = usePosizione();
  if (!dati || !utente) return null;
  return scegliFrequentatore(dati, utente, query);
}

/** Collegamento a una pagina del frequentatore, con il parametro f per TM e istruttori. */
export function linkFrequentatore(percorso: string, utente: Utente, f: string | null | undefined, extra = '') {
  const base = utente.ruolo === 'trainee' && percorso === '/tavola' ? '/' : percorso;
  const q = [utente.ruolo !== 'trainee' && f ? `f=${f}` : '', extra].filter(Boolean).join('&');
  return `#${base}${q ? `?${q}` : ''}`;
}
