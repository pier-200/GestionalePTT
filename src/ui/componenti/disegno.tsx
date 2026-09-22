import type { ReactNode } from 'react';
import { IconAlertTriangleFilled, IconCircleCheckFilled } from '@tabler/icons-react';
import { formatoPercentuale, type RigaReport } from '../../dominio/compliance';

/** Elementi del mondo "tavola tecnica": foglio, timbro, linee di quota, palloncini, ciambella. */

const ZONE_X = ['1', '2', '3', '4', '5', '6', '7', '8'];
const ZONE_Y = ['A', 'B', 'C', 'D', 'E', 'F'];

export function Foglio({ children }: { children: ReactNode }) {
  return (
    <div className="foglio">
      <div className="zone zone-alto" aria-hidden>
        {ZONE_X.map((z) => (
          <span key={z}>{z}</span>
        ))}
      </div>
      <div className="zone zone-basso" aria-hidden>
        {ZONE_X.map((z) => (
          <span key={z}>{z}</span>
        ))}
      </div>
      <div className="zone zone-sx" aria-hidden>
        {ZONE_Y.map((z) => (
          <span key={z}>{z}</span>
        ))}
      </div>
      <div className="zone zone-dx" aria-hidden>
        {ZONE_Y.map((z) => (
          <span key={z}>{z}</span>
        ))}
      </div>
      {children}
    </div>
  );
}

export function Timbro({ conforme, piccolo }: { conforme: boolean; piccolo?: boolean }) {
  return (
    <span className={`timbro ${conforme ? 'si' : 'no'} ${piccolo ? 'piccolo' : ''}`}>
      {conforme ? <IconCircleCheckFilled size={piccolo ? 13 : 17} aria-hidden /> : <IconAlertTriangleFilled size={piccolo ? 13 : 17} aria-hidden />}
      {conforme ? 'Conforme' : 'Non conforme'}
    </span>
  );
}

/** Esito di una riga del report: icona + testo, mai solo colore. */
export function Esito({ riga }: { riga: RigaReport }) {
  if (riga.conforme == null) return <span className="debole">n.a.</span>;
  return riga.conforme ? (
    <span className="esito-cella">
      <IconCircleCheckFilled size={16} aria-hidden /> OK
    </span>
  ) : (
    <span className="esito-cella rosso">
      <IconAlertTriangleFilled size={16} aria-hidden /> {riga.mancano === 1 ? 'manca 1' : `mancano ${riga.mancano}`}
    </span>
  );
}

export function Palloncino({ codice, stato }: { codice: string; stato?: 'fatto' | 'manca' }) {
  return <span className={`palloncino ${stato ?? ''}`}>{codice}</span>;
}

interface PropsQuota {
  nome: ReactNode;
  sotto?: ReactNode;
  riga: RigaReport;
  href?: string;
}

/**
 * Linea di quota: la parte eseguita è evidenziata in giallo fino al tratto d'inchiostro,
 * il datum tratteggiato segna il 50% e l'eventuale tratto rosso misura ciò che manca.
 */
export function Quota({ nome, sotto, riga, href }: PropsQuota) {
  const p = riga.previsti ? (riga.eseguiti / riga.previsti) * 100 : 0;
  const manca = riga.conforme === false ? 50 - p : 0;
  const contenuto = (
    <>
      <span className="quota-nome">
        {nome}
        {sotto && <small>{sotto}</small>}
      </span>
      <span className="quota-linea" role="img" aria-label={`${riga.eseguiti} su ${riga.previsti}, ${formatoPercentuale(riga.percentuale)}; soglia 50%`}>
        <span className={`quota-fatto ${p ? '' : 'zero'}`} style={{ width: `${p}%` }} />
        {manca > 0 && <span className="quota-manca" style={{ left: `${p}%`, width: `${manca}%` }} />}
        <span className="quota-datum" />
      </span>
      <span className="quota-valore">
        {formatoPercentuale(riga.percentuale)}
        <small className={riga.conforme === false ? 'rosso' : undefined}>
          {riga.eseguiti}/{riga.previsti}
          {riga.conforme === false ? ` · −${riga.mancano}` : ''}
        </small>
      </span>
    </>
  );
  return href ? (
    <a className="quota" href={href}>
      {contenuto}
    </a>
  ) : (
    <div className="quota">{contenuto}</div>
  );
}

export function ScalaQuote() {
  return (
    <div className="quote-scala" aria-hidden>
      <div />
      <div>
        <span style={{ left: 0, transform: 'none' }}>0</span>
        <span style={{ left: '50%' }}>50% soglia</span>
        <span style={{ right: 0, transform: 'none' }}>100</span>
      </div>
      <div />
    </div>
  );
}

/** Ciambella dell'avanzamento: arco giallo con filo d'inchiostro, su traccia sottile. */
export function Ciambella({ eseguiti, previsti, dimensione = 112, testo = true }: { eseguiti: number; previsti: number; dimensione?: number; testo?: boolean }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const f = previsti ? eseguiti / previsti : 0;
  return (
    <svg className="ciambella" width={dimensione} height={dimensione} viewBox="0 0 100 100" role="img" aria-label={`${eseguiti} task eseguiti su ${previsti}`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--filetto-chiaro)" strokeWidth="12" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--evidenzia)" strokeWidth="12" strokeDasharray={`${f * c} ${c}`} transform="rotate(-90 50 50)" />
      <circle cx="50" cy="50" r={r + 6} fill="none" stroke="var(--inchiostro)" strokeWidth="1" />
      <circle cx="50" cy="50" r={r - 6} fill="none" stroke="var(--inchiostro)" strokeWidth="1" />
      {f > 0 && f < 1 && (
        <line x1="50" y1={50 - r - 6} x2="50" y2={50 - r + 6} stroke="var(--inchiostro)" strokeWidth="2" transform={`rotate(${f * 360} 50 50)`} />
      )}
      <line x1="50" y1={50 - r - 9} x2="50" y2={50 - r + 9} stroke="var(--inchiostro)" strokeWidth="1" />
      {testo && (
        <text x="50" y="56" textAnchor="middle" fontSize="19" fontWeight="600" fill="var(--inchiostro)">
          {eseguiti}
          <tspan fontSize="11" fill="var(--inchiostro-2)">/{previsti}</tspan>
        </text>
      )}
    </svg>
  );
}

export function Sezione({ titolo, azioni, children, id }: { titolo: ReactNode; azioni?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="sezione" id={id}>
      <header>
        <h2 className="titolo-sezione">{titolo}</h2>
        {azioni}
      </header>
      {children}
    </section>
  );
}

export function IntestazionePagina({ titolo, sotto, azioni }: { titolo: ReactNode; sotto?: ReactNode; azioni?: ReactNode }) {
  return (
    <div className="intestazione-pagina">
      <div>
        <h1 className="titolo-pagina">{titolo}</h1>
        {sotto && <div className="debole" style={{ marginTop: 4 }}>{sotto}</div>}
      </div>
      {azioni && <div className="non-stampare" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{azioni}</div>}
    </div>
  );
}
