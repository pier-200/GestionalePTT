import { describe, expect, it } from 'vitest';
import { datiEsempio } from '../src/dati/esempio';
import { calcolaReport, requisitiMancanti } from '../src/dominio/compliance';
import { applica, type Comando } from '../src/dominio/motore';
import { generaSettimana, lunediDi, statoTeorico } from '../src/dominio/pianificazione';
import { PROGRAMMI_PRATICI, PROGRAMMI_TEORICI } from '../src/dominio/programmi';
import { registrazioniDi } from '../src/dominio/viste';

const ctx = (utenteId: string) => ({ utenteId, ora: '2026-09-22T10:00:00.000Z', oggi: '2026-09-22' });
const dati = datiEsempio();
const PRATICO = PROGRAMMI_PRATICI[0];
const TEORICO = PROGRAMMI_TEORICI[0];
const C1 = 'c-2026-1';
const C2 = 'c-2026-2';
const di = (id: string, corso = C1) => registrazioniDi(dati, corso, id);
const report = (id: string) => calcolaReport(di(id), PRATICO);

describe('programmi', () => {
  it('il programma pratico ricalca i totali del Compliance Report', () => {
    const r = calcolaReport([], PRATICO);
    expect(r.perTipo.map((x) => [x.codice, x.previsti])).toEqual([['LOC', 66], ['FOT', 35], ['SGH', 36], ['R/I', 26], ['MEL', 0], ['TS', 27]]);
    expect(r.perModulo.map((x) => x.previsti)).toEqual([16, 25, 8, 77, 36, 21, 1, 6]);
    expect([r.totaleP66.previsti, r.totale.previsti]).toEqual([183, 190]);
    expect(r.perChapter).toHaveLength(68);
    expect(r.perTipo.find((x) => x.codice === 'MEL')!.conforme).toBeNull();
  });

  it('il programma teorico somma 219 ore in 8 moduli', () => {
    expect(TEORICO.moduli.reduce((s, m) => s + m.minuti, 0)).toBe(13140);
    expect(TEORICO.moduli.map((m) => m.minuti / 60)).toEqual([9, 52, 1, 108, 25, 16, 3, 5]);
    expect(TEORICO.materie.reduce((s, m) => s + m.voci.length, 0)).toBe(101);
    expect(TEORICO.materie.every((m) => m.minuti % 60 === 0 && m.chapters.length)).toBe(true);
  });
});

describe('compliance', () => {
  it('50% esatto è conforme, un task in meno no; le ripetizioni contano una volta', () => {
    const m8 = PRATICO.task.filter((t) => t.modulo === 8); // 6 task: servono 3
    const tre = m8.slice(0, 3).map((t) => ({ task_id: t.id }));
    expect(calcolaReport(tre, PRATICO).perModulo[7]).toMatchObject({ eseguiti: 3, conforme: true, mancano: 0 });
    expect(calcolaReport([...tre.slice(0, 2), tre[0], tre[0]], PRATICO).perModulo[7]).toMatchObject({ eseguiti: 2, conforme: false, mancano: 1 });
  });

  it('situazione esempio: esiti attesi', () => {
    expect(report('u-romano').conforme).toBe(true);
    const bruno = requisitiMancanti(report('u-bruno'));
    expect(bruno.moduli).toHaveLength(0);
    expect(bruno.tipi).toHaveLength(0);
    expect(bruno.chapter.map((c) => c.codice)).toEqual(['44', '46', 'AVES 3']);
    expect(report('u-gallo').conforme).toBe(false);
    expect(di('u-fontana')).toHaveLength(0);
    expect(dati.registrazioni.every((r) => r.data <= '2026-09-21' && r.et_minuti > 0 && r.corso_id === C1)).toBe(true);
  });
});

