import { Button } from '@mantine/core';
import { IconFileSpreadsheet, IconPrinter } from '@tabler/icons-react';
import { CATALOGO } from '../../dominio/catalogo';
import { formatoPercentuale, type RigaReport, type Totale } from '../../dominio/compliance';
import type { Utente } from '../../dominio/tipi';
import { situazione } from '../../dominio/viste';
import { esportaFrequentatore } from '../../esporta';
import { Esito, IntestazionePagina, Timbro } from '../componenti/disegno';
import { ConFrequentatore } from '../componenti/Frequentatore';
import { useStato } from '../stato';

export function Report() {
  return <ConFrequentatore>{(f) => <ReportDi f={f} />}</ConFrequentatore>;
}

const INTESTAZIONI = ['Number of tasks applicable to the A/C type', 'Number of tasks effectively performed', 'Percentage (%) of tasks effectively performed'];

function Tabella({ colonna, righe, totali, separa, requisito }: { colonna: string; righe: RigaReport[]; totali: [string, Totale][]; separa?: (r: RigaReport, i: number) => boolean; requisito: string }) {
  return (
    <div className="scorre">
      <table className="tabella cr-tabella">
        <thead>
          <tr>
            <th>{colonna}</th>
            {INTESTAZIONI.map((t) => (
              <th key={t}>{t}</th>
            ))}
            <th>Esito ({requisito})</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r, i) => (
            <tr key={r.codice} className={separa?.(r, i) ? 'separa' : undefined}>
              <td>{r.codice}</td>
              <td className="previsti num" style={{ textAlign: 'center' }}>
                {r.previsti}
              </td>
              <td className={`num ${r.eseguiti ? 'si' : ''}`} style={{ textAlign: 'center' }}>
                {r.eseguiti}
              </td>
              <td className="num" style={{ textAlign: 'center' }}>
                {formatoPercentuale(r.percentuale)}
              </td>
              <td>
                <Esito riga={r} />
              </td>
            </tr>
          ))}
          {totali.map(([etichetta, t]) => (
            <tr key={etichetta} className="totale">
              <td>{etichetta}</td>
              <td className="num" style={{ textAlign: 'center' }}>
                {t.previsti}
              </td>
              <td className="num" style={{ textAlign: 'center' }}>
                {t.eseguiti}
              </td>
              <td className="num" style={{ textAlign: 'center' }}>
                {formatoPercentuale(t.percentuale)}
              </td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportDi({ f }: { f: Utente }) {
  const { dati } = useStato();
  if (!dati) return null;
  const s = situazione(dati, f);
  const a = dati.anagrafiche.find((x) => x.user_id === f.id);
  const t = dati.training.find((x) => x.user_id === f.id);
  const r = s.report;
  const moduloDi = new Map(CATALOGO.chapter.map((c) => [c.codice, c.modulo]));

  const testata = (
    <div className="cr-testata cr-blocco">
      <div>
        <span className="etichetta">Organization and DAAA approval number</span>
        <div style={{ fontWeight: 600, marginTop: 2 }}>{t?.maintenance_organization || '—'}</div>
      </div>
      <div>
        <dl>
          <dt>A/C type:</dt>
          <dd>
            <em>{CATALOGO.aeromobile}</em>
          </dd>
          <dt>Type of engine installed:</dt>
          <dd>{CATALOGO.motore}</dd>
          <dt>Category to extend:</dt>
          <dd>{CATALOGO.categoria}</dd>
        </dl>
      </div>
      <div className="cr-titolo">
        Practical Training Record
        <span className="debole" style={{ fontSize: '0.75rem', fontWeight: 500, fontFamily: 'Barlow, sans-serif' }}>
          (Detail of practical experience)
        </span>
      </div>
      <div>
        <dl>
          <dt>Grade:</dt>
          <dd>{a?.grado ?? ''}</dd>
          <dt>First name:</dt>
          <dd>{a?.nome ?? ''}</dd>
          <dt>Surname:</dt>
          <dd>{a?.cognome ?? ''}</dd>
          <dt>MAML:</dt>
          <dd>{a?.maml ?? ''}</dd>
        </dl>
      </div>
    </div>
  );

  return (
    <>
      <IntestazionePagina
        titolo="4. Compliance report"
        sotto={`Aggiornato automaticamente a ogni registrazione · ${s.nome}`}
        azioni={
          <>
            <Button variant="default" leftSection={<IconPrinter size={17} />} onClick={() => window.print()}>
              Stampa / PDF
            </Button>
            <Button variant="default" leftSection={<IconFileSpreadsheet size={17} />} onClick={() => void esportaFrequentatore(dati, f)}>
              Excel
            </Button>
          </>
        }
      />
      {testata}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', margin: '20px 0 4px' }} className="cr-blocco">
        <span className="etichetta">Esito complessivo</span>
        <Timbro conforme={r.conforme} />
        <span className="debole">
          ≥ 50% per ciascun modulo e task type · ≥ 1 task per ciascun chapter
        </span>
      </div>

      <section className="sezione cr-blocco">
        <header>
          <h2 className="titolo-sezione">4.1 Percentage by task type</h2>
          <span className="etichetta">soglia 50%</span>
        </header>
        <Tabella colonna="Type of task" righe={r.perTipo} totali={[['TOTALE', r.totale]]} requisito="≥ 50%" />
      </section>

      <section className="sezione cr-pagina">
        <header>
          <h2 className="titolo-sezione">4.2 Percentage by chapter</h2>
          <span className="etichetta">almeno 1 task per chapter</span>
        </header>
        <p className="debole" style={{ marginTop: 0 }}>
          La percentuale per chapter è riportata a titolo informativo: il requisito è almeno un task eseguito per ciascun chapter.
        </p>
        <Tabella
          colonna="Chapter"
          righe={r.perChapter}
          totali={[
            ['TOTAL task (module AER(EP).P-66)', r.totaleP66],
            ['TOTAL task', r.totale],
          ]}
          separa={(riga, i) => i > 0 && moduloDi.get(riga.codice) !== moduloDi.get(r.perChapter[i - 1].codice)}
          requisito="≥ 1 task"
        />
      </section>

      <section className="sezione cr-pagina">
        <header>
          <h2 className="titolo-sezione">4.3 Percentage by module</h2>
          <span className="etichetta">soglia 50%</span>
        </header>
        <Tabella
          colonna="Module"
          righe={r.perModulo}
          totali={[
            ['TOTALE Chapter AER(EP).P-66', r.totaleP66],
            ['TOTALE', r.totale],
          ]}
          requisito="≥ 50%"
        />
        <div className="cr-blocco" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 48 }}>
          {['Place', 'Date', 'Approval signature'].map((x) => (
            <div key={x} style={{ borderTop: '1px dotted var(--inchiostro)', paddingTop: 4, textAlign: 'center', fontStyle: 'italic' }} className="debole">
              {x}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
