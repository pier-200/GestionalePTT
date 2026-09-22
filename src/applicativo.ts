/**
 * Dalla stessa pubblicazione escono due applicativi installabili: `?app=mtt` e `?app=ptt`.
 * Qui si scambiano manifest, icona e titolo prima di disegnare l'interfaccia, così
 * «Aggiungi alla schermata Home» crea due app separate (MTT e PTT).
 */
const NOMI: Record<string, { titolo: string; sigla: string }> = {
  mtt: { titolo: 'Gestionale MTT · parte teorica', sigla: 'MTT' },
  ptt: { titolo: 'Gestionale PTT · parte pratica', sigla: 'PTT' },
};

export function preparaApplicativo() {
  const app = new URLSearchParams(window.location.search).get('app');
  const scelto = app && NOMI[app];
  if (!scelto) return;
  document.title = scelto.titolo;
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', `./manifest-${app}.webmanifest`);
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', `./icona-${app}-180.png`);
  document.querySelector('link[rel="icon"]')?.setAttribute('href', `./icona-${app}.svg`);
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', scelto.sigla);
}
