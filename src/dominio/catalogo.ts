import dati from '../dati/catalogo.json';

/** Catalogo ufficiale dei task, generato da scripts/import_catalogo.py. */

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

export const CATALOGO = dati as {
  documento: string;
  aeromobile: string;
  motore: string;
  categoria: string;
  taskType: { codice: string; descrizione: string }[];
  moduli: { numero: number; p66: boolean }[];
  chapter: Chapter[];
  task: Task[];
};

export const TASK: readonly Task[] = CATALOGO.task;
export const TASK_PER_ID = new Map(TASK.map((t) => [t.id, t]));
export const CHAPTER_PER_CODICE = new Map(CATALOGO.chapter.map((c) => [c.codice, c]));
