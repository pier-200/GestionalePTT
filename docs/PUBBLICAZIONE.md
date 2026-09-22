# Pubblicazione e archivio condiviso

L'app è online su **https://pier-200.github.io/GestionalePTT/** con archivio **Supabase** già configurato
(progetto `dyragieggyvgayteotlm`, regione eu-west-1): tutti lavorano sugli stessi dati. La modalità dimostrativa resta
disponibile su `https://pier-200.github.io/GestionalePTT/?demo`. In alternativa a Supabase si può usare un
**repository GitHub privato** (sezione B). L'archivio si sceglie in `public/config.json` e si ripubblica.

## Stato dell'installazione Supabase (22/09/2026)

- Catalogo, schema, sicurezza (RLS) e tempo reale installati (`database/catalogo.sql`, `database/schema.sql`).
- Edge Function `gestione-utenti` pubblicata con Verify JWT disattivato; registrazione libera disattivata.
- Account **training.manager** (Training Manager) con password provvisoria, da cambiare al primo accesso.
- Situazione esempio caricata con account propri. Credenziali nel file locale
  `Desktop\Gestione Practical Type Training\Credenziali PTT (riservato).txt` (mai nel repository).
- Prima dell'uso reale: SQL Editor → eseguire `database/elimina_esempio.sql` (toglie account e dati dell'esempio).

Per ripetere l'installazione su un altro progetto: passi 2-4 della sezione A, poi
`SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node scripts/semina-supabase.mjs <username TM> "<Grado Nome Cognome>" [--esempio] --credenziali <file>`.

> Prima di caricare dati reali di personale militare su un servizio esterno, verificare con l'ente che sia ammesso
> (vedi §7 del documento di progetto).

---

## A. Archivio Supabase (consigliato)

Permessi applicati dal database, aggiornamento in tempo reale, piano gratuito.

### 1. Creare il progetto

1. Registrarsi su <https://supabase.com> e creare un **New project** (nome `gestionale-ptt`, regione europea, password
   del database robusta da conservare).
2. Dal PC dell'ufficio aprire `https://<progetto>.supabase.co`: se la pagina è bloccata dalla rete, usare l'archivio GitHub (sezione B).

### 2. Installare catalogo, schema e funzione

1. **SQL Editor → New query**: incollare tutto `database/catalogo.sql` e premere **Run**.
2. Nuova query: incollare tutto `database/schema.sql` e premere **Run** (entrambi gli script si possono rieseguire).
3. **Edge Functions → Deploy a new function → Via editor**: nome **`gestione-utenti`**, incollare
   `supabase/functions/gestione-utenti/index.ts`, **Deploy**. Nella scheda della funzione disattivare **Verify JWT**
   (la funzione verifica da sé che chi la chiama sia il Training Manager).

### 3. Autenticazione

1. **Authentication → Sign In / Providers**: disattivare **Allow new users to sign up**.
2. **Authentication → Users → Add user → Create new user**: email `<username>@ptt.local` (es. `tm.rossi@ptt.local`),
   password, spuntare **Auto Confirm User**. Sarà il Training Manager.

Gli indirizzi `@ptt.local` sono solo tecnici: agli utenti basta lo username. Se Supabase rifiutasse il dominio, usarne
un altro sia qui sia nel campo `dominioEmail` di `config.json`.

### 4. Collegare l'app

In **Project Settings → API Keys** copiare l'URL del progetto e la **Publishable key** (o la chiave `anon`), poi in
`public/config.json`:

```json
{
  "archivio": {
    "tipo": "supabase",
    "url": "https://abcdefghijkl.supabase.co",
    "chiavePubblica": "sb_publishable_...",
    "dominioEmail": "ptt.local"
  }
}
```

La chiave pubblica è fatta per stare nel browser: senza un utente autenticato e attivo non consente nulla.
Ripubblicare con `npm run pubblica` (oppure modificare `config.json` direttamente nel ramo `gh-pages` da GitHub).

### 5. Primo accesso

Aprire l'app: compare **Configurazione iniziale**. Inserire lo username (la parte prima di `@`), grado nome e cognome e
la password dell'utente creato al punto 3. Da **Account e corso** il Training Manager crea poi istruttori e frequentatori
con password provvisoria, e inserisce i Practical Type Training Data per l'intero corso.

### Manutenzione

- Piano gratuito: 500 MB di database, 5 GB di traffico al mese, 50.000 utenti attivi, 200 connessioni in tempo reale.
  Un corso di 20 frequentatori e 20 istruttori ne usa una piccola frazione (pochi MB di dati, qualche centinaio di MB di traffico al mese):
  l'app rilegge tutto solo all'accesso e poi riceve solo le registrazioni nuove.
- I progetti gratuiti si sospendono dopo 7 giorni senza alcun accesso: durante il corso l'uso quotidiano li tiene attivi.
  Se succede (es. tra un corso e l'altro), dal pannello Supabase → progetto → **Restore**: i dati restano.
- Il piano gratuito non ha backup automatici: a fine corso (e periodicamente) esportare l'**Excel complessivo**.
- Password del Training Manager dimenticata: in **SQL Editor**
  `update auth.users set encrypted_password = extensions.crypt('NuovaPassword2026', extensions.gen_salt('bf')) where email = 'training.manager@ptt.local';`

---

## B. Archivio su repository GitHub privato

Usa solo domini GitHub. Limite: i permessi sono applicati dall'app, quindi un utente esperto potrebbe modificare dati
altrui direttamente su GitHub (ogni salvataggio resta comunque nella cronologia ed è recuperabile).

1. Creare due repository: **`ptt-dati`** (Private, con README) e **`ptt-accessi`** (Public, con README; conterrà solo il
   portachiavi cifrato).
2. **Settings → Developer settings → Fine-grained tokens → Generate new token**: accesso ai soli due repository,
   permesso **Contents: Read and write**, scadenza massima. Copiare il token (`github_pat_…`).
3. In `public/config.json`:

   ```json
   { "archivio": { "tipo": "github", "owner": "pier-200", "repoDati": "ptt-dati", "repoAccessi": "ptt-accessi" } }
   ```

4. Ripubblicare, aprire l'app e completare **Configurazione iniziale** con il token, lo username e la password del
   Training Manager.
5. Quando il token scade o un utente lascia il corso: generare un token nuovo e ripetere la configurazione del portachiavi
   (eliminare `keyring.json` da `ptt-accessi`, rientrare con lo **stesso** username del Training Manager: i dati restano),
   poi reimpostare le password dei frequentatori da **Account e corso**.

---

## Aggiornare il sito

```bash
git commit -am "..."   # il sito deve corrispondere al codice salvato
npm run pubblica       # compila e sostituisce il ramo gh-pages
```

GitHub Pages serve il ramo `gh-pages` (Settings → Pages → Deploy from a branch).
