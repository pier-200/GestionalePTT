import { useEffect } from 'react';
import { Button, Loader, Text } from '@mantine/core';
import { Guscio } from './Guscio';
import { Foglio } from './componenti/disegno';
import { Accesso, PrimoAvvio } from './pagine/Accesso';
import { Account } from './pagine/Account';
import { Corso } from './pagine/Corso';
import { Dati, FormAnagrafica } from './pagine/Dati';
import { Generalita } from './pagine/Generalita';
import { Istruttori } from './pagine/Istruttori';
import { Logbook } from './pagine/Logbook';
import { FormPassword, Profilo } from './pagine/Profilo';
import { Report } from './pagine/Report';
import { Tavola } from './pagine/Tavola';
import { usePosizione } from './router';
import { useStato } from './stato';

const PAGINE: Record<string, { titolo: string; pagina: () => React.ReactNode; soloAdmin?: boolean; soloStaff?: boolean }> = {
  '/tavola': { titolo: 'Tavola', pagina: Tavola },
  '/logbook': { titolo: 'Logbook', pagina: Logbook },
  '/report': { titolo: 'Compliance Report', pagina: Report },
  '/istruttori': { titolo: 'Practical Instructors', pagina: Istruttori },
  '/dati': { titolo: 'Personal & Training Data', pagina: Dati },
  '/generalita': { titolo: 'Generality and Purpose', pagina: Generalita },
  '/profilo': { titolo: 'Profilo', pagina: Profilo },
  '/account': { titolo: 'Account e corso', pagina: Account, soloAdmin: true },
};

function Schermata({ children }: { children: React.ReactNode }) {
  return (
    <main className="accesso">
      <div className="accesso-foglio" style={{ maxWidth: 560, gridTemplateColumns: '1fr' }}>
        <section>{children}</section>
      </div>
    </main>
  );
}

export function App() {
  const { fase, messaggio, utente, dati, avvia } = useStato();
  const { percorso } = usePosizione();

  useEffect(() => {
    void avvia();
  }, [avvia]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [percorso]);

  if (fase === 'avvio') {
    return (
      <Schermata>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Loader size="sm" color="inchiostro" />
          <span>Caricamento del logbook…</span>
        </div>
      </Schermata>
    );
  }
  if (fase === 'errore') {
    return (
      <Schermata>
        <h1 className="titolo-sezione">Avvio non riuscito</h1>
        <Text mt="sm">{messaggio}</Text>
        <Button mt="md" onClick={() => window.location.reload()}>
          Riprova
        </Button>
      </Schermata>
    );
  }
  if (fase === 'primo_avvio') return <PrimoAvvio />;
  if (fase === 'accesso' || !utente || !dati) return <Accesso />;

  // primo accesso: password provvisoria da sostituire, poi Personal Data del frequentatore
  if (utente.deve_cambiare_password) {
    return (
      <Schermata>
        <h1 className="titolo-sezione">Scegli la tua password</h1>
        <Text className="debole" mt={4} mb="md">
          Stai usando la password provvisoria ricevuta dal Training Manager: sostituiscila per continuare.
        </Text>
        <FormPassword obbligatorio />
      </Schermata>
    );
  }
  if (utente.ruolo === 'trainee' && !dati.anagrafiche.some((a) => a.user_id === utente.id)) {
    return (
      <Schermata>
        <h1 className="titolo-sezione">Trainee data</h1>
        <Text className="debole" mt={4} mb="md">
          Primo accesso: compila i tuoi dati anagrafici. Potrai modificarli in seguito dalla pagina «Dati».
        </Text>
        <FormAnagrafica f={utente} sola={false} />
      </Schermata>
    );
  }

  const staff = utente.ruolo !== 'trainee';
  const voce = percorso === '/' ? null : PAGINE[percorso];
  const consentita = voce && !(voce.soloAdmin && utente.ruolo !== 'admin');
  const titolo = percorso === '/' ? (staff ? 'Situazione del corso' : 'Tavola') : consentita ? voce.titolo : 'Pagina non trovata';
  const Pagina = percorso === '/' ? (staff ? Corso : Tavola) : consentita ? voce.pagina : null;

  return (
    <Guscio titolo={titolo}>
      <Foglio>
        {Pagina ? (
          <Pagina />
        ) : (
          <div>
            <h1 className="titolo-pagina">Pagina non trovata</h1>
            <p>
              <a href="#/">Torna alla pagina iniziale</a>
            </p>
          </div>
        )}
      </Foglio>
    </Guscio>
  );
}
