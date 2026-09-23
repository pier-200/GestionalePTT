import { describe, expect, it } from 'vitest';
import { datiEsempio } from '../src/dati/esempio';
import { applica, type Comando } from '../src/dominio/motore';
import { assenzeDi, limiteAssenze, orarioStandard } from '../src/dominio/presenze';
import { PROGRAMMI_TEORICI } from '../src/dominio/programmi';
import type { Lezione, Presenza, Rapportino, StatoPresenza, TipoPeriodo } from '../src/dominio/tipi';
import { lezioniDi, lezioniVisibili, oreDocenti, presenzeDi, rapportiniDi } from '../src/dominio/viste';

/** Rapportino presenze, conteggio delle assenze, recuperi e validazione del programma. */

const ctx = (utenteId: string) => ({ utenteId, ora: '2026-09-22T18:00:00.000Z', oggi: '2026-09-22' });
const dati = datiEsempio();
const TEORICO = PROGRAMMI_TEORICI[0];
const C1 = 'c-2026-1';
const C2 = 'c-2026-2';
const M = TEORICO.materie;
const corso = { ora_inizio: '08:30' };

const lez = (id: string, data: string, ordine: number, minuti: number, materia: string, tipo: TipoPeriodo = 'lezione'): Lezione => ({
  id,
  corso_id: C1,
  data,
  ordine,
  minuti,
  materia,
  istruttore_id: null,
  tipo,
  validata: true,
  validata_da: null,
  validata_il: null,
  note: '',
  creato_il: '',
  modificato_il: '',
  modificato_da: null,
});
const rap = (data: string, validato = true): Rapportino => ({
  id: data,
  corso_id: C1,
  data,
  note: '',
  compilato_da: null,
  compilato_il: '',
  validato_da: null,
  validato_il: validato ? `${data}T17:00:00.000Z` : null,
});
const pres = (data: string, user_id: string, stato: StatoPresenza, dalle: string | null = null, alle: string | null = null): Presenza => ({
  id: `${data}|${user_id}`,
  corso_id: C1,
  data,
  user_id,
  stato,
  dalle,
  alle,
  motivo: '',
});
// giornata tipo con inizio alle 08:30: 08:30-10:30, 10:30-12:30, 12:30-14:30
const giornata = [lez('a', '2026-09-14', 0, 120, M[0].id), lez('b', '2026-09-14', 1, 120, M[0].id), lez('c', '2026-09-14', 2, 120, M[1].id)];

