import { CATALOGO, TASK, TASK_PER_ID } from './dominio/catalogo';
import type { Report, RigaReport } from './dominio/compliance';
import { oggiISO } from './dominio/motore';
import type { Dati, Registrazione, Utente } from './dominio/tipi';
import { esecuzione, frequentatori, istruttoriDi, nomeIstruttore, nomeUtente, situazione } from './dominio/viste';

/** Esportazioni (PROGETTO_Logbook_PTT.md §5): Excel del singolo frequentatore, Excel complessivo, CSV. */

type Valore = string | number | Date | null;
type Cella = Valore | { v: Valore; b?: boolean; sfondo?: string; pct?: boolean };
interface Foglio {
  nome: string;
  righe: Cella[][];
  larghezze: number[];
}

const GIALLO = '#FFF3A6';
const GRIGIO = '#E4E7EA';
const data = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : null);
const intestazione = (...titoli: string[]): Cella[] => titoli.map((v) => ({ v, b: true, sfondo: GRIGIO }));
const perc = (p: number | null): Cella => (p == null ? null : { v: p / 100, pct: true });
const esito = (c: boolean | null) => (c == null ? 'n.a.' : c ? 'CONFORME' : 'NON CONFORME');

async function scriviXlsx(fogli: Foglio[], nome: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const cella = (c: Cella) => {
    if (c == null) return null;
    const { v, b, sfondo, pct } = typeof c === 'object' && !(c instanceof Date) ? c : { v: c, b: false, sfondo: undefined, pct: false };
    if (v == null) return sfondo ? { value: '', backgroundColor: sfondo } : null;
    const stile = { ...(b ? { fontWeight: 'bold' as const } : {}), ...(sfondo ? { backgroundColor: sfondo } : {}), wrap: true, alignVertical: 'top' as const };
    if (v instanceof Date) return { value: v, type: Date, format: 'dd/mm/yyyy', ...stile };
    if (typeof v === 'number') return { value: v, type: Number, ...(pct ? { format: '0.0%' } : {}), ...stile };
    return { value: v, type: String, ...stile };
  };
  const sheets = fogli.map((f) => ({ sheet: f.nome.slice(0, 31), data: f.righe.map((r) => r.map(cella)), columns: f.larghezze.map((width) => ({ width })), stickyRowsCount: 1 }));
  const blob = await writeXlsxFile(sheets as never).toBlob();
  scarica(blob, `${nome}.xlsx`);
}

