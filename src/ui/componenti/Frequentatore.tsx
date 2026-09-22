import type { ReactNode } from 'react';
import { Select } from '@mantine/core';
import { formatoPercentuale } from '../../dominio/compliance';
import type { Corso, Utente } from '../../dominio/tipi';
import { frequentatori, situazione } from '../../dominio/viste';
import { link, ricordaFrequentatore, useCorso, useFrequentatore } from '../navigazione';
import { naviga, usePosizione } from '../router';
import { useStato } from '../stato';
import { Timbro } from './disegno';

/**
 * Per Training Manager, direttore e istruttori: sceglie il frequentatore a cui si riferisce la pagina.
 * Per il frequentatore: mostra direttamente la propria pagina. Fuori dal corso non si vede nulla.
 */
export function ConFrequentatore({ children }: { children: (f: Utente, corso: Corso) => ReactNode }) {
  const { utente, dati } = useStato();
  const { percorso } = usePosizione();
  const corso = useCorso();
  const f = useFrequentatore();
  if (!utente || !dati) return null;
  if (!corso) {
    return (
      <p className="debole">
        Scegli prima il corso dalla pagina <a href="#/corsi">Corsi</a>.
      </p>
    );
  }
  if (utente.ruolo === 'trainee') return <>{children(utente, corso)}</>;

  const elenco = frequentatori(dati, corso.id, true).map((u) => situazione(dati, corso, u));
  const vai = (id: string | null) => {
    if (!id) return;
    ricordaFrequentatore(id);
    naviga(link(percorso, corso, id).slice(1));
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
          nothingFoundMessage="Nessun frequentatore iscritto"
          comboboxProps={{ withinPortal: true }}
          data={elenco.map((s) => ({ value: s.utente.id, label: `${s.nome} · ${formatoPercentuale(s.report.totale.percentuale)}${s.utente.attivo ? '' : ' · disattivato'}` }))}
        />
      </div>
      {f ? (
        children(f, corso)
      ) : elenco.length === 0 ? (
        <p className="debole">Nessun frequentatore iscritto a questo corso.</p>
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
                  <a href={link(percorso, corso, s.utente.id)} onClick={() => ricordaFrequentatore(s.utente.id)}>
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
