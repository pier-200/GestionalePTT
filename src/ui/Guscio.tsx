import { useState, type ReactNode } from 'react';
import { ActionIcon, Drawer, Tooltip } from '@mantine/core';
import { IconDots, IconLogout, IconRefresh } from '@tabler/icons-react';
import { ETICHETTA_RUOLO } from '../dominio/tipi';
import { nomeUtente } from '../dominio/viste';
import { linkFrequentatore, useFrequentatore, vociPer, type Voce } from './navigazione';
import { usePosizione } from './router';
import { useStato } from './stato';

const ora = (d: Date | null) => (d ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '');

export function Guscio({ titolo, children }: { titolo: string; children: ReactNode }) {
  const { utente, dati, backend, aggiornatoAlle, ricarica, esci } = useStato();
  const { percorso } = usePosizione();
  const frequentatore = useFrequentatore();
  const [altro, setAltro] = useState(false);
  if (!utente || !dati || !backend) return null;
  const voci = vociPer(utente);
  const f = frequentatore?.id;
  const href = (v: Voce) => (v.frequentatore ? linkFrequentatore(v.a, utente, f) : `#${v.a}`);
  const attiva = (v: Voce) => (v.a === '/' ? percorso === '/' : percorso === v.a || (utente.ruolo === 'trainee' && v.a === '/' && percorso === '/tavola'));
  const corrente = (v: Voce) => (attiva(v) ? ('page' as const) : undefined);
  const aggiornamento =
    backend.tipo === 'supabase' ? 'In tempo reale' : backend.tipo === 'github' ? 'Controllo ogni 30 s' : 'Dati in questo browser';

  const nomeFreq = frequentatore ? nomeUtente(dati, frequentatore.id) : null;
  const inBasso: Voce[] = utente.ruolo === 'trainee' ? voci.frequentatore.slice(0, 3) : [voci.corso[0], ...voci.frequentatore.slice(1, 3)];
  const inAltro = [...voci.corso, ...voci.frequentatore, ...voci.altro].filter((v) => !inBasso.includes(v));

  const elencoIndice = (lista: Voce[]) =>
    lista.map((v) => (
      <a key={v.a} href={href(v)} aria-current={corrente(v)}>
        <v.icona size={19} stroke={1.6} aria-hidden />
        <span>{v.etichetta}</span>
      </a>
    ));

  return (
    <div className="guscio">
      <nav className="indice" aria-label="Indice delle tavole">
        <div className="marchio">
          <div className="marchio-sigla">
            <span>PTT</span>
          </div>
          <div className="marchio-nome">Gestionale Practical Type Training · CH-47F B1.3</div>
        </div>
        {voci.corso.length > 0 && <div className="indice-gruppo">{elencoIndice(voci.corso)}</div>}
        <div className="indice-gruppo">
          <span className="etichetta">{utente.ruolo === 'trainee' ? 'Il mio logbook' : nomeFreq ? `Frequentatore · ${nomeFreq}` : 'Frequentatore'}</span>
          {elencoIndice(voci.frequentatore)}
        </div>
        <div className="indice-gruppo">{elencoIndice(voci.altro)}</div>
        <div className="indice-piede">
          <div style={{ fontWeight: 600 }}>{nomeUtente(dati, utente.id)}</div>
          <div className="debole">
            {ETICHETTA_RUOLO[utente.ruolo]} · {utente.username}
          </div>
          <button type="button" onClick={() => void esci()} style={{ all: 'unset', cursor: 'pointer', marginTop: 10, display: 'inline-flex', gap: 6, alignItems: 'center', fontWeight: 600 }}>
            <IconLogout size={16} aria-hidden /> Esci
          </button>
        </div>
      </nav>

      <div style={{ minWidth: 0 }}>
        <header className="barra">
          <a href="#/" className="marchio-sigla solo-mobile" style={{ fontSize: '1.375rem', textDecoration: 'none' }} aria-label="PTT, pagina iniziale">
            <span>PTT</span>
          </a>
          <div className="barra-titolo">
            <strong>{titolo}</strong>
            <span className="debole" style={{ fontSize: '0.8125rem' }}>
              {utente.ruolo !== 'trainee' && nomeFreq && (percorso !== '/' && percorso !== '/account' && percorso !== '/generalita' && percorso !== '/profilo') ? nomeFreq : `${ETICHETTA_RUOLO[utente.ruolo]} · ${aggiornamento}`}
            </span>
          </div>
          <Tooltip label={`${aggiornamento} · aggiornato alle ${ora(aggiornatoAlle)}`}>
            <ActionIcon variant="subtle" size="lg" onClick={() => void ricarica()} aria-label="Aggiorna i dati">
              <IconRefresh size={20} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        </header>
        <main className="contenuto">{children}</main>
      </div>

      <nav className="navbasso" aria-label="Navigazione principale">
        {inBasso.map((v) => (
          <a key={v.a} href={href(v)} aria-current={corrente(v)}>
            <v.icona size={22} stroke={1.6} aria-hidden />
            {v.breve}
          </a>
        ))}
        <button type="button" onClick={() => setAltro(true)} aria-haspopup="dialog">
          <IconDots size={22} stroke={1.6} aria-hidden />
          Altro
        </button>
      </nav>

      <Drawer opened={altro} onClose={() => setAltro(false)} position="bottom" size="auto" title={<span className="titolo-sezione">Altre tavole</span>}>
        <nav className="indice-mobile" onClick={() => setAltro(false)}>
          {inAltro.map((v) => (
            <a key={v.a} href={href(v)} aria-current={corrente(v)} className="voce-altro">
              <v.icona size={20} stroke={1.6} aria-hidden />
              {v.etichetta}
            </a>
          ))}
          <button type="button" className="voce-altro" onClick={() => void esci()}>
            <IconLogout size={20} stroke={1.6} aria-hidden />
            Esci ({utente.username})
          </button>
        </nav>
      </Drawer>
    </div>
  );
}
