import { useMemo, useState } from 'react';
import { ActionIcon, Button, Group, Select, Text, Tooltip } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconEraser, IconTrash, IconWand } from '@tabler/icons-react';
import { nuovoUuid } from '../../backend/github/crittografia';
import { ruoloNelCorso, type CampiLezione } from '../../dominio/motore';
import { NOMI_GIORNI, generaSettimana, giorniSettimana, lunediDi, orarioLezione, sommaGiorni, statoTeorico } from '../../dominio/pianificazione';
import { chapterMateria, materiaDi, oreDaMinuti, programmaTeorico, type Materia } from '../../dominio/programmi';
import type { Lezione } from '../../dominio/tipi';
import { docenti, formatoDataBreve, lezioniDi, nomeUtente, ore } from '../../dominio/viste';
import { IntestazionePagina, Quota } from '../componenti/disegno';
import { useCorso } from '../navigazione';
import { aggiornaQuery, usePosizione } from '../router';
import { useStato } from '../stato';
import { oggiISO } from '../../dominio/motore';

/** Programma settimanale della parte teorica: generazione, istruttori e conto a scalare. */
export function Settimana() {
  const { dati, utente, esegui } = useStato();
  const corso = useCorso();
  const { query } = usePosizione();
  const [bozza, setBozza] = useState<CampiLezione[] | null>(null);
  const [attesa, setAttesa] = useState(false);

  const programma = programmaTeorico(corso?.programma_teorico);
  const lezioni = useMemo(() => (dati && corso ? lezioniDi(dati, corso.id) : []), [dati, corso]);
  if (!dati || !utente || !corso || !programma) return null;
  const ruolo = ruoloNelCorso(dati, utente, corso.id);
  const guida = ruolo === 'admin' || ruolo === 'direttore';

  const lunedi = lunediDi(query.get('w') ?? corso.data_inizio ?? oggiISO());
  const giorni = giorniSettimana(lunedi);
  const salvate = lezioni.filter((l) => giorni.includes(l.data));
  const fuori = lezioni.filter((l) => !giorni.includes(l.data));
  const correnti: CampiLezione[] = bozza ?? salvate.map((l) => ({ ...l }));
  const modificata = bozza != null && JSON.stringify(bozza) !== JSON.stringify(salvate.map((l) => ({ ...l })));

  /** Lezioni "virtuali" per i calcoli: quelle fuori settimana più la bozza corrente. */
  const perCalcolo = [...fuori, ...correnti.map((l) => ({ ...l, creato_il: '', modificato_il: '', modificato_da: null }) as Lezione)];
  const stato = statoTeorico(programma, perCalcolo, oggiISO());

  // conto a scalare progressivo: ore residue dopo ogni lezione
  const residuoDopo = new Map<string, number>();
  let cumulato = 0;
  for (const l of [...perCalcolo].sort((a, b) => a.data.localeCompare(b.data) || a.ordine - b.ordine)) {
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

  const genera = () => {
    const carico = new Map<string, number>();
    for (const l of perCalcolo) if (l.istruttore_id) carico.set(l.istruttore_id, (carico.get(l.istruttore_id) ?? 0) + l.minuti);
    const scegliIstruttore = (m: Materia) => {
      const elenco = abilitati(m.id);
      if (!elenco.length) return null;
      // a parità di abilitazione tocca a chi ha meno ore assegnate
      return [...elenco].sort((a, b) => (carico.get(a.id) ?? 0) - (carico.get(b.id) ?? 0))[0].id;
    };
    const proposte = generaSettimana(programma, perCalcolo, lunedi, { minutiGiorno: corso.minuti_giorno, istruttorePerMateria: scegliIstruttore });
    if (!proposte.length) return;
    for (const p of proposte) if (p.istruttore_id) carico.set(p.istruttore_id, (carico.get(p.istruttore_id) ?? 0) + p.minuti);
    setBozza([...correnti, ...proposte.map((p) => ({ id: nuovoUuid(), corso_id: corso.id, data: p.data, ordine: p.ordine, minuti: p.minuti, materia: p.materia, istruttore_id: p.istruttore_id, note: '' }))]);
  };

  const salva = async () => {
    setAttesa(true);
    const ordinate = giorni.flatMap((g) =>
      correnti
        .filter((l) => l.data === g)
        .sort((a, b) => a.ordine - b.ordine)
        .map((l, i) => ({ ...l, ordine: i })),
    );
    const ok = await esegui({ tipo: 'lezioni.sostituisci', corso_id: corso.id, giorni, lezioni: ordinate }, 'Programma della settimana salvato');
    setAttesa(false);
    if (ok) setBozza(null);
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
          guida ? (
            <>
              <Button variant="default" leftSection={<IconWand size={17} />} onClick={genera} disabled={stato.totale.residui === 0}>
                Genera
              </Button>
              <Button variant="default" leftSection={<IconEraser size={17} />} onClick={() => setBozza([])} disabled={!correnti.length}>
                Svuota
              </Button>
              <Button onClick={() => void salva()} loading={attesa} disabled={!modificata}>
                Salva
              </Button>
            </>
          ) : undefined
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
          <Button variant="subtle" size="compact-sm" onClick={() => { setBozza(null); aggiornaQuery({ w: null }); }}>
            Oggi
          </Button>
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
          const usati = delGiorno.reduce((s, l) => s + l.minuti, 0);
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
                    <article key={l.id} className="lezione">
                      <div className="lezione-testa">
                        <span className="cifre">
                          {orario.inizio}–{orario.fine}
                        </span>
                        <span className="cifre debole">{oreDaMinuti(l.minuti)}</span>
                        {guida && (
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            color="rosso"
                            aria-label="Togli la lezione"
                            onClick={() => setBozza(correnti.filter((x) => x.id !== l.id))}
                          >
                            <IconTrash size={15} />
                          </ActionIcon>
                        )}
                      </div>
                      <div className="lezione-materia">
                        <span className="palloncino piccolo">M{materia?.modulo}</span>
                        <div>
                          <strong>{materia?.titolo ?? l.materia}</strong>
                          <span className="debole" style={{ display: 'block', fontSize: '0.8125rem' }}>
                            {materia ? chapterMateria(materia) : ''}
                          </span>
                        </div>
                      </div>
                      {guida ? (
                        <Select
                          size="xs"
                          aria-label="Istruttore"
                          placeholder="Istruttore"
                          value={l.istruttore_id}
                          onChange={(v) => setBozza(correnti.map((x) => (x.id === l.id ? { ...x, istruttore_id: v } : x)))}
                          data={abilitati(l.materia, l.istruttore_id).map((u) => ({ value: u.id, label: nomeUtente(dati, u.id) }))}
                          comboboxProps={{ withinPortal: true }}
                          clearable
                        />
                      ) : (
                        <div className="cifre" style={{ fontWeight: 600 }}>
                          {l.istruttore_id ? nomeUtente(dati, l.istruttore_id) : <span className="rosso">istruttore da assegnare</span>}
                        </div>
                      )}
                      {residuo != null && (
                        <Tooltip label="Ore del programma ancora da svolgere dopo questa lezione">
                          <div className="residuo cifre">restano {ore(residuo)}</div>
                        </Tooltip>
                      )}
                    </article>
                  );
                })
              )}
            </section>
          );
        })}
      </div>

      {modificata && (
        <Text className="debole" mt="md">
          Modifiche non ancora salvate.
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
