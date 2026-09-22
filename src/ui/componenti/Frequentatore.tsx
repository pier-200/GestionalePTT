import type { ReactNode } from 'react';
import { Select } from '@mantine/core';
import { formatoPercentuale } from '../../dominio/compliance';
import type { Utente } from '../../dominio/tipi';
import { frequentatori, situazione } from '../../dominio/viste';
import { linkFrequentatore, ricordaFrequentatore, useFrequentatore } from '../navigazione';
import { naviga, usePosizione } from '../router';
import { useStato } from '../stato';
import { Timbro } from './disegno';

/**
 * Per TM e istruttori: sceglie il frequentatore a cui si riferisce la pagina.
 * Per il frequentatore: mostra direttamente la sua pagina.
 */
export function ConFrequentatore({ children }: { children: (f: Utente) => ReactNode }) {
  const { utente, dati } = useStato();
  const { percorso } = usePosizione();
  const f = useFrequentatore();
  if (!utente || !dati) return null;
  if (utente.ruolo === 'trainee') return <>{children(utente)}</>;
  const elenco = frequentatori(dati, true).map((u) => situazione(dati, u));
  const vai = (id: string | null) => {
    if (!id) return;
    ricordaFrequentatore(id);
    naviga(linkFrequentatore(percorso, utente, id).slice(1));
  };
  return (
    <>
      <div className="non-stampare" style={{ marginBottom: 18, maxWidth: 520 }}>
        <Select
          label="Frequentatore"
          placeholder="Scegli il frequentatore"
          value={f?.id ?? null}
          onChange={vai}
          searchable
          allowDeselect={false}
          nothingFoundMessage="Nessun frequentatore"
          data={elenco.map((s) => ({ value: s.utente.id, label: `${s.nome} · ${formatoPercentuale(s.report.totale.percentuale)}${s.utente.attivo ? '' : ' · disattivato'}` }))}
        />
      </div>
      {f ? (
        children(f)
      ) : (
        <table className="tabella">
          <thead>
            <tr>
              <th>Frequentatore</th>
              <th className="num">Eseguiti</th>
              <th>Esito</th>
            </tr>
          </thead>
          <tbody>
            {elenco.map((s) => (
              <tr key={s.utente.id} className="cliccabile" onClick={() => vai(s.utente.id)}>
                <td>
                  <a href={linkFrequentatore(percorso, utente, s.utente.id)} onClick={() => ricordaFrequentatore(s.utente.id)}>
                    {s.nome}
                  </a>
                </td>
                <td className="num">{formatoPercentuale(s.report.totale.percentuale)}</td>
                <td>
                  <Timbro conforme={s.report.conforme} piccolo />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
