import { TASK_PER_ID } from '../../dominio/catalogo';
import type { Dati, Registrazione } from '../../dominio/tipi';
import { esecuzione, formatoData, formatoIstante, nomeIstruttore, nomeUtente } from '../../dominio/viste';

/** Blocco revisioni: ultime registrazioni salvate. Tabella su schermi larghi, voci impilate sul telefono. */
export function Revisioni({ dati, registrazioni, corso, apri }: { dati: Dati; registrazioni: Registrazione[]; corso?: boolean; apri?: (userId: string) => void }) {
  const istruttore = (r: Registrazione) => nomeIstruttore(dati.istruttori.find((i) => i.id === r.instructor_id));
  return (
    <>
      <div className="solo-largo scorre">
        <table className="tabella">
          <thead>
            <tr>
              <th>Data</th>
              {corso && <th>Frequentatore</th>}
              <th>Task</th>
              <th>A/C</th>
              <th>Instructor</th>
              <th>Salvato</th>
            </tr>
          </thead>
          <tbody>
            {registrazioni.map((r) => {
              const t = TASK_PER_ID.get(r.task_id)!;
              return (
                <tr key={r.id} className={apri ? 'cliccabile' : undefined} onClick={apri ? () => apri(r.user_id) : undefined}>
                  <td className="cifre" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {formatoData(r.data)}
                  </td>
                  {corso && <td style={{ fontWeight: 600, minWidth: 150 }}>{nomeUtente(dati, r.user_id)}</td>}
                  <td style={{ minWidth: 220 }}>
                    <span className="cifre" style={{ fontWeight: 600 }}>
                      {t.id} · Ch {t.chapter} · {t.tipo}
                    </span>
                    <div className="debole" style={{ fontSize: '0.875rem', lineHeight: 1.35 }}>
                      {t.descrizione}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{esecuzione(r)}</td>
                  <td style={{ minWidth: 140 }}>{istruttore(r)}</td>
                  <td className="debole" style={{ fontSize: '0.8125rem', minWidth: 120 }}>
                    {formatoIstante(r.modificato_il)}
                    {(!corso || r.modificato_da !== r.user_id) && <div>{nomeUtente(dati, r.modificato_da)}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="revisioni-voci solo-stretto">
        {registrazioni.map((r) => {
          const t = TASK_PER_ID.get(r.task_id)!;
          const contenuto = (
            <>
              <div className="rv-testa">
                <span>
                  {t.id} · Ch {t.chapter} · {t.tipo}
                </span>
                <span className="cifre">{formatoData(r.data)}</span>
              </div>
              {corso && <div style={{ fontWeight: 600 }}>{nomeUtente(dati, r.user_id)}</div>}
              <p className="rv-desc">{t.descrizione}</p>
              <div className="rv-piede">
                {esecuzione(r)} · {istruttore(r)}
                <br />
                Salvato {formatoIstante(r.modificato_il)}
                {r.modificato_da !== r.user_id ? ` da ${nomeUtente(dati, r.modificato_da)}` : ''}
              </div>
            </>
          );
          return (
            <li key={r.id}>
              {apri ? (
                <a href={`#/tavola?f=${r.user_id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  {contenuto}
                </a>
              ) : (
                contenuto
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
