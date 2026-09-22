---
name: Gestionale PTT
description: Logbook digitale del Practical Type Training CH-47F B1.3, disegnato come una tavola tecnica sotto verifica.
colors:
  carta: "#f6f7f4"
  carta-2: "#eceee9"
  foglio: "#fbfcfa"
  inchiostro: "#16202b"
  inchiostro-2: "#46515d"
  inchiostro-3: "#66717d"
  filetto: "#8e99a4"
  filetto-chiaro: "#d3d8dc"
  giallo: "#f2d22e"
  evidenzia: "#f7e36a"
  evidenzia-tenue: "#fbf1b3"
  rosso: "#c22f25"
  rosso-linea: "#d2352b"
typography:
  display:
    fontFamily: "'Barlow Condensed', Barlow, sans-serif"
    fontSize: "4rem"
    fontWeight: 600
    lineHeight: 0.85
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' 1, 'lnum' 1"
  headline:
    fontFamily: "'Barlow Condensed', Barlow, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.005em"
  title:
    fontFamily: "'Barlow Condensed', Barlow, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Barlow, 'Segoe UI', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "'tnum' 1, 'lnum' 1"
  body-sm:
    fontFamily: "Barlow, 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.4
  cifre:
    fontFamily: "'Barlow Condensed', Barlow, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.1
    fontFeature: "'tnum' 1, 'lnum' 1"
  label:
    fontFamily: "'Barlow Condensed', Barlow, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  vivo: "0px"
  tratto: "2px"
  palloncino: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.inchiostro}"
    textColor: "{colors.foglio}"
    rounded: "{rounded.vivo}"
    height: "50px"
  button-default:
    backgroundColor: "{colors.foglio}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.vivo}"
  button-default-hover:
    backgroundColor: "{colors.carta-2}"
  input:
    backgroundColor: "{colors.foglio}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.vivo}"
  chip:
    backgroundColor: "{colors.foglio}"
    textColor: "{colors.inchiostro}"
    typography: "{typography.cifre}"
    rounded: "{rounded.vivo}"
    height: "34px"
    padding: "0 12px"
  chip-attivo:
    backgroundColor: "{colors.inchiostro}"
    textColor: "{colors.foglio}"
  palloncino:
    backgroundColor: "{colors.foglio}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.palloncino}"
    height: "32px"
    padding: "0 7px"
  palloncino-fatto:
    backgroundColor: "{colors.evidenzia}"
  palloncino-manca:
    backgroundColor: "{colors.foglio}"
    textColor: "{colors.rosso}"
  timbro-conforme:
    backgroundColor: "{colors.evidenzia}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.vivo}"
    padding: "4px 10px 3px"
  timbro-non-conforme:
    backgroundColor: "{colors.foglio}"
    textColor: "{colors.rosso}"
    rounded: "{rounded.vivo}"
    padding: "4px 10px 3px"
  cartiglio:
    backgroundColor: "{colors.foglio}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.vivo}"
    padding: "8px 10px 9px"
  nav-basso:
    backgroundColor: "{colors.foglio}"
    textColor: "{colors.inchiostro-2}"
    height: "64px"
  indice-voce-attiva:
    backgroundColor: "{colors.foglio}"
    textColor: "{colors.inchiostro}"
    height: "40px"
---

# Design System: Gestionale PTT

## Overview

**Creative North Star: "La tavola sotto verifica"**

Ogni schermata è un foglio da disegno tecnico che il verificatore sta controllando sul check print: inchiostro blu-nero su carta bianca fredda, filetti sottili, lettering condensato e cifre tabellari. Il colore non decora mai: compare solo come segno del verificatore. Il giallo evidenziatore marca ciò che è eseguito, la matita rossa marca ciò che manca. Tutto il resto è inchiostro.

Il sistema è denso ma ordinato come una distinta base: tabelle rigate, righe di etichetta a griglia fissa, gerarchia ottenuta per sola scala e peso del condensato, non per riquadri o colore. I dispositivi del disegno tecnico (cornice con riferimenti di griglia, cartiglio, timbro di esito, linee di quota con datum al 50%, palloncini per i codici chapter, blocco revisioni) sono i componenti stessi dell'interfaccia, non ornamenti. Rifiuta la dashboard SaaS a schede, ombre e angoli arrotondati.

L'app è usata al telefono in hangar e al PC d'ufficio: contrasto alto, bersagli touch ampi (40-52px), stampa A4 del solo foglio.