describe('pianificazione', () => {
  it('riempie la settimana rispettando 6 ore dal lunedì al giovedì e 3 il venerdì', () => {
    const proposte = generaSettimana(TEORICO, [], '2026-09-14');
    const perGiorno = new Map<string, number>();
    for (const p of proposte) perGiorno.set(p.data, (perGiorno.get(p.data) ?? 0) + p.minuti);
    expect([...perGiorno.values()]).toEqual([360, 360, 360, 360, 180]);
    expect(proposte[0]).toMatchObject({ data: '2026-09-14', ordine: 0, materia: TEORICO.materie[0].id });
    // una materia lunga si spezza fra i giorni, senza superare la capienza
    expect(proposte.every((p) => p.minuti <= 360 && p.minuti % 60 === 0)).toBe(true);
  });

  it('non tocca i giorni già pieni e scala le ore residue', () => {
    const lezioni = dati.lezioni.filter((l) => l.corso_id === C2);
    const stato = statoTeorico(TEORICO, lezioni);
    expect(stato.totale.pianificati).toBe(lezioni.reduce((s, l) => s + l.minuti, 0));
    expect(stato.totale.residui).toBe(stato.totale.minuti - stato.totale.pianificati);
    const lunedi = lunediDi(lezioni[0].data);
    expect(generaSettimana(TEORICO, lezioni, lunedi)).toEqual([]);
    const dopo = generaSettimana(TEORICO, lezioni, '2026-09-28');
    expect(dopo.length).toBeGreaterThan(0);
    expect(statoTeorico(TEORICO, [...lezioni, ...dopo.map((p, i) => ({ ...p, id: String(i), corso_id: C2, recupero: false, validata: false, validata_da: null, validata_il: null, note: '', creato_il: '', modificato_il: '', modificato_da: null }))]).totale.pianificati).toBe(
      stato.totale.pianificati + dopo.reduce((s, p) => s + p.minuti, 0),
    );
  });
});

