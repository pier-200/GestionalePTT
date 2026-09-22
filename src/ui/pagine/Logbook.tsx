import { useMemo, useState } from 'react';
import { Button, CloseButton, Group, TextInput } from '@mantine/core';
import { IconFileSpreadsheet, IconPencil, IconPlus, IconSearch, IconTrash, IconX } from '@tabler/icons-react';
import { CATALOGO, TASK, type Task } from '../../dominio/catalogo';
import { formatoPercentuale } from '../../dominio/compliance';
import type { Registrazione, Utente } from '../../dominio/tipi';
import { esecuzione, formatoData, formatoIstante, formatoMinuti, nomeIstruttore, nomeUtente, situazione } from '../../dominio/viste';
import { esportaCsv, esportaFrequentatore } from '../../esporta';
import { IntestazionePagina, Palloncino } from '../componenti/disegno';
import { ConFrequentatore } from '../componenti/Frequentatore';
import { ModuloRegistrazione } from '../componenti/ModuloRegistrazione';
import { aggiornaQuery, usePosizione } from '../router';
import { useStato } from '../stato';

export function Logbook() {
  return <ConFrequentatore>{(f) => <LogbookDi f={f} />}</ConFrequentatore>;
}

const normalizza = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function LogbookDi({ f }: { f: Utente }) {
  const { dati, utente, appena, esegui } = useStato();
  const { query } = usePosizione();
  const [aperto, setAperto] = useState<number | null>(null);
  const [modulo, setModulo] = useState<{ taskId: number | null; modifica: Registrazione | null } | null>(null);
  const [daEliminare, setDaEliminare] = useState<string | null>(null);
  const [cerca, setCerca] = useState(query.get('q') ?? '');

  const mod = query.get('mod');
  const tipo = query.get('tipo');
  const ch = query.get('ch');
  const stato = query.get('stato') ?? 'tutti';
  const s = useMemo(() => (dati ? situazione(dati, f) : null), [dati, f]);
  if (!dati || !utente || !s) return null;
  const puoScrivere = utente.ruolo === 'admin' || utente.id === f.id;
  const perTask = new Map<number, Registrazione[]>();
  for (const r of s.registrazioni) perTask.set(r.task_id, [...(perTask.get(r.task_id) ?? []), r]);

  const testo = normalizza(cerca.trim());
  const visibili = TASK.filter(
    (t) =>
      (!mod || String(t.modulo) === mod) &&
      (!tipo || t.tipo === tipo) &&
      (!ch || t.chapter === ch) &&
      (stato === 'tutti' || (stato === 'eseguiti') === perTask.has(t.id)) &&
      (!testo || normalizza(`${t.id} ${t.chapter} ${t.subject} ${t.descrizione} ${t.riferimenti} ${t.tipo}`).includes(testo)),
  );
  const moduli = CATALOGO.moduli.map((m) => ({
    numero: m.numero,
    chapter: CATALOGO.chapter.filter((c) => c.modulo === m.numero).map((c) => ({ ...c, task: visibili.filter((t) => t.chapter === c.codice) })).filter((c) => c.task.length),
  })).filter((m) => m.chapter.length);
  const filtrato = Boolean(mod || tipo || ch || stato !== 'tutti' || testo);
  const tipi = CATALOGO.taskType.filter((t) => TASK.some((x) => x.tipo === t.codice));

  const chip = (chiave: string, valore: string | null, etichetta: string, attivo: boolean) => (
    <button key={`${chiave}${valore}`} type="button" className="chip" aria-pressed={attivo} onClick={() => aggiornaQuery({ [chiave]: valore })}>
      {etichetta}
    </button>
  );

  const riga = (t: Task) => {
    const regs = perTask.get(t.id) ?? [];
    const eAperto = aperto === t.id;
    return (
      <div key={t.id} className={`task ${regs.length ? 'eseguito' : ''} ${appena.includes(t.id) ? 'appena' : ''} ${eAperto ? 'aperto' : ''}`}>
        <button type="button" className="task-riga" aria-expanded={eAperto} onClick={() => setAperto(eAperto ? null : t.id)}>
          <span className="task-id">{t.id}</span>
          <span className="task-tipo">{t.tipo}</span>
          <span className="task-descrizione">
            <span>{t.descrizione}</span>
          </span>
          <span className="task-conteggio" aria-label={regs.length ? `${regs.length} registrazioni` : 'non eseguito'}>
            {regs.length ? `×${regs.length}` : ''}
          </span>
        </button>
        {eAperto && (
          <div className="task-dettaglio">
            <div className="riferimenti">
              {t.subject} · {t.riferimenti}
            </div>
            {regs.map((r) => (
              <div key={r.id} className="registrazione">
                <dl>
                  <div>
                    <dt>Data</dt>
                    <dd className="cifre">{formatoData(r.data)}</dd>
                  </div>
                  <div>
                    <dt>A/C</dt>
                    <dd>{esecuzione(r)}</dd>
                  </div>
                  <div>
                    <dt>ET</dt>
                    <dd className="cifre">{formatoMinuti(r.et_minuti)}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{r.maintenance_location}</dd>
                  </div>
                  <div>
                    <dt>Instructor</dt>
                    <dd>{nomeIstruttore(dati.istruttori.find((i) => i.id === r.instructor_id))}</dd>
                  </div>
                  <div>
                    <dt>Ultima modifica</dt>
                    <dd className="debole" style={{ fontWeight: 400, fontSize: '0.875rem' }}>
                      {formatoIstante(r.modificato_il)} · {nomeUtente(dati, r.modificato_da)}
                    </dd>
                  </div>
                </dl>
                {puoScrivere && (
                  <Group gap={4} align="flex-start" wrap="nowrap">
                    {daEliminare === r.id ? (
                      <Button
                        size="compact-sm"
                        color="rosso"
                        onClick={async () => {
                          await esegui({ tipo: 'registrazione.elimina', id: r.id }, 'Registrazione eliminata');
                          setDaEliminare(null);
                        }}
                      >
                        Conferma
                      </Button>
                    ) : (
                      <>
                        <Button size="compact-sm" variant="subtle" aria-label="Modifica registrazione" onClick={() => setModulo({ taskId: t.id, modifica: r })}>
                          <IconPencil size={17} />
                        </Button>
                        <Button size="compact-sm" variant="subtle" color="rosso" aria-label="Elimina registrazione" onClick={() => setDaEliminare(r.id)}>
                          <IconTrash size={17} />
                        </Button>
                      </>
                    )}
                  </Group>
                )}
              </div>
            ))}
            {!regs.length && <p className="debole" style={{ margin: '8px 0 0' }}>Nessuna registrazione per questo task.</p>}
            {puoScrivere && (
              <Button mt="sm" variant={regs.length ? 'default' : 'filled'} leftSection={<IconPlus size={17} />} onClick={() => setModulo({ taskId: t.id, modifica: null })}>
                {regs.length ? 'Aggiungi un’altra registrazione' : 'Registra questo task'}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <IntestazionePagina
        titolo="Logbook"
        sotto={`${s.report.totale.eseguiti} task eseguiti su ${s.report.totale.previsti} · ${s.registrazioni.length} registrazioni`}
        azioni={
          <>
            {puoScrivere && (
              <Button className="solo-desktop-inline" leftSection={<IconPlus size={17} />} onClick={() => setModulo({ taskId: null, modifica: null })}>
                Registra task
              </Button>
            )}
            <Button variant="default" leftSection={<IconFileSpreadsheet size={17} />} onClick={() => void esportaFrequentatore(dati, f)}>
              Excel
            </Button>
            <Button variant="default" onClick={() => esportaCsv(dati, s.registrazioni, `logbook_${s.nome}`)}>
              CSV
            </Button>
          </>
        }
      />

      <div className="filtri non-stampare">
        <TextInput
          placeholder="Cerca task, chapter, riferimento AMM…"
          leftSection={<IconSearch size={17} />}
          value={cerca}
          onChange={(e) => setCerca(e.currentTarget.value)}
          rightSection={cerca ? <CloseButton size="sm" aria-label="Cancella ricerca" onClick={() => setCerca('')} /> : null}
          aria-label="Cerca nel logbook"
        />
        <div className="chips" role="group" aria-label="Stato">
          {chip('stato', null, 'Tutti', stato === 'tutti')}
          {chip('stato', 'da-fare', `Da fare · ${s.report.totale.previsti - s.report.totale.eseguiti}`, stato === 'da-fare')}
          {chip('stato', 'eseguiti', `Eseguiti · ${s.report.totale.eseguiti}`, stato === 'eseguiti')}
          <span style={{ width: 8, flex: 'none' }} />
          {tipi.map((t) => chip('tipo', tipo === t.codice ? null : t.codice, t.codice, tipo === t.codice))}
        </div>
        <div className="chips" role="group" aria-label="Modulo">
          {chip('mod', null, 'Tutti i moduli', !mod)}
          {CATALOGO.moduli.map((m) => chip('mod', mod === String(m.numero) ? null : String(m.numero), `Mod. ${m.numero}`, mod === String(m.numero)))}
          {ch && (
            <button type="button" className="chip" aria-pressed onClick={() => aggiornaQuery({ ch: null })}>
              Ch {ch} <IconX size={14} aria-label="rimuovi filtro" />
            </button>
          )}
        </div>
      </div>

      {moduli.length === 0 ? (
        <div style={{ padding: '32px 0' }}>
          <p style={{ margin: 0 }}>Nessun task corrisponde ai filtri.</p>
          <Button
            mt="sm"
            variant="default"
            onClick={() => {
              setCerca('');
              aggiornaQuery({ mod: null, tipo: null, ch: null, stato: null });
            }}
          >
            Mostra tutti i task
          </Button>
        </div>
      ) : (
        moduli.map((m) => {
          const rm = s.report.perModulo.find((x) => x.codice === String(m.numero))!;
          return (
            <section key={m.numero} className="modulo">
              <div className="modulo-testa">
                <h2 className="titolo-sezione">Modulo {m.numero}</h2>
                <span className={`cifre ${rm.conforme ? '' : 'rosso'}`} style={{ fontWeight: 600 }}>
                  {rm.eseguiti}/{rm.previsti} · {formatoPercentuale(rm.percentuale)}
                </span>
              </div>
              {m.chapter.map((c) => {
                const rc = s.report.perChapter.find((x) => x.codice === c.codice)!;
                return (
                  <div key={c.codice} className="chapter">
                    <div className="chapter-testa">
                      <Palloncino codice={c.codice} stato={rc.eseguiti ? 'fatto' : 'manca'} />
                      <span className="titolo-chapter">{c.titolo}</span>
                      <span className="cifre debole" style={{ fontWeight: 600 }}>
                        {rc.eseguiti}/{rc.previsti}
                      </span>
                    </div>
                    <div className={`distinta ${aperto != null && c.task.some((t) => t.id === aperto) ? 'con-aperto' : ''}`}>{c.task.map(riga)}</div>
                  </div>
                );
              })}
            </section>
          );
        })
      )}
      {filtrato && moduli.length > 0 && <p className="debole" style={{ marginTop: 24 }}>{visibili.length} task mostrati su {TASK.length}.</p>}

      {puoScrivere && (
        <>
          <div className="azione-fissa solo-mobile-fisso non-stampare">
            <Button size="lg" fullWidth leftSection={<IconPlus size={20} />} onClick={() => setModulo({ taskId: null, modifica: null })} style={{ maxWidth: 420 }}>
              Registra task
            </Button>
          </div>
          <ModuloRegistrazione aperto={modulo != null} chiudi={() => setModulo(null)} frequentatore={f} taskId={modulo?.taskId} modifica={modulo?.modifica} />
        </>
      )}
    </>
  );
}