**Key Characteristics:**
- Inchiostro su carta; colore riservato ai segni di verifica (giallo = fatto, rosso = manca).
- Angoli vivi ovunque; l'unica forma tonda è il palloncino.
- Nessuna ombra: la profondità è data da filetti, doppia cornice e toni di carta.
- Barlow per la prosa, Barlow Condensed per titoli, cifre, etichette e dati.
- Cifre tabellari e allineate a destra in ogni colonna numerica.

## Colors

Una carta fredda quasi acromatica, un inchiostro blu-nero in tre intensità, e due soli colori di segno: l'evidenziatore giallo e la matita rossa.

### Primary
- **Inchiostro di china** (inchiostro): testo, filetti strutturali a 1px, cornici, pulsante primario pieno, chip e segmento attivi, indicatore della voce corrente. È anche il `primaryColor` Mantine (tono 8).

### Secondary
- **Evidenziatore del verificatore** (evidenzia): l'unico colore del "fatto": riempimento delle linee di quota, tratto sulle descrizioni dei task eseguiti, palloncini e celle coperte, timbro CONFORME, arco della ciambella, selezione del testo.
- **Evidenziatore tenue** (evidenzia-tenue): campitura di righe e celle soddisfatte (requisiti, celle "si" delle tabelle, riquadro "tutto ok"), dove il giallo pieno sarebbe troppo forte su grandi aree.
- **Giallo marchio** (giallo): solo la sottolineatura a pennarello della sigla PTT.

### Tertiary
- **Matita rossa** (rosso): testo e icone di requisiti non soddisfatti, timbro NON CONFORME, conteggi mancanti.
- **Tratto rosso** (rosso-linea): i segni grafici della mancanza, sempre tratteggiati: tratto che misura ciò che manca sulla linea di quota, bordo dei palloncini e delle celle scoperte.

### Neutral
- **Carta** (carta): sfondo dell'app, barra superiore, fascia filtri su mobile.
- **Carta ombreggiata** (carta-2): indice laterale desktop, hover di righe e pulsanti, righe totale, celle "previsti".
- **Foglio** (foglio): superficie del foglio con cornice, cartiglio, input, chip, barra di navigazione inferiore, drawer.
- **Inchiostro diluito** (inchiostro-2): testo secondario, etichette, sottotitoli, ID task.
- **Inchiostro tenue** (inchiostro-3): solo i riferimenti di griglia della cornice.
- **Filetto** (filetto): bordi di input, chip, checkbox; scrollbar.
- **Filetto chiaro** (filetto-chiaro): divisori tra righe di tabelle, distinte ed elenchi; traccia della ciambella.

### Named Rules
**La Regola dei Segni del Verificatore.** Il giallo significa solo "eseguito/soddisfatto", il rosso solo "manca/non conforme". Nessun altro uso, nessun terzo colore di stato.

**La Regola Mai Solo Colore.** Ogni esito porta icona e testo (CONFORME, OK, manca 1) e ogni mancanza è anche tratteggiata; il colore conferma, non informa da solo.

## Typography

**Display Font:** Barlow Condensed (con Barlow, sans-serif), self-hosted via @fontsource
**Body Font:** Barlow (con "Segoe UI", system-ui, sans-serif)
**Label/Mono Font:** Barlow Condensed, anche come `fontFamilyMonospace` Mantine per i dati

**Character:** lettering tecnico da cartiglio: il condensato porta tutto ciò che si misura o si nomina (titoli, cifre, codici, etichette), il Barlow regolare porta la prosa e le descrizioni dei task. `tnum` e `lnum` sono attivi su tutto il body.

### Hierarchy
- **Display** (600, 4rem, da 700px 5rem, 0.85): la percentuale monumentale nel cartiglio, con il simbolo % a 0.45em. Una per schermata.
- **Headline** (600, 1.75rem, 1.1, `text-wrap: balance`): titolo di pagina.
- **Title** (600, 1.1875rem, 1.2): titolo di sezione sopra un filetto d'inchiostro; anche titoli dei drawer e delle parti espandibili (queste in maiuscolo, 0.04em).
- **Body** (400, 1rem / 0.9375rem, 1.4; testo lungo 1.6 a 76ch): descrizioni dei task, prosa del documento ufficiale.
- **Cifre** (600, 0.9375rem, 1.1): valori di quota, ID e tipo task, contatori, celle numeriche, palloncini.
- **Label** (600, 0.75rem, 0.08em, maiuscolo): intestazioni di colonna, nomi dei campi del cartiglio (0.6875rem), gruppi dell'indice, link d'azione di sezione.

