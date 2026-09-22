import { useState } from 'react';
import { Alert, Button, PasswordInput, Stack, Text } from '@mantine/core';
import { IconLogout } from '@tabler/icons-react';
import { messaggioErrore } from '../../dominio/errori';
import { ETICHETTA_RUOLO } from '../../dominio/tipi';
import { nomeUtente } from '../../dominio/viste';
import { IntestazionePagina, Sezione } from '../componenti/disegno';
import { useStato } from '../stato';

export function FormPassword({ obbligatorio }: { obbligatorio?: boolean }) {
  const { backend, ricarica } = useStato();
  const [v, setV] = useState({ attuale: '', nuova: '', conferma: '' });
  const [errore, setErrore] = useState('');
  const [ok, setOk] = useState(false);
  const [attesa, setAttesa] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setErrore('');
        setOk(false);
        if (v.nuova !== v.conferma) return setErrore('Le due password nuove non coincidono.');
        setAttesa(true);
        try {
          await backend!.cambiaPassword(v.attuale, v.nuova);
          setV({ attuale: '', nuova: '', conferma: '' });
          setOk(true);
          await ricarica();
        } catch (x) {
          setErrore(messaggioErrore(x));
        } finally {
          setAttesa(false);
        }
      }}
    >
      <Stack gap="sm" maw={420}>
        <PasswordInput label={obbligatorio ? 'Password provvisoria' : 'Password attuale'} value={v.attuale} onChange={(e) => setV({ ...v, attuale: e.currentTarget.value })} autoComplete="current-password" required />
        <PasswordInput label="Nuova password" description="Almeno 10 caratteri con lettere e cifre." value={v.nuova} onChange={(e) => setV({ ...v, nuova: e.currentTarget.value })} autoComplete="new-password" required />
        <PasswordInput label="Ripeti la nuova password" value={v.conferma} onChange={(e) => setV({ ...v, conferma: e.currentTarget.value })} autoComplete="new-password" required />
        {errore && (
          <Alert color="rosso" variant="light">
            {errore}
          </Alert>
        )}
        {ok && <Alert variant="light">Password aggiornata.</Alert>}
        <Button type="submit" loading={attesa} style={{ alignSelf: 'flex-start' }}>
          Cambia password
        </Button>
      </Stack>
    </form>
  );
}

export function Profilo() {
  const { utente, dati, backend, esci } = useStato();
  if (!utente || !dati || !backend) return null;
  return (
    <>
      <IntestazionePagina titolo="Profilo e password" />
      <div className="griglia-2">
        <Sezione titolo="Account">
          <dl className="codici" style={{ gridTemplateColumns: '120px 1fr' }}>
            <dt>Nominativo</dt>
            <dd>{nomeUtente(dati, utente.id)}</dd>
            <dt>Username</dt>
            <dd>{utente.username}</dd>
            <dt>Ruolo</dt>
            <dd>{ETICHETTA_RUOLO[utente.ruolo]}</dd>
            <dt>Archivio</dt>
            <dd>{backend.nome}</dd>
          </dl>
          <Button mt="lg" variant="default" leftSection={<IconLogout size={17} />} onClick={() => void esci()}>
            Esci
          </Button>
          <Text size="sm" className="debole" mt="xl">
            Per usare l'app come PTT sul cellulare: Android (Chrome) menu ⋮ → «Installa app»; iPhone (Safari) pulsante Condividi → «Aggiungi alla schermata Home».
          </Text>
        </Sezione>
        <Sezione titolo="Cambio password">
          <FormPassword />
        </Sezione>
      </div>
    </>
  );
}
