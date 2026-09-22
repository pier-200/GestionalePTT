import { calcolaReport, requisitiMancanti, type Report } from './compliance';
import type { Dati, ID, Istruttore, Registrazione, Utente } from './tipi';

/** Viste calcolate sui dati, condivise da interfaccia ed esportazioni. */

export const nomeIstruttore = (i: Pick<Istruttore, 'grado' | 'nome' | 'cognome'> | undefined) => (i ? `${i.grado} ${i.nome} ${i.cognome}` : '—');

export function nomeUtente(dati: Dati, id: ID | null | undefined): string {
  if (!id) return '—';
  const a = dati.anagrafiche.find((x) => x.user_id === id);
  if (a) return `${a.grado} ${a.nome} ${a.cognome}`;
  const u = dati.utenti.find((x) => x.id === id);
  return u ? u.nome || u.username : '—';
}

/** Cognome e nome per ordinare gli elenchi. */
export function chiaveOrdine(dati: Dati, u: Utente) {
  const a = dati.anagrafiche.find((x) => x.user_id === u.id);
  return (a ? `${a.cognome} ${a.nome}` : u.nome || u.username).toLowerCase();
}

export const frequentatori = (dati: Dati, ancheDisattivati = false) =>
  dati.utenti.filter((u) => u.ruolo === 'trainee' && (ancheDisattivati || u.attivo)).sort((a, b) => chiaveOrdine(dati, a).localeCompare(chiaveOrdine(dati, b)));

export const registrazioniDi = (dati: Dati, userId: ID) =>
  dati.registrazioni.filter((r) => r.user_id === userId).sort((a, b) => b.data.localeCompare(a.data) || b.modificato_il.localeCompare(a.modificato_il));

export interface RigaIstruttore {
  istruttore: Istruttore;
  task: number;
  registrazioni: number;
  minuti: number;
  prima: string;
  ultima: string;
}

/** Practical Instructors: vista calcolata dalle registrazioni (non compilata a mano). */
export function istruttoriDi(dati: Dati, registrazioni: readonly Registrazione[]): RigaIstruttore[] {
  const perId = new Map<ID, Registrazione[]>();
  for (const r of registrazioni) perId.set(r.instructor_id, [...(perId.get(r.instructor_id) ?? []), r]);
  return [...perId]
    .flatMap(([id, regs]) => {
      const istruttore = dati.istruttori.find((i) => i.id === id);
      if (!istruttore) return [];
      const date = regs.map((r) => r.data).sort();
      return [{ istruttore, task: new Set(regs.map((r) => r.task_id)).size, registrazioni: regs.length, minuti: regs.reduce((s, r) => s + r.et_minuti, 0), prima: date[0], ultima: date.at(-1)! }];
    })
    .sort((a, b) => b.task - a.task || a.istruttore.cognome.localeCompare(b.istruttore.cognome));
}

export interface Situazione {
  utente: Utente;
  nome: string;
  report: Report;
  mancanti: ReturnType<typeof requisitiMancanti>;
  registrazioni: Registrazione[];
  ultima: Registrazione | undefined;
}

export function situazione(dati: Dati, utente: Utente): Situazione {
  const registrazioni = registrazioniDi(dati, utente.id);
  const report = calcolaReport(registrazioni);
  const ultima = [...registrazioni].sort((a, b) => b.modificato_il.localeCompare(a.modificato_il))[0];
  return { utente, nome: nomeUtente(dati, utente.id), report, mancanti: requisitiMancanti(report), registrazioni, ultima };
}

export const formatoData = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('it-IT') : '—');
export const formatoIstante = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const esecuzione = (r: Pick<Registrazione, 'tipo_esecuzione' | 'matricola'>) => (r.tipo_esecuzione === 'AC' ? r.matricola : r.tipo_esecuzione);

export const formatoMinuti = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}′` : `${m}′`);