describe('assenze', () => {
  it('chi perde anche un solo minuto di una lezione risulta assente a quella lezione', () => {
    const uscita = assenzeDi(TEORICO, corso, giornata, [rap('2026-09-14')], [pres('2026-09-14', 'u1', 'parziale', '08:00', '12:00')], 'u1');
    expect(uscita.assenze.map((a) => a.lezione.id)).toEqual(['b', 'c']);
    expect(uscita.minuti).toBe(240);
    expect(assenzeDi(TEORICO, corso, giornata, [rap('2026-09-14')], [pres('2026-09-14', 'u1', 'assente')], 'u1').assenze).toHaveLength(3);
    expect(assenzeDi(TEORICO, corso, giornata, [rap('2026-09-14')], [pres('2026-09-14', 'u1', 'presente')], 'u1').minuti).toBe(0);
  });

  it('senza rapportino non si contano assenze; orario standard 08:00-16:30, il venerdì 08:00-12:00', () => {
    expect(assenzeDi(TEORICO, corso, giornata, [], [pres('2026-09-14', 'u1', 'assente')], 'u1').minuti).toBe(0);
    expect(orarioStandard('2026-09-14')).toEqual(['08:00', '16:30']); // lunedì
    expect(orarioStandard('2026-09-17')).toEqual(['08:00', '16:30']); // giovedì
    expect(orarioStandard('2026-09-18')).toEqual(['08:00', '12:00']); // venerdì
  });

  it('le assenze su rapportini non ancora validati restano segnalate a parte', () => {
    const s = assenzeDi(TEORICO, corso, giornata, [rap('2026-09-14', false)], [pres('2026-09-14', 'u1', 'assente')], 'u1');
    expect(s.daValidare).toBe(360);
    expect(s.assenze.every((a) => !a.validata)).toBe(true);
  });

  it('il recupero sana l’assenza della stessa materia e non ne produce di nuove', () => {
    const conRecupero = [...giornata, lez('r', '2026-09-21', 0, 240, M[0].id, 'recupero')];
    const rapportini = [rap('2026-09-14'), rap('2026-09-21')];
    const recuperato = assenzeDi(TEORICO, corso, conRecupero, rapportini, [pres('2026-09-14', 'u1', 'assente'), pres('2026-09-21', 'u1', 'presente')], 'u1');
    expect(recuperato.recuperati).toBe(240);
    expect(recuperato.minuti).toBe(120);
    expect(recuperato.assenze.filter((a) => a.recuperata).map((a) => a.lezione.id)).toEqual(['a', 'b']);
    const assenteAlRecupero = assenzeDi(TEORICO, corso, conRecupero, rapportini, [pres('2026-09-14', 'u1', 'presente'), pres('2026-09-21', 'u1', 'assente')], 'u1');
    expect(assenteAlRecupero.minuti).toBe(0);
  });

  it('non idoneo al raggiungimento del 10% delle ore del corso', () => {
    expect(limiteAssenze(TEORICO)).toBe(1314);
    const molte = Array.from({ length: 12 }, (_, i) => lez(`x${i}`, `2026-09-${String(i + 1).padStart(2, '0')}`, 0, 120, M[i % 6].id));
    const rapportini = molte.map((l) => rap(l.data));
    const presenze = molte.map((l) => pres(l.data, 'u1', 'assente'));
    const dieci = assenzeDi(TEORICO, corso, molte.slice(0, 10), rapportini, presenze, 'u1');
    expect([dieci.minuti, dieci.idoneo]).toEqual([1200, true]);
    const undici = assenzeDi(TEORICO, corso, molte.slice(0, 11), rapportini, presenze, 'u1');
    expect([undici.minuti, undici.idoneo]).toEqual([1320, false]);
  });

  it('situazione esempio: rapportini, una lezione di recupero e un frequentatore non idoneo', () => {
    const lezioni = lezioniDi(dati, C1);
    const rapportini = rapportiniDi(dati, C1);
    const presenze = presenzeDi(dati, C1);
    expect(rapportini.length).toBeGreaterThan(10);
    expect(lezioni.filter((l) => l.tipo === 'recupero')).toHaveLength(1);
    expect(assenzeDi(TEORICO, dati.corsi[0], lezioni, rapportini, presenze, 'u-ricci').idoneo).toBe(false);
    expect(assenzeDi(TEORICO, dati.corsi[0], lezioni, rapportini, presenze, 'u-costa').recuperati).toBeGreaterThan(0);
    expect(assenzeDi(TEORICO, dati.corsi[0], lezioni, rapportini, presenze, 'u-romano').minuti).toBe(0);
    expect(rapportiniDi(dati, C2).some((r) => !r.validato_il)).toBe(true);
    expect(lezioniVisibili(dati, C2, 'trainee').length).toBeLessThan(lezioniDi(dati, C2).length);
  });

  it('le ore degli istruttori sommano le lezioni del corso', () => {
    const lezioni = lezioniDi(dati, C1);
    const righe = oreDocenti(dati, C1, lezioni, '2026-09-22');
    expect(righe.reduce((s, r) => s + r.minuti, 0)).toBe(lezioni.filter((l) => l.istruttore_id).reduce((s, l) => s + l.minuti, 0));
    expect(righe[0].minuti).toBeGreaterThan(0);
    expect(righe.every((r) => r.svolti <= r.minuti)).toBe(true);
  });
});

