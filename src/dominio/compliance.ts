import { CATALOGO, TASK, type Task } from './catalogo';
import type { Registrazione } from './tipi';

/**
 * Compliance Report (Allegato 1, cap. 4). Un frequentatore è conforme quando:
 * ≥50% dei task eseguiti per ciascun modulo, ≥50% per ciascun task type,
 * ≥1 task eseguito per ciascun chapter. Più registrazioni dello stesso task contano una volta.
 */

export interface RigaReport {
  codice: string;
  titolo: string;
  previsti: number;
  eseguiti: number;
  /** null se non ci sono task previsti (es. MEL). */
  percentuale: number | null;
  /** null = requisito non applicabile. */
  conforme: boolean | null;
  /** Task ancora da eseguire per soddisfare il requisito. */
  mancano: number;
}

export interface Totale {
  previsti: number;
  eseguiti: number;
  percentuale: number;
}

export interface Report {
  eseguiti: Set<number>;
  perTipo: RigaReport[];
  perChapter: RigaReport[];
  perModulo: RigaReport[];
  /** Totale dei moduli AER(EP).P-66 (esclusi i moduli AVES). */
  totaleP66: Totale;
  totale: Totale;
  conforme: boolean;
}

const perc = (eseguiti: number, previsti: number) => (previsti ? Math.round((eseguiti / previsti) * 1000) / 10 : null);

/** Soglia del 50%: il minimo intero di task che la soddisfa. */
export const minimoMeta = (previsti: number) => Math.ceil(previsti / 2);

function riga(codice: string, titolo: string, task: readonly Task[], eseguiti: Set<number>, requisito: 'meta' | 'uno'): RigaReport {
  const previsti = task.length;
  const fatti = task.filter((t) => eseguiti.has(t.id)).length;
  const minimo = requisito === 'meta' ? minimoMeta(previsti) : 1;
  return {
    codice,
    titolo,
    previsti,
    eseguiti: fatti,
    percentuale: perc(fatti, previsti),
    conforme: previsti ? fatti >= minimo : null,
    mancano: previsti ? Math.max(0, minimo - fatti) : 0,
  };
}

const totale = (task: readonly Task[], eseguiti: Set<number>): Totale => {
  const fatti = task.filter((t) => eseguiti.has(t.id)).length;
  return { previsti: task.length, eseguiti: fatti, percentuale: perc(fatti, task.length) ?? 0 };
};

export function calcolaReport(registrazioni: readonly Pick<Registrazione, 'task_id'>[]): Report {
  const eseguiti = new Set(registrazioni.map((r) => r.task_id));
  const perTipo = CATALOGO.taskType.map((t) =>
    riga(t.codice, t.descrizione, TASK.filter((x) => x.tipo === t.codice), eseguiti, 'meta'),
  );
  const perChapter = CATALOGO.chapter.map((c) => riga(c.codice, c.titolo, TASK.filter((x) => x.chapter === c.codice), eseguiti, 'uno'));
  const perModulo = CATALOGO.moduli.map((m) =>
    riga(String(m.numero), `Modulo ${m.numero}`, TASK.filter((x) => x.modulo === m.numero), eseguiti, 'meta'),
  );
  const p66 = new Set(CATALOGO.moduli.filter((m) => m.p66).map((m) => m.numero));
  const tutte = [...perTipo, ...perChapter, ...perModulo];
  return {
    eseguiti,
    perTipo,
    perChapter,
    perModulo,
    totaleP66: totale(
      TASK.filter((t) => p66.has(t.modulo)),
      eseguiti,
    ),
    totale: totale(TASK, eseguiti),
    conforme: tutte.every((r) => r.conforme !== false),
  };
}

/** Requisiti non ancora soddisfatti, nell'ordine del report. */
export function requisitiMancanti(r: Report) {
  return {
    moduli: r.perModulo.filter((x) => x.conforme === false),
    tipi: r.perTipo.filter((x) => x.conforme === false),
    chapter: r.perChapter.filter((x) => x.conforme === false),
  };
}

export const formatoPercentuale = (p: number | null) => (p == null ? '—' : `${p.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`);