### Named Rules
**La Regola della Sola Scala.** La gerarchia si costruisce con dimensione e peso del condensato, mai con colore o riquadri.

**La Regola delle Cifre Tabellari.** Ogni numero è in condensato tabellare e, in colonna, allineato a destra.

## Layout

Mobile first. Su telefono: barra superiore sticky (56px) con sigla, titolo e sottotitolo; contenuto a padding 16px; barra di navigazione fissa in basso (64px + safe area) a 4 voci (3 tavole + Altro, che apre un drawer dal basso); l'azione primaria "Registra task" è fissata a 16px dai bordi, 12px sopra la navigazione, nel raggio del pollice. Il contenuto riserva in fondo `nav + 88px + safe area`.

Da 992px: griglia a due colonne, indice laterale sticky da 260px su carta ombreggiata con marchio, gruppi di voci e piede utente; la navigazione inferiore sparisce e l'azione primaria torna nel flusso. Il contenuto (28px 32px 56px) ospita il foglio, max 1180px centrato, con doppia cornice e riferimenti di griglia 1-8 / A-F nella fascia di 15px tra le due linee.

Le pagine a due colonne (tavola, griglia-2) passano a 1fr 1fr da 900px, gap 24-40px; su mobile la tavola riordina requisiti, quote di modulo, quote di task type, chapter scoperti. Il blocco revisioni è tabella da 760px e voci impilate sotto. Ritmo verticale: sezioni a 32px, moduli del logbook a 28px, righe da 10-11px di padding. Breakpoint osservati: 600, 700, 760, 900, 992px.

La stampa (A4, margine 12mm) mostra solo il foglio, senza cornice, indice né navigazione.

## Elevation & Depth

Sistema piatto senza ombre. La profondità è data da tre mezzi: la gerarchia dei filetti (1px filetto chiaro tra righe, 1px inchiostro per strutture, 1.5-2px inchiostro per cornici di blocchi e testate di modulo), la doppia cornice del foglio (bordo + outline a 15px di distanza) e il salto di tono carta / carta ombreggiata / foglio. L'unico `box-shadow` presente è l'anello di focus degli input (`0 0 0 1px` inchiostro), che è un secondo filetto, non un'ombra.

### Named Rules
**La Regola del Filetto.** Se serve separare, si traccia una linea; non si solleva una scheda. Spessore = importanza strutturale.

**La Regola dell'Arretramento.** Quando un task della distinta è aperto, le altre righe scendono a opacità 0.45 (180ms ease-out): il fuoco si ottiene togliendo, non sollevando.

## Shapes

Angoli vivi (0px) su pulsanti, input, drawer, modali, chip, notifiche, controlli segmentati, cartiglio e timbro. Le uniche curve sono: il palloncino (999px), la ciambella, e i raggi irregolari del tratto d'evidenziatore (es. `2px 7px 3px 8px / 6px 3px 7px 2px`, variato ogni tre righe) che imitano una passata a mano. Il timbro di esito grande è ruotato di -2deg; la versione piccola resta dritta. I segni di mancanza sono sempre tratteggiati, quelli di completamento sempre continui.

## Components

### Buttons
Pieni e secchi, come un'etichetta d'inchiostro.
- **Shape:** angoli vivi (0px).
- **Primary:** fondo inchiostro, testo foglio, icona più a sinistra; nel caso "Registra task" size lg (50px) a tutta larghezza su mobile.
- **Default (secondario):** fondo foglio, bordo inchiostro 1px; hover carta ombreggiata.
- **Subtle:** solo per azioni icona nella barra (aggiorna) e azioni di riga.
- **Focus:** outline 2px inchiostro, offset 2px (globale).

### Chips
- **Style:** 34px, fondo foglio, bordo filetto 1px, condensato 600 0.875rem, angoli vivi; scorrono in orizzontale senza scrollbar nella fascia filtri sticky.
- **State:** premuto (`aria-pressed`) = pieno inchiostro con testo foglio.

### Cards / Containers
Non esistono schede. I contenitori sono il **foglio** (foglio, doppia cornice, padding 28px 32px 36px su desktop, nessuna cornice su mobile), le **sezioni** (titolo sopra filetto inchiostro 1px) e i blocchi rigati (requisiti, "tutto ok", testata del compliance report) con bordo inchiostro 1-1.5px e campitura evidenzia-tenue quando soddisfatti.

