import { useEffect } from 'react';

/**
 * Sul telefono la tastiera copre il campo appena toccato (task, istruttore, luogo):
 * quando un campo prende il fuoco lo si riporta al centro della parte di schermo che resta visibile.
 * Usa visualViewport quando c'è, altrimenti scrollIntoView.
 */
export function useCampoVisibile(attivo: boolean) {
  useEffect(() => {
    if (!attivo || typeof window === 'undefined') return;
    let timer = 0;
    const porta = (elemento: HTMLElement) => {
      const vv = window.visualViewport;
      const r = elemento.getBoundingClientRect();
      const altezza = vv?.height ?? window.innerHeight;
      // se il campo finisce sotto la metà bassa dell'area visibile, lo si porta in alto
      if (r.bottom > altezza - 24 || r.top < 8) elemento.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    const alFuoco = (e: FocusEvent) => {
      const elemento = e.target as HTMLElement | null;
      if (!elemento?.closest('input, textarea, select, [role="combobox"]')) return;
      window.clearTimeout(timer);
      // si aspetta che la tastiera sia salita e abbia ridotto la viewport
      timer = window.setTimeout(() => porta(elemento.closest('.mantine-InputWrapper-root') ?? elemento), 350);
    };
    document.addEventListener('focusin', alFuoco);
    window.visualViewport?.addEventListener('resize', () => {
      const attivoOra = document.activeElement as HTMLElement | null;
      if (attivoOra && attivoOra.matches('input, textarea, [role="combobox"]')) porta(attivoOra.closest('.mantine-InputWrapper-root') ?? attivoOra);
    });
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('focusin', alFuoco);
    };
  }, [attivo]);
}
