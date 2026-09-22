import type { Corso, Utente } from '../../dominio/tipi';
import { formatoData, formatoMinuti, istruttoriDi, registrazioniDi } from '../../dominio/viste';
import { IntestazionePagina } from '../componenti/disegno';
import { ConFrequentatore } from '../componenti/Frequentatore';
import { useStato } from '../stato';

export function Istruttori() {
  return <ConFrequentatore>{(f, corso) => <IstruttoriDi f={f} corso={corso} />}</ConFrequentatore>;
}

/** Practical Instructors: si compila da sé con gli istruttori indicati nelle registrazioni. */
function IstruttoriDi({ f, corso }: { f: Utente; corso: Corso }) {
  const { dati, utente } = useStato();
  if (!dati || !utente) return null;
  const righe = istruttoriDi(dati, registrazioniDi(dati, corso.id, f.id));
  const mio = utente.ruolo === 'instructor' ? utente.istruttore_id : null;
  return (
    <>
      <IntestazionePagina titolo="Practical instructor(s)" sotto="Elenco compilato automaticamente dalle registrazioni del logbook." />
      {righe.length === 0 ? (
        <p className="debole">Ancora nessun istruttore: comparirà qui dopo la prima registrazione di un task.</p>
      ) : (
        <div className="scorre">
          <table className="tabella">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Surname</th>
                <th className="num">Task</th>
                <th className="num">Registr.</th>
                <th className="num">ET totale</th>
                <th>Periodo</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.istruttore.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.istruttore.grado}</td>
                  <td>{r.istruttore.nome}</td>
                  <td style={{ fontWeight: 600 }}>
                    {mio === r.istruttore.id ? <span className="evidenziato">{r.istruttore.cognome}</span> : r.istruttore.cognome}
                  </td>
                  <td className="num">{r.task}</td>
                  <td className="num">{r.registrazioni}</td>
                  <td className="num">{formatoMinuti(r.minuti)}</td>
                  <td className="cifre" style={{ whiteSpace: 'nowrap' }}>
                    {formatoData(r.prima)} – {formatoData(r.ultima)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mio && righe.some((r) => r.istruttore.id === mio) && <p className="debole" style={{ marginTop: 12 }}>Evidenziato: il tuo nominativo.</p>}
    </>
  );
}
