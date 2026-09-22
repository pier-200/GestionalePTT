import { CATALOGO } from '../../dominio/catalogo';
import { formatoPercentuale } from '../../dominio/compliance';
import type { Dati, Utente } from '../../dominio/tipi';
import { formatoData, type Situazione } from '../../dominio/viste';
import { Ciambella, Timbro } from './disegno';

/** Cartiglio della tavola: identità del frequentatore, aeromobile, periodo ed esito. */
export function Cartiglio({ dati, utente, s }: { dati: Dati; utente: Utente; s: Situazione }) {
  const a = dati.anagrafiche.find((x) => x.user_id === utente.id);
  const t = dati.training.find((x) => x.user_id === utente.id);
  return (
    <div className="cartiglio">
      <div className="c-nome">
        <span className="etichetta">Frequentatore</span>
        <div className="valore">{s.nome}</div>
      </div>
      <div className="c-numero">
        <Ciambella eseguiti={s.report.totale.eseguiti} previsti={s.report.totale.previsti} dimensione={92} testo={false} />
        <div>
          <span className="etichetta">Task eseguiti</span>
          <div className="numero-monumentale">
            {formatoPercentuale(s.report.totale.percentuale).replace('%', '')}
            <small>%</small>
          </div>
          <div className="cifre debole" style={{ fontWeight: 600, marginTop: 4 }}>
            {s.report.totale.eseguiti} di {s.report.totale.previsti} task
          </div>
          <div style={{ marginTop: 10 }}>
            <Timbro conforme={s.report.conforme} />
          </div>
        </div>
      </div>
      <div className="c-2">
        <span className="etichetta">MAML</span>
        <div className="valore codice">{a?.maml || '—'}</div>
      </div>
      <div className="c-2">
        <span className="etichetta">A/C type</span>
        <div className="valore codice">{CATALOGO.aeromobile}</div>
      </div>
      <div className="c-2">
        <span className="etichetta">Engine · Cat.</span>
        <div className="valore codice">
          {CATALOGO.motore} · {CATALOGO.categoria}
        </div>
      </div>
      <div className="c-2 c-luogo">
        <span className="etichetta">Location</span>
        <div className="valore">{t?.location || '—'}</div>
      </div>
      <div className="c-periodo">
        <span className="etichetta">Periodo</span>
        <div className="valore codice">{t?.data_inizio ? `${formatoData(t.data_inizio)} – ${formatoData(t.data_fine)}` : '—'}</div>
      </div>
    </div>
  );
}