describe('motore: rapportino e validazione', () => {
  const salva = (data = '2026-09-22'): Comando => ({
    tipo: 'rapportino.salva',
    corso_id: C1,
    data,
    note: '',
    presenze: [{ id: 'p1', user_id: 'u-gallo', stato: 'assente', dalle: null, alle: null, motivo: 'Servizio' }],
  });

  it('qualsiasi frequentatore compila il rapportino di tutti, solo nel proprio corso', () => {
    const dopo = applica(dati, salva(), ctx('u-romano')).dati;
    expect(dopo.presenze.find((p) => p.data === '2026-09-22' && p.user_id === 'u-gallo')!.stato).toBe('assente');
    expect(dopo.rapportini.find((r) => r.data === '2026-09-22' && r.corso_id === C1)!.compilato_da).toBe('u-romano');
    expect(() => applica(dati, salva(), ctx('u-marchetti'))).toThrow(/partecipa|permessi/);
    expect(() => applica(dati, salva('2026-09-23'), ctx('u-romano'))).toThrow(/futura/);
    expect(() =>
      applica(dati, { tipo: 'rapportino.salva', corso_id: C1, data: '2026-09-22', note: '', presenze: [{ id: 'p', user_id: 'u-rinaldi', stato: 'assente', dalle: null, alle: null, motivo: '' }] }, ctx('u-romano')),
    ).toThrow(/non iscritto/);
  });

  it('la presenza parziale vuole orari validi e coerenti', () => {
    const parziale = (dalle: string, alle: string): Comando => ({
      tipo: 'rapportino.salva',
      corso_id: C1,
      data: '2026-09-22',
      note: '',
      presenze: [{ id: 'p1', user_id: 'u-gallo', stato: 'parziale', dalle, alle, motivo: '' }],
    });
    expect(applica(dati, parziale('08:00', '12:30'), ctx('u-gallo')).dati.presenze.find((p) => p.data === '2026-09-22')!.alle).toBe('12:30');
    expect(() => applica(dati, parziale('08:00', '07:00'), ctx('u-gallo'))).toThrow(/uscita/);
    expect(() => applica(dati, parziale('boh', '12:00'), ctx('u-gallo'))).toThrow(/Orario/);
  });

  it('dopo la validazione correggono solo TM e direttore; la riapertura riporta in bozza', () => {
    const compilato = applica(dati, salva(), ctx('u-romano')).dati;
    const validato = applica(compilato, { tipo: 'rapportino.valida', corso_id: C1, data: '2026-09-22', valida: true }, ctx('u-neri')).dati;
    expect(validato.rapportini.find((r) => r.data === '2026-09-22' && r.corso_id === C1)!.validato_da).toBe('u-neri');
    expect(() => applica(validato, salva(), ctx('u-romano'))).toThrow(/validato/);
    expect(() => applica(compilato, { tipo: 'rapportino.valida', corso_id: C1, data: '2026-09-22', valida: true }, ctx('u-romano'))).toThrow(/permessi|direttore/);
    const riaperto = applica(validato, { tipo: 'rapportino.valida', corso_id: C1, data: '2026-09-22', valida: false }, ctx('u-tm')).dati;
    expect(applica(riaperto, salva(), ctx('u-gallo')).dati.presenze.some((p) => p.data === '2026-09-22')).toBe(true);
  });

  it('il programma si vede solo dopo la validazione e ogni modifica la ritira', () => {
    const giorni = ['2026-10-05'];
    const lezione = { id: 'l-v', corso_id: C2, data: '2026-10-05', ordine: 0, minuti: 45, materia: M[0].id, istruttore_id: 'u-rinaldi', tipo: 'lezione' as const, note: '' };
    const messe = applica(dati, { tipo: 'lezioni.sostituisci', corso_id: C2, giorni, lezioni: [lezione] }, ctx('u-neri')).dati;
    expect(messe.lezioni.find((l) => l.id === 'l-v')!.validata).toBe(false);
    expect(lezioniVisibili(messe, C2, 'trainee').some((l) => l.id === 'l-v')).toBe(false);
    const validate = applica(messe, { tipo: 'settimana.valida', corso_id: C2, giorni, valida: true }, ctx('u-neri')).dati;
    expect(lezioniVisibili(validate, C2, 'trainee').some((l) => l.id === 'l-v')).toBe(true);
    expect(() => applica(validate, { tipo: 'settimana.valida', corso_id: C2, giorni, valida: false }, ctx('u-marchetti'))).toThrow(/permessi|direttore/);
    const cambiate = applica(validate, { tipo: 'lezioni.sostituisci', corso_id: C2, giorni, lezioni: [{ ...lezione, minuti: 90 }] }, ctx('u-neri')).dati;
    expect(cambiate.lezioni.find((l) => l.id === 'l-v')!.validata).toBe(false);
    expect(() => applica(dati, { tipo: 'lezioni.sostituisci', corso_id: C2, giorni, lezioni: [{ ...lezione, minuti: 50 }] }, ctx('u-neri'))).toThrow(/Durata/);
  });
});
