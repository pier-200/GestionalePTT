import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Button, Group, Select, Switch, Text, Tooltip } from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronLeft,
  IconChevronRight,
  IconEraser,
  IconFileSpreadsheet,
  IconLock,
  IconLockOpen,
  IconPlus,
  IconTrash,
  IconWand,
} from '@tabler/icons-react';
import { nuovoUuid } from '../../backend/github/crittografia';
import { esportaSettimana } from '../../esporta';
import { oggiISO, ruoloNelCorso, type CampiLezione } from '../../dominio/motore';
import { NOMI_GIORNI, generaSettimana, giorniSettimana, lunediDi, orarioLezione, sommaGiorni, statoTeorico } from '../../dominio/pianificazione';
import { chapterMateria, materiaDi, oreDaMinuti, programmaTeorico, type Materia } from '../../dominio/programmi';
import type { Lezione } from '../../dominio/tipi';
import { docenti, formatoDataBreve, formatoMinuti, lezioniVisibili, nomeUtente, ore } from '../../dominio/viste';
import { IntestazionePagina, Quota } from '../componenti/disegno';
import { useCampoVisibile } from '../componenti/tastiera';
import { useCorso } from '../navigazione';
import { aggiornaQuery, usePosizione } from '../router';
import { useStato } from '../stato';

/** Durate proponibili: quarti d'ora, da 15 minuti a 6 ore. */
const DURATE = Array.from({ length: 24 }, (_, i) => (i + 1) * 15);