describe('motore', () => {
  const reg = (user_id: string, extra = {}, corso_id = C1): Comando => ({
    tipo: 'registrazione.salva',
    registrazione: { id: 'nuova', corso_id, user_id, task_id: 1, maintenance_location: 'Hangar', data: '2026-09-22', tipo_esecuzione: 'AC', matricola: 'MM1', et_minuti: 30, instructor_id: 'ist-greco', ...extra },
  });

  it('il frequentatore registra solo per sé, l’istruttore non modifica', () => {
    expect(applica(dati, reg('u-gallo'), ctx('u-gallo')).dati.registrazioni.some((r) => r.id === 'nuova')).toBe(true);
    expect(() => applica(dati, reg('u-romano'), ctx('u-gallo'))).toThrow(/permessi/);
    expect(() => applica(dati, reg('u-gallo'), ctx('u-rinaldi'))).toThrow(/permessi/);
    expect(applica(dati, reg('u-gallo'), ctx('u-tm')).dati.registrazioni.find((r) => r.id === 'nuova')!.modificato_da).toBe('u-tm');
  });

  it('non si registra su un corso a cui non si è iscritti o senza parte pratica', () => {
    expect(() => applica(dati, reg('u-gallo', {}, C2), ctx('u-gallo'))).toThrow(/parte pratica|non iscritto/);
    expect(() => applica(dati, reg('u-marchetti', {}, C1), ctx('u-marchetti'))).toThrow(/permessi|non iscritto/);
  });

  it('valida data futura, ET, matricola e istruttore', () => {
    expect(() => applica(dati, reg('u-gallo', { data: '2026-09-23' }), ctx('u-gallo'))).toThrow(/futura/);
    expect(() => applica(dati, reg('u-gallo', { et_minuti: 0 }), ctx('u-gallo'))).toThrow(/ET/);
    expect(() => applica(dati, reg('u-gallo', { matricola: ' ' }), ctx('u-gallo'))).toThrow(/Matricola/);
    expect(applica(dati, reg('u-gallo', { tipo_esecuzione: 'SIM', matricola: 'x' }), ctx('u-gallo')).dati.registrazioni.find((r) => r.id === 'nuova')!.matricola).toBe('');
    expect(() => applica(dati, reg('u-gallo', { instructor_id: 'boh' }), ctx('u-gallo'))).toThrow(/Instructor/);
  });

  it('solo il TM crea account e corsi; la disattivazione revoca le credenziali', () => {
    const crea: Comando = { tipo: 'utente.crea', utente: { id: 'x', username: 'nuovo.utente', ruolo: 'trainee', nome: '', istruttore_id: null }, password: 'password123' };
    expect(() => applica(dati, crea, ctx('u-gallo'))).toThrow();
    expect(applica(dati, crea, ctx('u-tm')).effetti).toEqual([{ tipo: 'credenziali.imposta', username: 'nuovo.utente', password: 'password123', admin: false }]);
    expect(() => applica(dati, { ...crea, password: 'ab' }, ctx('u-tm'))).toThrow(/4 caratteri/);
    const off = applica(dati, { tipo: 'utente.modifica', utente: { id: 'u-gallo', nome: '', attivo: false, istruttore_id: null } }, ctx('u-tm'));
    expect(off.effetti).toEqual([{ tipo: 'credenziali.rimuovi', username: 'matteo.gallo' }]);
    expect(() => applica(off.dati, reg('u-gallo'), ctx('u-gallo'))).toThrow(/non abilitato/);
    const corso: Comando = {
      tipo: 'corso.salva',
      corso: { id: 'c-x', codice: 'T1-2027/1', nome: 'Nuovo corso', programma_teorico: TEORICO.id, programma_pratico: null, data_inizio: null, data_fine: null, maintenance_organization: '', location: '', ora_inizio: '08:30', minuti_giorno: [360, 360, 360, 360, 180], attivo: true },
    };
    expect(() => applica(dati, corso, ctx('u-neri'))).toThrow(/Training Manager/);
    expect(applica(dati, corso, ctx('u-tm')).dati.corsi).toHaveLength(3);
  });

  it('il direttore prepara il programma del suo corso, l’istruttore no', () => {
    const giorni = ['2026-10-05'];
    const lezioni = [{ id: 'l-x', corso_id: C2, data: '2026-10-05', ordine: 0, minuti: 120, materia: TEORICO.materie[0].id, istruttore_id: 'u-rinaldi', recupero: false, note: '' }];
    const cmd: Comando = { tipo: 'lezioni.sostituisci', corso_id: C2, giorni, lezioni };
    expect(applica(dati, cmd, ctx('u-neri')).dati.lezioni.some((l) => l.id === 'l-x')).toBe(true);
    expect(() => applica(dati, cmd, ctx('u-rinaldi'))).toThrow(/Training Manager|permessi/);
    expect(() => applica(dati, { ...cmd, lezioni: [{ ...lezioni[0], istruttore_id: 'u-colombo' }] }, ctx('u-neri'))).toThrow(/non iscritto/);
    // il direttore di un corso non tocca l'altro
    expect(() => applica(dati, { tipo: 'lezioni.sostituisci', corso_id: 'c-ignoto', giorni, lezioni }, ctx('u-neri'))).toThrow();
  });

  it('abilitazioni: solo TM e direttore, e solo su materie del programma', () => {
    const cmd: Comando = { tipo: 'abilitazioni.imposta', user_id: 'u-rinaldi', programma: TEORICO.id, materie: [TEORICO.materie[0].id, 'inesistente'] };
    const dopo = applica(dati, cmd, ctx('u-neri')).dati.abilitazioni.filter((a) => a.user_id === 'u-rinaldi' && a.programma === TEORICO.id);
    expect(dopo.map((a) => a.materia)).toEqual([TEORICO.materie[0].id]);
    expect(() => applica(dati, cmd, ctx('u-rinaldi'))).toThrow(/permessi|Training Manager/);
  });

  it('iscrizioni: il TM iscrive, i ruoli devono corrispondere', () => {
    const ok: Comando = { tipo: 'corso.iscrivi', iscrizione: { id: 'i-x', corso_id: C2, user_id: 'u-costa', ruolo: 'trainee' } };
    expect(applica(dati, ok, ctx('u-tm')).dati.iscrizioni.some((i) => i.id === 'i-x')).toBe(true);
    expect(applica(dati, ok, ctx('u-neri')).dati.iscrizioni.some((i) => i.id === 'i-x')).toBe(true);
    expect(() => applica(dati, { tipo: 'corso.iscrivi', iscrizione: { id: 'i-y', corso_id: C2, user_id: 'u-costa', ruolo: 'instructor' } }, ctx('u-tm'))).toThrow(/frequentatore/);
    expect(() => applica(dati, ok, ctx('u-rinaldi'))).toThrow(/Training Manager|permessi/);
  });

  it('istruttori duplicati rifiutati', () => {
    const c: Comando = { tipo: 'istruttore.crea', istruttore: { id: 'n', grado: 'mar. ca.', nome: 'paolo', cognome: 'RINALDI' } };
    expect(() => applica(dati, c, ctx('u-gallo'))).toThrow(/già/);
  });
});