### Inputs / Fields
- **Style:** fondo foglio, bordo filetto, angoli vivi, etichetta sopra in 600.
- **Focus:** bordo inchiostro più anello 1px inchiostro.
- **Controlli segmentati:** bordo inchiostro, indicatore pieno inchiostro senza ombra, etichette condensate 0.9375rem.

### Navigation
- **Indice desktop:** voci a griglia icona 22px / testo / extra, 40px, Barlow 500; hover bordo filetto chiaro su foglio; corrente = foglio con bordo inchiostro. Gruppi introdotti da un'etichetta.
- **Barra inferiore mobile:** 4 colonne, icona 22px sopra testo condensato maiuscolo 0.8125rem, inchiostro diluito; corrente = inchiostro con barra piena 4px sul filetto superiore.
- **Tabs:** condensato 600 1rem, attivo con bordo inchiostro.

### Cartiglio (signature)
Il title block del disegno come intestazione della tavola: griglia di celle rigate (6 colonne su mobile, 8 da 992px) con bordo esterno 1.5px e interni 1px inchiostro; ogni cella ha etichetta 0.6875rem e valore 600; il nome in condensato 1.5rem; il blocco numero (ciambella, percentuale monumentale, timbro) occupa la posizione del numero di tavola, in alto a destra su desktop.

### Timbro (signature)
Timbro rettangolare CONFORME / NON CONFORME: bordo 2px `currentColor`, condensato 700 maiuscolo 0.1em, icona piena; conforme su evidenziatore, non conforme rosso su foglio. Variante piccola (0.75rem, bordo 1.5px, non ruotata) per tabelle e righe.

### Linea di quota (signature)
Barra di avanzamento disegnata come quota: linea d'inchiostro con terminali verticali, parte eseguita in evidenziatore chiusa da un tratto d'inchiostro 2px, datum tratteggiato al 50%, tratto rosso tratteggiato 2px che misura quanto manca alla soglia. Griglia fissa nome 72px / linea / valore 74px, con scala 0 · 50% soglia · 100 sotto l'elenco. Etichettata per screen reader con eseguiti, previsti e soglia.

### Palloncino (signature)
Codice chapter in un cerchio da 32px, bordo inchiostro 1px, condensato 600 0.875rem: evidenziatore se coperto, rosso tratteggiato 1.5px se scoperto. In nuvola con gap 6px, linkabile.

### Riga task e tratto d'evidenziatore (signature)
Ogni task della distinta usa la stessa griglia d'etichetta ID 38px · tipo 40px · descrizione · conteggio. Da eseguito, la descrizione riceve una passata d'evidenziatore per ogni riga di testo; al salvataggio la passata si stende da 0 a 100% (480ms `cubic-bezier(0.16, 1, 0.3, 1)`), disattivata con `prefers-reduced-motion`. La riga aperta si espande sul posto.

### Ciambella
Avanzamento complessivo: arco evidenziatore spesso su traccia filetto chiaro, tra due fili d'inchiostro 1px, tacca di datum a 0 e tacca d'inchiostro alla fine dell'arco; cifre al centro in condensato.

### Tabella rigata
Stile distinta base: intestazioni label sopra filetto inchiostro 1.5px, righe separate da filetto chiaro, numeri condensati a destra, righe cliccabili con hover carta ombreggiata, separatori di gruppo 2px inchiostro, righe totale su carta ombreggiata.

## Do's and Don'ts

### Do:
- **Do** usare l'evidenziatore (#f7e36a) solo per ciò che è eseguito o soddisfatto, e l'evidenziatore tenue per campire righe intere.
- **Do** segnare ogni mancanza in rosso e tratteggiata, con icona e testo.
- **Do** separare con filetti: 1px filetto chiaro tra righe, 1px inchiostro per strutture, 1.5-2px per cornici di blocco.
- **Do** mettere titoli, cifre, codici ed etichette in Barlow Condensed con cifre tabellari.
- **Do** riusare i dispositivi del disegno (foglio, cartiglio, timbro, quota, palloncino, blocco revisioni) prima di inventare un componente.
- **Do** mantenere l'azione primaria nel raggio del pollice su mobile e bersagli touch da almeno 40px.

### Don't:
- **Don't** usare ombre, schede sollevate o sfondi a riquadri colorati.
- **Don't** arrotondare angoli: fanno eccezione solo palloncino, ciambella e tratto d'evidenziatore.
- **Don't** introdurre un terzo colore di stato o usare giallo e rosso come decorazione.
- **Don't** comunicare un esito con il solo colore.
- **Don't** usare il giallo marchio (#f2d22e) fuori dalla sigla PTT.
