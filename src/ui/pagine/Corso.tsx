import { Button, Tooltip } from '@mantine/core';
import { IconAlertTriangleFilled, IconCircleCheckFilled, IconFileSpreadsheet } from '@tabler/icons-react';
import { CATALOGO } from '../../dominio/catalogo';
import { formatoPercentuale, type RigaReport } from '../../dominio/compliance';
import { formatoData, frequentatori, situazione } from '../../dominio/viste';
import { esportaCorso, esportaCsv } from '../../esporta';
import { Ciambella, IntestazionePagina, Sezione, Timbro } from '../componenti/disegno';
import { Revisioni } from '../componenti/Revisioni';
import { ricordaFrequentatore } from '../navigazione';
import { naviga } from '../router';
import { useStato } from '../stato';

function Celle({ righe, prefisso }: { righe: RigaReport[]; prefisso: string }) {
  return (
    <div className="celle">
      {righe.map((r) => (
        <Tooltip key={r.codice} label={`${prefisso} ${r.codice}: ${r.eseguiti}/${r.previsti} (${formatoPercentuale(r.percentuale)})`}>
          <span className={`cella ${r.conforme ? 'si' : 'no'}`}>
            <b>{r.codice}</b>
            {Math.round(r.percentuale ?? 0)}
          </span>
        </Tooltip>
      ))}
    </div>
  );
}

export function Corso() {
  const { dati } = useStato();
  if (!dati) return null;
  const attivi = frequentatori(dati).map((u) => situazione(dati, u));
  const conformi = attivi.filter((s) => s.report.conforme).length;
  const media = attivi.length ? attivi.reduce((t, s) => t + s.report.totale.percentuale, 0) / attivi.length : 0;
  const ultime = [...dati.registrazioni].sort((a, b) => b.modificato_il.localeCompare(a.modificato_il)).slice(0, 10);
  const apri = (id: string) => {
    ricordaFrequentatore(id);
    naviga(`/tavola?f=${id}`);
  };
  const tipi = (s: (typeof attivi)[number]) => s.report.perTipo.filter((t) => t.previsti);

  return (
    <>
      <IntestazionePagina
        titolo="Situazione del corso"
        sotto={`${CATALOGO.aeromobile} · Cat. ${CATALOGO.categoria} · ${attivi.length} frequentatori attivi`}
        azioni={
          <>
            <Button variant="default" leftSection={<IconFileSpreadsheet size={17} />} onClick={() => void esportaCorso(dati)}>
              Excel complessivo
            </Button>
            <Button variant="default" onClick={() => esportaCsv(dati, dati.registrazioni, 'registrazioni_corso')}>
              CSV
            </Button>
          </>
        }
      />

      <div className="cartiglio riepilogo-corso">
        <div>
          <span className="etichetta">Conformi</span>
          <div className="numero-monumentale" style={{ fontSize: '3.25rem' }}>
            {conformi}
            <small>/{attivi.length}</small>
          </div>
        </div>
        <div className="distribuzione-cella">
          <span className="etichetta">Distribuzione degli esiti</span>
          <div className="distribuzione" role="img" aria-label={`${conformi} conformi, ${attivi.length - conformi} non conformi`}>
            {conformi > 0 && (
              <span className="d-si" style={{ flexGrow: conformi }}>
                <IconCircleCheckFilled size={15} aria-hidden /> {conformi} conformi
              </span>
            )}
            {attivi.length - conformi > 0 && (
              <span className="d-no" style={{ flexGrow: attivi.length - conformi }}>
                <IconAlertTriangleFilled size={15} aria-hidden /> {attivi.length - conformi} non conformi
              </span>
            )}
          </div>
        </div>
        <div>
          <span className="etichetta">Avanzamento medio</span>
          <div className="numero-monumentale" style={{ fontSize: '3.25rem' }}>
            {formatoPercentuale(Math.round(media * 10) / 10).replace('%', '')}
            <small>%</small>
          </div>
        </div>
      </div>

      <Sezione titolo="Distinta dei frequentatori">
        {attivi.length === 0 ? (
          <p className="debole">Nessun frequentatore attivo: crea gli account dalla pagina «Account e corso».</p>
        ) : (
          <>
            <div className="scorre solo-desktop">
              <table className="tabella">
                <thead>
                  <tr>
                    <th>Frequentatore</th>
                    <th className="num">Eseguiti</th>
                    <th>Moduli (% · soglia 50)</th>
                    <th>Task type (%)</th>
                    <th className="num">Ch scoperti</th>
                    <th>Esito</th>
                    <th>Ultima</th>
                  </tr>
                </thead>
                <tbody>
                  {attivi.map((s) => (
                    <tr key={s.utente.id} className="cliccabile" onClick={() => apri(s.utente.id)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Ciambella eseguiti={s.report.totale.eseguiti} previsti={s.report.totale.previsti} dimensione={44} testo={false} />
                          <div>
                            <a href={`#/tavola?f=${s.utente.id}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 600 }}>
                              {s.nome}
                            </a>
                            <div className="debole" style={{ fontSize: '0.8125rem' }}>
                              {s.utente.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="num">
                        {formatoPercentuale(s.report.totale.percentuale)}
                        <div className="debole" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                          {s.report.totale.eseguiti}/{s.report.totale.previsti}
                        </div>
                      </td>
                      <td>
                        <Celle righe={s.report.perModulo} prefisso="Modulo" />
                      </td>
                      <td>
                        <Celle righe={tipi(s)} prefisso="Task type" />
                      </td>
                      <td className={`num ${s.mancanti.chapter.length ? 'rosso' : ''}`}>{s.mancanti.chapter.length}</td>
                      <td>
                        <Timbro conforme={s.report.conforme} piccolo />
                      </td>
                      <td className="cifre" style={{ whiteSpace: 'nowrap' }}>
                        {formatoData(s.ultima?.data)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="elenco-mobile solo-mobile-blocco">
              {attivi.map((s) => (
                <li key={s.utente.id}>
                  <a href={`#/tavola?f=${s.utente.id}`} onClick={() => ricordaFrequentatore(s.utente.id)}>
                    <Ciambella eseguiti={s.report.totale.eseguiti} previsti={s.report.totale.previsti} dimensione={48} testo={false} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <strong>{s.nome}</strong>
                      <span className="debole" style={{ display: 'block', fontSize: '0.8125rem' }}>
                        {s.mancanti.chapter.length ? `${s.mancanti.chapter.length} chapter scoperti` : 'Tutti i chapter coperti'} · {s.mancanti.moduli.length} moduli sotto soglia
                      </span>
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <span className="cifre" style={{ fontWeight: 600, fontSize: '1.125rem', display: 'block' }}>
                        {formatoPercentuale(s.report.totale.percentuale)}
                      </span>
                      <Timbro conforme={s.report.conforme} piccolo />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </Sezione>

      <Sezione titolo="Revisioni · ultime registrazioni del corso">
        {ultime.length === 0 ? (
          <p className="debole">Nessuna registrazione ancora.</p>
        ) : (
          <Revisioni dati={dati} registrazioni={ultime} corso apri={apri} />
        )}
      </Sezione>
    </>
  );
}
