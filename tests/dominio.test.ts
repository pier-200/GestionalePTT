import { describe, expect, it } from 'vitest';
import { datiEsempio } from '../src/dati/esempio';
import { TASK } from '../src/dominio/catalogo';
import { calcolaReport, requisitiMancanti } from '../src/dominio/compliance';
import { applica, type Comando } from '../src/dominio/motore';

const ctx = (utenteId: string) => ({ utenteId, ora: '2026-09-22T10:00:00.000Z', oggi: '2026-09-22' });
const dati = datiEsempio();
const di = (id: string) => dati.registrazioni.filter((r) => r.user_id === id);

describe('catalogo', () => {
  it('ricalca i totali del Compliance Report', () => {
    const r = calcolaReport([]);
    expect(r.perTipo.map((x) => [x.codice, x.previsti])).toEqual([['LOC', 66], ['FOT', 35], ['SGH', 36], ['R/I', 26], ['MEL', 0], ['TS', 27]]);
    expect(r.perModulo.map((x) => x.previsti)).toEqual([16, 25, 8, 77, 36, 21, 1, 6]);
    expect([r.totaleP66.previsti, r.totale.previsti]).toEqual([183, 190]);
    expect(r.perChapter).toHaveLength(68);
    expect(r.perTipo.find((x) => x.codice === 'MEL')!.conforme).toBeNull();
  });
});

describe('compliance', () => {
  it('50% esatto è conforme, un task in meno no; le ripetizioni contano una volta', () => {
    const m7 = TASK.filter((t) => t.modulo === 8); // 6 task: servono 3
    const tre = m7.slice(0, 3).map((t) => ({ task_id: t.id }));
    expect(calcolaReport(tre).perModulo[7]).toMatchObject({ eseguiti: 3, conforme: true, mancano: 0 });
    expect(calcolaReport([...tre.slice(0, 2), tre[0], tre[0]]).perModulo[7]).toMatchObject({ eseguiti: 2, conforme: false, mancano: 1 });
  });

  it('situazione esempio: esiti attesi', () => {
    expect(calcolaReport(di('u-romano')).conforme).toBe(true);
    const bruno = requisitiMancanti(calcolaReport(di('u-bruno')));
    expect(bruno.moduli).toHaveLength(0);
    expect(bruno.tipi).toHaveLength(0);
    expect(bruno.chapter.map((c) => c.codice)).toEqual(['44', '46', 'AVES 3']);
    expect(calcolaReport(di('u-gallo')).conforme).toBe(false);
    expect(di('u-fontana')).toHaveLength(0);
    expect(dati.registrazioni.every((r) => r.data <= '2026-09-21' && r.et_minuti > 0)).toBe(true);
  });
});

describe('motore', () => {
  const reg = (user_id: string, extra = {}): Comando => ({
    tipo: 'registrazione.salva',
    registrazione: { id: 'nuova', user_id, task_id: 1, maintenance_location: 'Hangar', data: '2026-09-22', tipo_esecuzione: 'AC', matricola: 'MM1', et_minuti: 30, instructor_id: 'ist-greco', ...extra },
  });

  it('il frequentatore registra solo per sé, l’istruttore non modifica', () => {
    expect(applica(dati, reg('u-gallo'), ctx('u-gallo')).dati.registrazioni.some((r) => r.id === 'nuova')).toBe(true);
    expect(() => applica(dati, reg('u-romano'), ctx('u-gallo'))).toThrow(/permessi/);
    expect(() => applica(dati, reg('u-gallo'), ctx('u-rinaldi'))).toThrow(/permessi/);
    expect(applica(dati, reg('u-gallo'), ctx('u-tm')).dati.registrazioni.find((r) => r.id === 'nuova')!.modificato_da).toBe('u-tm');
  });

  it('valida data futura, ET, matricola e istruttore', () => {
    expect(() => applica(dati, reg('u-gallo', { data: '2026-09-23' }), ctx('u-gallo'))).toThrow(/futura/);
    expect(() => applica(dati, reg('u-gallo', { et_minuti: 0 }), ctx('u-gallo'))).toThrow(/ET/);
    expect(() => applica(dati, reg('u-gallo', { matricola: ' ' }), ctx('u-gallo'))).toThrow(/Matricola/);
    expect(applica(dati, reg('u-gallo', { tipo_esecuzione: 'SIM', matricola: 'x' }), ctx('u-gallo')).dati.registrazioni.find((r) => r.id === 'nuova')!.matricola).toBe('');
    expect(() => applica(dati, reg('u-gallo', { instructor_id: 'boh' }), ctx('u-gallo'))).toThrow(/Instructor/);
  });

  it('solo il TM crea account e training data; la disattivazione revoca le credenziali', () => {
    const crea: Comando = { tipo: 'utente.crea', utente: { id: 'x', username: 'nuovo.utente', ruolo: 'trainee', nome: '', istruttore_id: null }, password: 'password123' };
    expect(() => applica(dati, crea, ctx('u-gallo'))).toThrow();
    expect(applica(dati, crea, ctx('u-tm')).effetti).toEqual([{ tipo: 'credenziali.imposta', username: 'nuovo.utente', password: 'password123', admin: false }]);
    expect(() => applica(dati, { ...crea, password: 'corta1' }, ctx('u-tm'))).toThrow(/10 caratteri/);
    const off = applica(dati, { tipo: 'utente.modifica', utente: { id: 'u-gallo', nome: '', attivo: false, istruttore_id: null } }, ctx('u-tm'));
    expect(off.effetti).toEqual([{ tipo: 'credenziali.rimuovi', username: 'matteo.gallo' }]);
    expect(() => applica(off.dati, reg('u-gallo'), ctx('u-gallo'))).toThrow(/non abilitato/);
    const t: Comando = { tipo: 'training.salva', user_ids: ['u-gallo'], training: { data_inizio: '2026-07-06', data_fine: '2026-07-01', maintenance_organization: '', location: '' } };
    expect(() => applica(dati, t, ctx('u-tm'))).toThrow(/precede/);
    expect(() => applica(dati, t, ctx('u-gallo'))).toThrow(/Training Manager/);
  });

  it('istruttori duplicati rifiutati', () => {
    const c: Comando = { tipo: 'istruttore.crea', istruttore: { id: 'n', grado: 'mar. ca.', nome: 'paolo', cognome: 'RINALDI' } };
    expect(() => applica(dati, c, ctx('u-gallo'))).toThrow(/già/);
  });
});
