# Gestionale Practical Type Training (PTT)

Logbook digitale del **Practical Training Record CH-47F Cat. B1.3** (Allegato 1, ed. 00.01 del 4 dicembre 2025).
Sostituisce la compilazione su Excel: ogni frequentatore registra i task eseguiti, il Compliance Report e i grafici si
ricalcolano subito e il Training Manager vede l'intero corso senza raccogliere file.

**App online (dati condivisi su Supabase):** https://pier-200.github.io/GestionalePTT/
**Prova senza account (dati solo nel browser):** https://pier-200.github.io/GestionalePTT/?demo
Sul cellulare si installa come app **PTT** (Android: menu ⋮ → «Installa app»; iPhone: Condividi → «Aggiungi alla schermata Home»).

Specifica completa: [PROGETTO_Logbook_PTT.md](PROGETTO_Logbook_PTT.md).

## Cosa fa

| Pagina | Frequentatore | Istruttore | Training Manager |
|---|---|---|---|
| Tavola (cartiglio, requisiti, quote per modulo e task type, chapter scoperti) | propria | tutti, lettura | tutti |
| Logbook: 190 task per modulo → chapter → task, registrazioni con data, A/C o SIM/CLA, ET, location, istruttore | proprio | lettura | correzioni su tutti |
| Compliance Report 4.1 / 4.2 / 4.3 con esito complessivo; «Stampa / PDF» produce il modulo ufficiale compilato | proprio | tutti | tutti |
| Practical Instructors (calcolata dalle registrazioni) | proprio | tutti | tutti |
| Personal Data / Practical Type Training Data | modifica i propri PD, legge i TD | lettura | tutto, anche per l'intero corso |
| Situazione del corso (distinta, esiti, ultime registrazioni) | – | sì | sì |
| Account e corso (crea, modifica, disattiva account; elenco istruttori) | – | – | sì |
| Esportazione Excel (singolo: 5 fogli; complessivo: riepilogo + registrazioni) e CSV | proprio logbook | sì | sì |

Regole di conformità (Generality and Purpose): **≥ 50%** dei task per ciascun modulo e per ciascun task type,
**≥ 1** task per ciascun chapter; più registrazioni dello stesso task contano una volta. Il task type MEL ha 0 task
applicabili al CH-47F e risulta «n.a.». La Commissione tecnica esaminatrice non è gestita.

Primo accesso: password provvisoria da sostituire, poi il frequentatore compila i Personal Data.

## Archivio dei dati

Si sceglie in [`public/config.json`](public/config.json), senza ricompilare:

| `archivio.tipo` | Dove stanno i dati | Permessi | Aggiornamento |
|---|---|---|---|
| `demo` (sempre disponibile con `?demo`) | nel browser di chi apre l'app, partendo dalla situazione esempio | applicati dall'app | tra schede dello stesso browser |
| `supabase` (attuale) | database PostgreSQL centrale (Supabase) | **dal database** (Row Level Security) | in tempo reale |
| `github` | repository GitHub privato, accessi con portachiavi cifrato | applicati dall'app | controllo ogni 30 s |

Supabase è l'archivio consigliato dal documento di progetto; l'archivio GitHub usa solo domini GitHub (utile se la rete
dell'ufficio blocca altri siti), ma un utente esperto che ha accesso potrebbe alterare dati altrui.
Istruzioni passo passo: [docs/PUBBLICAZIONE.md](docs/PUBBLICAZIONE.md).

> La repository è pubblica: non inserire mai dati reali o credenziali nei file. La situazione esempio è inventata.

## Stampa del Compliance Report

«Stampa / PDF» apre le 4 pagine del modulo ufficiale (`public/modelli/compliance-report.pdf`, pagg. 36-39 dell'Allegato 1)
e vi scrive soltanto i valori: Organization, Grade, First name, Surname, MAML, task eseguiti e percentuali di ogni riga,
Place e Date. Le righe barrate nel modulo (21A, 27) restano vuote. Un logo facoltativo si aggiunge pubblicando
`public/modelli/logo.png`. Le posizioni sono ricavate dal PDF con `py -3.11 scripts/layout_compliance.py`.

## Situazione esempio

Nella modalità demo i profili sono pronti nella pagina di accesso: Training Manager, due istruttori e sei frequentatori a diversi
stadi (una conforme, uno con 3 chapter scoperti, altri in corso, uno appena creato che deve compilare i Personal Data).
Il pulsante «Ripristina la situazione esempio» riporta i dati allo stato iniziale.
Nell'archivio Supabase la stessa situazione esempio è caricata con account propri (password nel file locale delle credenziali);
prima dell'uso reale si elimina con `database/elimina_esempio.sql`.

## Sviluppo

```bash
npm install
npm run dev          # http://localhost:5174
npm test             # calcoli, permessi e schema SQL (PGlite)
npm run build && npx vite preview --port 4174 && npm run e2e   # prova nel browser Edge
npm run pubblica     # compila e aggiorna GitHub Pages (ramo gh-pages)
```

Struttura:

```
database/catalogo.sql        catalogo dei task (generato)       database/schema.sql   tabelle + RLS Supabase
scripts/import_catalogo.py   importa il catalogo dall'Excel     scripts/pubblica.mjs  pubblicazione su Pages
scripts/layout_compliance.py posizioni dei valori nel modulo PDF   scripts/semina-supabase.mjs  TM e situazione esempio su Supabase
supabase/functions/gestione-utenti   creazione/modifica account (Edge Function)
src/dominio/   catalogo, compliance, motore dei comandi (permessi e validazioni), viste
src/backend/   archivi demo, github, supabase         src/esporta.ts   Excel e CSV     src/stampaReport.ts   PDF sul modulo ufficiale
src/ui/        interfaccia (pagine, componenti, stile «tavola tecnica»)
tests/         test di dominio, schema SQL ed end-to-end
```

Il catalogo si rigenera con `npm run catalogo` dopo aver copiato `PTR_B1.3_CH-47F.xlsx` in `docs/sorgenti/`
(Excel e PDF originali restano fuori dalla repository pubblica, tranne il modulo del Compliance Report usato per la stampa).
