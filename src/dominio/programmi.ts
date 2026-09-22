import mttCh47fB13 from '../dati/programmi/mtt-ch47f-b13.json';
import ptrCh47fB13 from '../dati/programmi/ptr-ch47f-b13.json';

/**
 * Programmi di corso, generati dagli Excel ufficiali (scripts/import_catalogo.py e
 * scripts/import_programma_mtt.py). Restano nell'applicazione, non nel database:
 * per aggiungere un corso nuovo basta un file in più in src/dati/programmi.
 */

// --- programma pratico (PTR): catalogo dei task del logbook ------------------

export interface Task {
  id: number;
  modulo: number;
  chapter: string;
  subject: string;
  tipo: string;
  descrizione: string;
  riferimenti: string;
}

export interface Chapter {
  codice: string;
  titolo: string;
  modulo: number;
}

export interface ProgrammaPratico {
  id: string;
  tipo: 'pratico';
  nome: string;
  documento: string;
  aeromobile: string;
  motore: string;
  categoria: string;
  taskType: { codice: string; descrizione: string }[];
  moduli: { numero: number; p66: boolean }[];
  chapter: Chapter[];
  task: Task[];
}

// --- programma teorico (MTT): materie da erogare a lezione -------------------

export interface Voce {
  item: number;
  chapter: string;
  subject: string;
  livello: string;
}

export interface Materia {
  id: string;
  modulo: number;
  minuti: number;
  titolo: string;
  voci: Voce[];
  chapters: string[];
}

export interface ProgrammaTeorico {
  id: string;
  tipo: 'teorico';
  nome: string;
  documento: string;
  aeromobile: string;
  categoria: string;
  moduli: { numero: number; titolo: string; minuti: number }[];
  materie: Materia[];
}

export const PROGRAMMI_PRATICI: ProgrammaPratico[] = [ptrCh47fB13 as ProgrammaPratico];
export const PROGRAMMI_TEORICI: ProgrammaTeorico[] = [mttCh47fB13 as ProgrammaTeorico];

export const programmaPratico = (id: string | null | undefined) => PROGRAMMI_PRATICI.find((p) => p.id === id);
export const programmaTeorico = (id: string | null | undefined) => PROGRAMMI_TEORICI.find((p) => p.id === id);

interface Indice {
  taskPerId: Map<number, Task>;
  chapterPerCodice: Map<string, Chapter>;
  tipiApplicabili: { codice: string; descrizione: string }[];
}

const indici = new Map<string, Indice>();

/** Indici del programma pratico (calcolati una volta sola per programma). */
export function indice(p: ProgrammaPratico): Indice {
  let i = indici.get(p.id);
  if (!i) {
    i = {
      taskPerId: new Map(p.task.map((t) => [t.id, t])),
      chapterPerCodice: new Map(p.chapter.map((c) => [c.codice, c])),
      tipiApplicabili: p.taskType.filter((t) => p.task.some((x) => x.tipo === t.codice)),
    };
    indici.set(p.id, i);
  }
  return i;
}

export const materiaDi = (p: ProgrammaTeorico, id: string) => p.materie.find((m) => m.id === id);
export const oreDaMinuti = (m: number) => `${Math.floor(m / 60)}${m % 60 ? `:${String(m % 60).padStart(2, '0')}` : ''} h`;
/** "Ch 63, 63A, 64" per il sottotitolo di una materia. */
export const chapterMateria = (m: Materia) => `Ch ${m.chapters.join(', ')}`;