export function scarica(blob: Blob, nomeFile: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const pulisciNome = (s: string) => s.normalize('NFKD').replace(/[^\w-]+/g, '_').replace(/_+/g, '_');

function righeReport(titolo: string, colonna: string, righe: RigaReport[], requisito: string): Cella[][] {
  return [
    [{ v: titolo, b: true }],
    intestazione(colonna, 'Tasks applicable to the A/C type', 'Tasks effectively performed', 'Percentage (%)', `Esito (${requisito})`),
    ...righe.map((r) => [r.codice, r.previsti, r.eseguiti, perc(r.percentuale), esito(r.conforme)]),
  ];
}

function foglioCompliance(report: Report): Foglio {
  const tot = (etichetta: string, t: Report['totale']): Cella[] => [{ v: etichetta, b: true }, { v: t.previsti, b: true }, { v: t.eseguiti, b: true }, { v: t.percentuale / 100, pct: true, b: true }];
  return {
    nome: 'Compliance Report',
    larghezze: [22, 16, 16, 14, 22],
    righe: [
      ...righeReport('4.1 Percentage by task type', 'Type of task', report.perTipo, '≥ 50%'),
      tot('TOTALE', report.totale),
      [],
      ...righeReport('4.2 Percentage by chapter', 'Chapter', report.perChapter, '≥ 1 task'),
      tot('TOTAL task (module AER(EP).P-66)', report.totaleP66),
      tot('TOTAL task', report.totale),
      [],
      ...righeReport('4.3 Percentage by module', 'Module', report.perModulo, '≥ 50%'),
      tot('TOTALE Chapter AER(EP).P-66', report.totaleP66),
      tot('TOTALE', report.totale),
      [],
      [{ v: 'Esito complessivo', b: true }, { v: report.conforme ? 'CONFORME' : 'NON CONFORME', b: true, sfondo: report.conforme ? GIALLO : undefined }],
    ],
  };
}

/** Logbook nel formato dell'Excel originale: tutte le righe del catalogo, una riga per registrazione. */
function foglioLogbook(dati: Dati, registrazioni: Registrazione[]): Foglio {
  const righe: Cella[][] = [
    intestazione('ID', 'MODULE', 'CH', 'SUBJECT', 'TASK TYPE', 'TASK DESCRIPTION', 'OPERATION PERFORMED', 'MAINTENANCE LOCATION', 'DATA', 'A/C', 'ET (min)', 'INSTRUCTOR', 'Ultima modifica', 'Modificato da'),
  ];
  for (const t of TASK) {
    const regs = registrazioni.filter((r) => r.task_id === t.id).sort((a, b) => a.data.localeCompare(b.data));
    const base: Cella[] = [t.id, t.modulo, t.chapter, t.subject, t.tipo, t.descrizione, t.riferimenti];
    if (!regs.length) righe.push(base);
    for (const r of regs) {
      const s = GIALLO;
      righe.push([
        ...base.map((v) => ({ v: v as Valore, sfondo: s })),
        { v: r.maintenance_location, sfondo: s },
        { v: data(r.data), sfondo: s },
        { v: esecuzione(r), sfondo: s },
        { v: r.et_minuti, sfondo: s },
        { v: nomeIstruttore(dati.istruttori.find((i) => i.id === r.instructor_id)), sfondo: s },
        { v: new Date(r.modificato_il).toLocaleString('it-IT'), sfondo: s },
        { v: nomeUtente(dati, r.modificato_da), sfondo: s },
      ]);
    }
  }
  return { nome: 'Logbook', righe, larghezze: [6, 8, 8, 24, 9, 48, 30, 22, 11, 18, 8, 26, 17, 22] };
}

export async function esportaFrequentatore(dati: Dati, utente: Utente) {
  const s = situazione(dati, utente);
  const a = dati.anagrafiche.find((x) => x.user_id === utente.id);
  const t = dati.training.find((x) => x.user_id === utente.id);
  const fogli: Foglio[] = [
    {
      nome: 'Personal Data',
      larghezze: [22, 40],
      righe: [intestazione('Trainee Data', ''), ['Rank', a?.grado ?? null], ['Name', a?.nome ?? null], ['Surname', a?.cognome ?? null], ['Date of birth', data(a?.data_nascita)], ['Place of birth', a?.citta_nascita ?? null], ['MAML', a?.maml || null]],
    },
    {
      nome: 'Practical Type Training Data',
      larghezze: [34, 50],
      righe: [
        intestazione('Practical type training data', ''),
        ['Start date', data(t?.data_inizio)],
        ['End date', data(t?.data_fine)],
        ['Maintenance Organisation (Name and DAAA approval nr)', t?.maintenance_organization || null],
        ['Location', t?.location || null],
      ],
    },
    foglioLogbook(dati, s.registrazioni),
    {
      nome: 'Practical Instructors',
      larghezze: [16, 18, 18, 12, 14, 12, 12, 12],
      righe: [
        intestazione('Rank', 'Name', 'Surname', 'Task', 'Registrazioni', 'ET (min)', 'Prima data', 'Ultima data'),
        ...istruttoriDi(dati, s.registrazioni).map((r) => [r.istruttore.grado, r.istruttore.nome, r.istruttore.cognome, r.task, r.registrazioni, r.minuti, data(r.prima), data(r.ultima)]),
      ],
    },
    foglioCompliance(s.report),
  ];
  await scriviXlsx(fogli, `PTR_${CATALOGO.aeromobile}_${pulisciNome(s.nome)}_${oggiISO()}`);
}

export async function esportaCorso(dati: Dati) {
  const elenco = frequentatori(dati, true).map((u) => situazione(dati, u));
  const tipi = CATALOGO.taskType.filter((t) => TASK.some((x) => x.tipo === t.codice)).map((t) => t.codice);
  const riepilogo: Foglio = {
    nome: 'Riepilogo',
    larghezze: [18, 16, 18, 16, 8, 10, 10, ...CATALOGO.moduli.map(() => 9), ...tipi.map(() => 9), 10, 30, 15],
    righe: [
      intestazione('Grado', 'Nome', 'Cognome', 'Username', 'Attivo', 'Task eseguiti', '% totale', ...CATALOGO.moduli.map((m) => `% Mod. ${m.numero}`), ...tipi.map((t) => `% ${t}`), 'Chapter scoperti', 'Elenco chapter scoperti', 'Esito'),
      ...elenco.map((s) => {
        const a = dati.anagrafiche.find((x) => x.user_id === s.utente.id);
        return [
          a?.grado ?? null,
          a?.nome ?? null,
          a?.cognome ?? null,
          s.utente.username,
          s.utente.attivo ? 'Sì' : 'No',
          s.report.totale.eseguiti,
          perc(s.report.totale.percentuale),
          ...s.report.perModulo.map((r) => perc(r.percentuale)),
          ...s.report.perTipo.filter((r) => r.previsti).map((r) => perc(r.percentuale)),
          s.mancanti.chapter.length,
          s.mancanti.chapter.map((c) => c.codice).join(', '),
          { v: s.report.conforme ? 'CONFORME' : 'NON CONFORME', b: true, sfondo: s.report.conforme ? GIALLO : undefined },
        ];
      }),
    ],
  };
  const grezzi: Foglio = {
    nome: 'Registrazioni',
    larghezze: [26, 7, 7, 8, 8, 48, 22, 11, 9, 18, 8, 26, 17, 22],
    righe: [intestazione(...COLONNE_CSV), ...righeCsv(dati, dati.registrazioni).map((r) => r.map((v, i) => (i === 7 ? data(String(v)) : v)))],
  };
  await scriviXlsx([riepilogo, grezzi], `PTT_riepilogo_corso_${oggiISO()}`);
}

const COLONNE_CSV = ['Frequentatore', 'Task ID', 'Modulo', 'Chapter', 'Task type', 'Descrizione', 'Maintenance location', 'Data', 'Esecuzione', 'Matricola', 'ET (min)', 'Instructor', 'Modificato il', 'Modificato da'];

function righeCsv(dati: Dati, registrazioni: readonly Registrazione[]): Valore[][] {
  return [...registrazioni]
    .sort((a, b) => nomeUtente(dati, a.user_id).localeCompare(nomeUtente(dati, b.user_id)) || a.data.localeCompare(b.data))
    .map((r) => {
      const t = TASK_PER_ID.get(r.task_id)!;
      return [nomeUtente(dati, r.user_id), t.id, t.modulo, t.chapter, t.tipo, t.descrizione, r.maintenance_location, r.data, r.tipo_esecuzione, r.matricola, r.et_minuti, nomeIstruttore(dati.istruttori.find((i) => i.id === r.instructor_id)), r.modificato_il, nomeUtente(dati, r.modificato_da)];
    });
}

/** CSV con separatore ";" e BOM, come lo apre Excel in italiano. */
export function esportaCsv(dati: Dati, registrazioni: readonly Registrazione[], nome: string) {
  const campo = (v: Valore) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const testo = [COLONNE_CSV, ...righeCsv(dati, registrazioni)].map((r) => r.map(campo).join(';')).join('\r\n');
  scarica(new Blob(['﻿', testo], { type: 'text/csv;charset=utf-8' }), `${pulisciNome(nome)}_${oggiISO()}.csv`);
}