/** Programma settimanale della parte teorica: composizione dei periodi, istruttori, validazione e conto a scalare. */
export function Settimana() {
  const { dati, utente, esegui } = useStato();
  const corso = useCorso();
  const { query } = usePosizione();
  const [bozza, setBozza] = useState<CampiLezione[] | null>(null);
  const [attesa, setAttesa] = useState(false);
  useCampoVisibile(true);

  const programma = programmaTeorico(corso?.programma_teorico);
  const ruolo = dati && utente && corso ? ruoloNelCorso(dati, utente, corso.id) : null;
  const lezioni = useMemo(() => (dati && corso ? lezioniVisibili(dati, corso.id, ruolo) : []), [dati, corso, ruolo]);
  if (!dati || !utente || !corso || !programma) return null;
  const guida = ruolo === 'admin' || ruolo === 'direttore';

  const lunedi = lunediDi(query.get('w') ?? corso.data_inizio ?? oggiISO());
  const giorni = giorniSettimana(lunedi);
  const salvate = lezioni.filter((l) => giorni.includes(l.data));
  const fuori = lezioni.filter((l) => !giorni.includes(l.data));
  const campi = (l: Lezione | CampiLezione): CampiLezione => ({
    id: l.id,
    corso_id: l.corso_id,
    data: l.data,
    ordine: l.ordine,
    minuti: l.minuti,
    materia: l.materia,
    istruttore_id: l.istruttore_id,
    recupero: l.recupero,
    note: l.note,
  });
  const correnti: CampiLezione[] = bozza ?? salvate.map(campi);
  const modificata = bozza != null && JSON.stringify(bozza) !== JSON.stringify(salvate.map(campi));
  const validata = salvate.length > 0 && salvate.every((l) => l.validata);

  /** Lezioni "virtuali" per i calcoli: quelle fuori settimana più la bozza corrente. */
  const perCalcolo = [...fuori, ...correnti.map((l) => ({ ...l, validata: false, validata_da: null, validata_il: null, creato_il: '', modificato_il: '', modificato_da: null }) as Lezione)];
  const stato = statoTeorico(programma, perCalcolo, oggiISO());

  // conto a scalare progressivo: ore residue dopo ogni lezione (i recuperi non scalano il programma)
  const residuoDopo = new Map<string, number>();
  let cumulato = 0;
  for (const l of [...perCalcolo].sort((a, b) => a.data.localeCompare(b.data) || a.ordine - b.ordine)) {
    if (l.recupero) continue;
    cumulato += l.minuti;
    residuoDopo.set(`${l.data}|${l.ordine}`, stato.totale.minuti - cumulato);
  }

  const possibili = docenti(dati, corso.id);
  /** Istruttori proponibili: quelli abilitati alla materia (più quello già assegnato, se diverso). */
  const abilitati = (materia: string, corrente?: string | null) => {
    const ok = possibili.filter((u) => dati.abilitazioni.some((a) => a.user_id === u.id && a.programma === programma.id && a.materia === materia));
    const elenco = ok.length ? ok : possibili;
    const assegnato = corrente ? possibili.find((u) => u.id === corrente) : undefined;
    return assegnato && !elenco.includes(assegnato) ? [...elenco, assegnato] : elenco;
  };
  const carico = () => {
    const m = new Map<string, number>();
    for (const l of perCalcolo) if (l.istruttore_id) m.set(l.istruttore_id, (m.get(l.istruttore_id) ?? 0) + l.minuti);
    return m;
  };
  /** A parità di abilitazione tocca a chi ha meno ore assegnate. */
  const scegliIstruttore = (materia: string, pesi = carico()) => {
    const elenco = abilitati(materia);
    return elenco.length ? [...elenco].sort((a, b) => (pesi.get(a.id) ?? 0) - (pesi.get(b.id) ?? 0))[0].id : null;
  };

  const opzioniMaterie = programma.materie.map((m) => {
    const residuo = stato.materie.find((r) => r.materia.id === m.id)?.residui ?? 0;
    return { value: m.id, label: `M${m.modulo} · ${m.titolo}${residuo ? ` (${oreDaMinuti(residuo)} da programmare)` : ''}` };
  });

  const genera = () => {
    const pesi = carico();
    const proposte = generaSettimana(programma, perCalcolo, lunedi, {
      minutiGiorno: corso.minuti_giorno,
      istruttorePerMateria: (m: Materia) => scegliIstruttore(m.id, pesi),
    });
    if (!proposte.length) return;
    for (const p of proposte) if (p.istruttore_id) pesi.set(p.istruttore_id, (pesi.get(p.istruttore_id) ?? 0) + p.minuti);
    setBozza([
      ...correnti,
      ...proposte.map((p) => ({ id: nuovoUuid(), corso_id: corso.id, data: p.data, ordine: p.ordine, minuti: p.minuti, materia: p.materia, istruttore_id: p.istruttore_id, recupero: false, note: '' })),
    ]);
  };

  /** Aggiunge un singolo periodo in coda alla giornata. */
  const aggiungi = (data: string) => {
    const delGiorno = correnti.filter((l) => l.data === data);
    const materia = stato.prossima?.id ?? programma.materie[0].id;
    setBozza([
      ...correnti,
      {
        id: nuovoUuid(),
        corso_id: corso.id,
        data,
        ordine: delGiorno.length ? Math.max(...delGiorno.map((l) => l.ordine)) + 1 : 0,
        minuti: 60,
        materia,
        istruttore_id: scegliIstruttore(materia),
        recupero: false,
        note: '',
      },
    ]);
  };

  const modifica = (id: string, campiNuovi: Partial<CampiLezione>) => setBozza(correnti.map((x) => (x.id === id ? { ...x, ...campiNuovi } : x)));

  /** Sposta un periodo su o giù nella giornata. */
  const sposta = (l: CampiLezione, delta: number) => {
    const delGiorno = correnti.filter((x) => x.data === l.data).sort((a, b) => a.ordine - b.ordine);
    const i = delGiorno.findIndex((x) => x.id === l.id);
    const altro = delGiorno[i + delta];
    if (!altro) return;
    setBozza(correnti.map((x) => (x.id === l.id ? { ...x, ordine: altro.ordine } : x.id === altro.id ? { ...x, ordine: l.ordine } : x)));
  };

  const salva = async () => {
    setAttesa(true);
    const ordinate = giorni.flatMap((g) =>
      correnti
        .filter((l) => l.data === g)
        .sort((a, b) => a.ordine - b.ordine)
        .map((l, i) => ({ ...campi(l), ordine: i })),
    );
    const ok = await esegui({ tipo: 'lezioni.sostituisci', corso_id: corso.id, giorni, lezioni: ordinate }, 'Programma della settimana salvato');
    setAttesa(false);
    if (ok) setBozza(null);
  };

  const valida = async (valore: boolean) => {
    setAttesa(true);
    await esegui({ tipo: 'settimana.valida', corso_id: corso.id, giorni, valida: valore }, valore ? 'Settimana validata e visibile ai frequentatori' : 'Validazione ritirata');
    setAttesa(false);
  };

  const vaiA = (delta: number) => {
    setBozza(null);
    aggiornaQuery({ w: sommaGiorni(lunedi, delta * 7) });
  };

  return (
    <>
      <IntestazionePagina
        titolo="Programma settimanale"
        sotto={`${corso.nome} · ${programma.nome}`}
        azioni={
          <>
            <Button variant="default" leftSection={<IconFileSpreadsheet size={17} />} onClick={() => void esportaSettimana(dati, corso, lunedi, correnti)} disabled={!correnti.length}>
              Excel
            </Button>
            {guida && (
              <>
                <Button variant="default" leftSection={<IconWand size={17} />} onClick={genera} disabled={stato.totale.residui === 0}>
                  Genera
                </Button>
                <Button variant="default" leftSection={<IconEraser size={17} />} onClick={() => setBozza([])} disabled={!correnti.length}>
                  Svuota
                </Button>
                {validata ? (
                  <Button variant="default" leftSection={<IconLockOpen size={17} />} onClick={() => void valida(false)} loading={attesa}>
                    Ritira
                  </Button>
                ) : (
                  <Button variant="default" leftSection={<IconLock size={17} />} onClick={() => void valida(true)} disabled={!salvate.length || modificata} loading={attesa}>
                    Valida
                  </Button>
                )}
                <Button onClick={() => void salva()} loading={attesa} disabled={!modificata}>
                  Salva
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="settimana-testa">
        <Group gap={6}>
          <ActionIcon variant="default" size="lg" aria-label="Settimana precedente" onClick={() => vaiA(-1)}>
            <IconChevronLeft size={18} />
          </ActionIcon>
          <div className="cifre" style={{ fontWeight: 600, minWidth: 190, textAlign: 'center' }}>
            {formatoDataBreve(giorni[0])} – {formatoDataBreve(giorni[4])}
          </div>
          <ActionIcon variant="default" size="lg" aria-label="Settimana successiva" onClick={() => vaiA(1)}>
            <IconChevronRight size={18} />
          </ActionIcon>
          <Button
            variant="subtle"
            size="compact-sm"
            onClick={() => {
              setBozza(null);
              aggiornaQuery({ w: null });
            }}
          >
            Oggi
          </Button>
          {salvate.length > 0 && (
            <Badge color={validata ? 'inchiostro' : 'rosso'} variant="light">
              {validata ? 'validata' : 'da validare'}
            </Badge>
          )}
        </Group>
        <div className="conto-scalare">
          <span className="etichetta">Conto a scalare</span>
          <div>
            <b className="cifre">{ore(stato.totale.residui)}</b> <span className="debole">da programmare su {ore(stato.totale.minuti)}</span>
          </div>
          <Quota
            nome="Programma"
            riga={{
              codice: 'tot',
              titolo: 'Programma',
              previsti: Math.round(stato.totale.minuti / 60),
              eseguiti: Math.round(stato.totale.pianificati / 60),
              percentuale: (stato.totale.pianificati / stato.totale.minuti) * 100,
              conforme: null,
              mancano: 0,
            }}
          />
        </div>
      </div>

      <div className="settimana">
        {giorni.map((data, i) => {
          const delGiorno = correnti.filter((l) => l.data === data).sort((a, b) => a.ordine - b.ordine);
          const capienza = corso.minuti_giorno[i] ?? 0;
          const usati = delGiorno.filter((l) => !l.recupero).reduce((s, l) => s + l.minuti, 0);
          return (
            <section key={data} className={`giorno ${capienza === 0 ? 'chiuso' : ''}`}>
              <header>
                <span>
                  {NOMI_GIORNI[i]} <span className="cifre debole">{formatoDataBreve(data)}</span>
                </span>
                <span className={`cifre ${usati > capienza ? 'rosso' : 'debole'}`}>
                  {usati / 60}/{capienza / 60} h
                </span>
              </header>
              {delGiorno.length === 0 ? (
                <p className="debole vuoto">{capienza ? 'Nessuna lezione' : 'Giorno non didattico'}</p>
              ) : (
                delGiorno.map((l) => {
                  const materia = materiaDi(programma, l.materia);
                  const orario = orarioLezione(corso, delGiorno, l.ordine);
                  const residuo = residuoDopo.get(`${l.data}|${l.ordine}`);
                  return (
                    <article key={l.id} className={`lezione ${l.recupero ? 'recupero' : ''}`}>
                      <div className="lezione-testa">
                        <span className="cifre">
                          {orario.inizio}–{orario.fine}
                        </span>
                        {guida ? (
                          <Select
                            size="xs"
                            aria-label="Durata"
                            value={String(l.minuti)}
                            onChange={(v) => modifica(l.id, { minuti: Number(v) })}
                            data={DURATE.map((m) => ({ value: String(m), label: formatoMinuti(m) }))}
                            comboboxProps={{ withinPortal: true }}
                            styles={{ input: { width: 86, minHeight: 26, height: 26 } }}
                          />
                        ) : (
                          <span className="cifre debole">{oreDaMinuti(l.minuti)}</span>
                        )}
                        {guida && (
                          <Group gap={0} wrap="nowrap">
                            <ActionIcon variant="subtle" size="sm" aria-label="Sposta su" onClick={() => sposta(l, -1)}>
                              <IconArrowUp size={15} />
                            </ActionIcon>
                            <ActionIcon variant="subtle" size="sm" aria-label="Sposta giù" onClick={() => sposta(l, 1)}>
                              <IconArrowDown size={15} />
                            </ActionIcon>
                            <ActionIcon variant="subtle" size="sm" color="rosso" aria-label="Togli la lezione" onClick={() => setBozza(correnti.filter((x) => x.id !== l.id))}>
                              <IconTrash size={15} />
                            </ActionIcon>
                          </Group>
                        )}
                      </div>
                      {guida ? (
                        <Select
                          size="xs"
                          aria-label="Materia"
                          searchable
                          value={l.materia}
                          onChange={(v) => v && modifica(l.id, { materia: v, istruttore_id: l.istruttore_id ?? scegliIstruttore(v) })}
                          data={opzioniMaterie}
                          comboboxProps={{ withinPortal: true }}
                        />
                      ) : (
                        <div className="lezione-materia">
                          <span className="palloncino piccolo">M{materia?.modulo}</span>
                          <div>
                            <strong>{materia?.titolo ?? l.materia}</strong>
                            <span className="debole" style={{ display: 'block', fontSize: '0.8125rem' }}>
                              {materia ? chapterMateria(materia) : ''}
                            </span>
                          </div>
                        </div>
                      )}
                      {guida ? (
                        <Select
                          size="xs"
                          aria-label="Istruttore"
                          placeholder="Istruttore"
                          value={l.istruttore_id}
                          onChange={(v) => modifica(l.id, { istruttore_id: v })}
                          data={abilitati(l.materia, l.istruttore_id).map((u) => ({ value: u.id, label: nomeUtente(dati, u.id) }))}
                          comboboxProps={{ withinPortal: true }}
                          clearable
                        />
                      ) : (
                        <div className="cifre" style={{ fontWeight: 600 }}>
                          {l.istruttore_id ? nomeUtente(dati, l.istruttore_id) : <span className="rosso">istruttore da assegnare</span>}
                        </div>
                      )}
                      {guida ? (
                        <Switch size="xs" label="Recupero" checked={l.recupero} onChange={(e) => modifica(l.id, { recupero: e.currentTarget.checked })} />
                      ) : (
                        l.recupero && <Badge size="xs" color="inchiostro" variant="light">recupero</Badge>
                      )}
                      {residuo != null && !l.recupero && (
                        <Tooltip label="Ore del programma ancora da svolgere dopo questa lezione">
                          <div className="residuo cifre">restano {ore(residuo)}</div>
                        </Tooltip>
                      )}
                    </article>
                  );
                })
              )}
              {guida && capienza > 0 && (
                <Button variant="subtle" size="compact-sm" leftSection={<IconPlus size={15} />} onClick={() => aggiungi(data)} mt={6}>
                  Periodo
                </Button>
              )}
            </section>
          );
        })}
      </div>

      {modificata && (
        <Text className="debole" mt="md">
          Modifiche non ancora salvate. Dopo il salvataggio la settimana va validata perché i frequentatori possano vederla.
        </Text>
      )}
      {!guida && (
        <Text className="debole" mt="md">
          Il programma è preparato dal Training Manager o dal direttore del corso.
        </Text>
      )}
    </>
  );
}
