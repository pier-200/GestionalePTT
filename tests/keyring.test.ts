import { describe, expect, it } from 'vitest';
import { creaKeyring, impostaCredenziali, sbloccaKeyring, validaKeyring } from '../src/backend/github/keyring';

/** Portachiavi dell'archivio GitHub: il token non deve mai essere leggibile senza password. */

const TOKEN = 'github_pat_esempio_non_valido';

describe('portachiavi', () => {
  it('sblocca il token solo con la password giusta', async () => {
    const { keyring, chiavi } = await creaKeyring(TOKEN, 'admin', 'admin');
    expect(chiavi.token).toBe(TOKEN);
    expect(JSON.stringify(keyring)).not.toContain(TOKEN);
    expect(JSON.stringify(keyring)).not.toContain('admin');
    const riaperto = await sbloccaKeyring(validaKeyring(JSON.parse(JSON.stringify(keyring))), 'admin', 'admin');
    expect(riaperto.token).toBe(TOKEN);
    await expect(sbloccaKeyring(keyring, 'admin', 'sbagliata')).rejects.toThrow();
    await expect(sbloccaKeyring(keyring, 'nessuno', 'admin')).rejects.toThrow();
  });

  it('l’amministratore aggiunge un utente che riceve lo stesso token', async () => {
    const { keyring, chiavi } = await creaKeyring(TOKEN, 'admin', 'admin');
    const aggiornato = await impostaCredenziali(keyring, chiavi, 'mario.rossi', 'prova1234', false);
    const suo = await sbloccaKeyring(aggiornato, 'mario.rossi', 'prova1234');
    expect(suo.token).toBe(TOKEN);
    expect(suo.ka).toBeNull();
    expect(aggiornato.revisione).toBeGreaterThan(keyring.revisione);
  });
});
