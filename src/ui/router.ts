import { useSyncExternalStore } from 'react';

/**
 * Router minimale basato sull'hash (#/percorso?query): funziona su GitHub Pages
 * e da file locale senza configurazioni lato server.
 */

export interface Posizione {
  percorso: string;
  query: URLSearchParams;
}

function leggiHash(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

function iscrivi(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export function usePosizione(): Posizione {
  const hash = useSyncExternalStore(iscrivi, leggiHash, () => '/');
  const [percorso, query = ''] = hash.split('?');
  return { percorso: percorso || '/', query: new URLSearchParams(query) };
}

export function naviga(destinazione: string, opzioni: { sostituisci?: boolean } = {}) {
  const hash = `#${destinazione.startsWith('/') ? destinazione : `/${destinazione}`}`;
  if (opzioni.sostituisci) {
    window.history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else if (window.location.hash !== hash) {
    window.location.hash = hash;
  }
}

/** Aggiorna la query string dell'hash corrente senza aggiungere voci alla cronologia. */
export function aggiornaQuery(valori: Record<string, string | null | undefined>) {
  const [percorso, query = ''] = leggiHash().split('?');
  const parametri = new URLSearchParams(query);
  for (const [chiave, valore] of Object.entries(valori)) {
    if (valore == null || valore === '') parametri.delete(chiave);
    else parametri.set(chiave, valore);
  }
  const testo = parametri.toString();
  naviga(`${percorso}${testo ? `?${testo}` : ''}`, { sostituisci: true });
}
