# Pubblicazione e archivio condiviso

L'app è già online su **https://pier-200.github.io/GestionalePTT/** in modalità dimostrativa: ognuno vede la situazione
esempio nel proprio browser. Per il lavoro reale, con tutti sugli stessi dati, serve un archivio centrale: **Supabase**
(consigliato) oppure un **repository GitHub privato**. Si sceglie modificando `public/config.json` e ripubblicando.

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

- I progetti gratuiti si sospendono dopo circa una settimana senza accessi: durante il corso l'uso quotidiano li tiene attivi;
  a fine corso esportare l'Excel complessivo.
- Password del Training Manager dimenticata: in **SQL Editor**
  `update auth.users set encrypted_password = extensions.crypt('NuovaPassword2026', extensions.gen_salt('bf')) where email = 'tm.rossi@ptt.local';`

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
