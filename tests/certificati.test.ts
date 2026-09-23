import { describe, expect, it } from 'vitest';
import { datiEsempio } from '../src/dati/esempio';
import { applica, prossimoNumero, type CampiCertificato, type Comando } from '../src/dominio/motore';

/** Registro dei certificati AER(EP).P-147. */

const ctx = (utenteId: string) => ({ utenteId, ora: '2026-09-23T12:00:00.000Z', oggi: '2026-09-23' });
const dati = datiEsempio();
const C1 = 'c-2026-1';

const certificato = (extra: Partial<CampiCertificato> = {}): Comando => ({
  tipo: 'certificato.salva',
  certificato: {
    id: 'cert-nuovo',
    corso_id: C1,
    user_id: 'u-costa',
    numero: 0,
    anno: 2026,
    tipo: 'teorico',
    stato: 'bozza',
    mds: 'CH-47F',
    categoria: 'B1.3',
    programma: 'T1 Military Type Training CH-47F Cat. B1.3',
    data_inizio: '2026-07-06',
    data_fine: '2026-10-02',
    ore: 219,
    esame_data: '2026-09-18',
    esame_esito: 'superato',
    pratica_data: null,
    pratica_esito: '',
    data_rilascio: null,
    luogo_rilascio: '',
    organizzazione: '1° Reggimento AVES',
    note: '',
    ...extra,
  },
});
const salvato = (c: Comando, chi = 'u-tm') => applica(dati, c, ctx(chi)).dati.certificati.find((x) => x.id === 'cert-nuovo')!;

describe('registro dei certificati', () => {
  it('la situazione esempio parte con tre certificati numerati', () => {
    expect(dati.certificati.map((c) => `${c.numero}/${c.anno}`)).toEqual(['1/2026', '2/2026', '3/2026']);
    expect(dati.certificati.filter((c) => c.stato === 'rilasciato')).toHaveLength(2);
    expect(prossimoNumero(dati, 2026)).toBe(4);
    expect(prossimoNumero(dati, 2027)).toBe(1);
  });

  it('numera da sé e rifiuta i numeri già usati', () => {
    expect(salvato(certificato()).numero).toBe(4);
    expect(salvato(certificato({ numero: 7 })).numero).toBe(7);
    expect(() => applica(dati, certificato({ numero: 2 }), ctx('u-tm'))).toThrow(/già nel registro/);
    expect(salvato(certificato({ numero: 2, anno: 2027 })).anno).toBe(2027);
  });

  it('lo tiene solo il Training Manager, e solo per chi è iscritto al corso', () => {
    expect(() => applica(dati, certificato(), ctx('u-neri'))).toThrow(/Training Manager/);
    expect(() => applica(dati, certificato(), ctx('u-costa'))).toThrow(/Training Manager/);
    expect(() => applica(dati, certificato({ user_id: 'u-marchetti' }), ctx('u-tm'))).toThrow(/non iscritto/);
  });

  it('per rilasciare servono data e luogo; la data non può essere futura', () => {
    expect(() => applica(dati, certificato({ stato: 'rilasciato' }), ctx('u-tm'))).toThrow(/Data di rilascio|Luogo/);
    expect(() => applica(dati, certificato({ stato: 'rilasciato', data_rilascio: '2027-01-01', luogo_rilascio: 'Viterbo' }), ctx('u-tm'))).toThrow(/futura/);
    const ok = salvato(certificato({ stato: 'rilasciato', data_rilascio: '2026-09-23', luogo_rilascio: 'Viterbo' }));
    expect([ok.stato, ok.data_rilascio, ok.modificato_da]).toEqual(['rilasciato', '2026-09-23', 'u-tm']);
  });

  it('una bozza si elimina, un certificato rilasciato si annulla e basta', () => {
    expect(applica(dati, { tipo: 'certificato.elimina', id: 'cert-3' }, ctx('u-tm')).dati.certificati).toHaveLength(2);
    expect(() => applica(dati, { tipo: 'certificato.elimina', id: 'cert-1' }, ctx('u-tm'))).toThrow(/annullarlo/);
    expect(() => applica(dati, { tipo: 'certificato.elimina', id: 'cert-3' }, ctx('u-neri'))).toThrow(/Training Manager/);
    const annullato = applica(dati, { tipo: 'certificato.salva', certificato: { ...dati.certificati[0], stato: 'annullato' } }, ctx('u-tm')).dati;
    expect(annullato.certificati.find((c) => c.id === 'cert-1')!.stato).toBe('annullato');
  });
});
