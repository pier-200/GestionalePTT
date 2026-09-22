/** Modello dati condiviso (PROGETTO_Logbook_PTT.md §6). Date in formato YYYY-MM-DD, istanti ISO. */

export type ID = string;
export type Ruolo = 'admin' | 'instructor' | 'trainee';
export type TipoEsecuzione = 'AC' | 'SIM' | 'CLA';

export interface Utente {
  id: ID;
  username: string;
  ruolo: Ruolo;
  attivo: boolean;
  /** Nome mostrato per admin e istruttori (i frequentatori usano i Personal Data). */
  nome: string;
  /** Account istruttore collegato alla voce dell'elenco istruttori. */
  istruttore_id: ID | null;
  deve_cambiare_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Anagrafica {
  user_id: ID;
  grado: string;
  nome: string;
  cognome: string;
  data_nascita: string | null;
  citta_nascita: string;
  /** Numero MAML: compare nell'intestazione del Compliance Report. */
  maml: string;
  updated_at: string;
  updated_by: ID | null;
}

export interface DatiTraining {
  user_id: ID;
  data_inizio: string | null;
  data_fine: string | null;
  maintenance_organization: string;
  location: string;
  updated_at: string;
  updated_by: ID | null;
}

export interface Istruttore {
  id: ID;
  grado: string;
  nome: string;
  cognome: string;
  created_at: string;
  created_by: ID | null;
}

export interface Registrazione {
  id: ID;
  user_id: ID;
  task_id: number;
  maintenance_location: string;
  data: string;
  tipo_esecuzione: TipoEsecuzione;
  /** Matricola e numero identificativo dell'aeromobile (solo per tipo AC). */
  matricola: string;
  et_minuti: number;
  instructor_id: ID;
  creato_il: string;
  creato_da: ID | null;
  modificato_il: string;
  modificato_da: ID | null;
}

export interface Dati {
  utenti: Utente[];
  anagrafiche: Anagrafica[];
  training: DatiTraining[];
  istruttori: Istruttore[];
  registrazioni: Registrazione[];
}

export const datiVuoti = (): Dati => ({ utenti: [], anagrafiche: [], training: [], istruttori: [], registrazioni: [] });

export const ETICHETTA_RUOLO: Record<Ruolo, string> = {
  admin: 'Training Manager',
  instructor: 'Istruttore',
  trainee: 'Frequentatore',
};
