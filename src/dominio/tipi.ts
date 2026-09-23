/** Modello dati condiviso. Date in formato YYYY-MM-DD, istanti ISO. */

export type ID = string;
export type Ruolo = 'admin' | 'direttore' | 'instructor' | 'trainee';
export type RuoloCorso = 'direttore' | 'instructor' | 'trainee';
export type TipoEsecuzione = 'AC' | 'SIM' | 'CLA';

export interface Utente {
  id: ID;
  username: string;
  ruolo: Ruolo;
  attivo: boolean;
  /** Nome mostrato per TM, direttori e istruttori (i frequentatori usano i Personal Data). */
  nome: string;
  /** Account istruttore collegato alla voce dell'elenco istruttori pratici. */
  istruttore_id: ID | null;
  deve_cambiare_password: boolean;
  created_at: string;
  updated_at: string;
}

/** Un corso: parte teorica (MTT) e/o parte pratica (PTT), ciascuna con il suo programma. */
export interface Corso {
  id: ID;
  codice: string;
  nome: string;
  programma_teorico: string | null;
  programma_pratico: string | null;
  data_inizio: string | null;
  data_fine: string | null;
  maintenance_organization: string;
  location: string;
  /** Ora della prima lezione, per calcolare gli orari del programma settimanale. */
  ora_inizio: string;
  /** Minuti di lezione disponibili da lunedì a venerdì. */
  minuti_giorno: number[];
  attivo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Iscrizione {
  id: ID;
  corso_id: ID;
  user_id: ID;
  ruolo: RuoloCorso;
  created_at: string;
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

/** Practical type training data del frequentatore, per corso. */
export interface DatiTraining {
  corso_id: ID;
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
  corso_id: ID;
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

/** Lezione della parte teorica: una fetta di materia in un giorno. */
export interface Lezione {
  id: ID;
  corso_id: ID;
  data: string;
  /** Posizione nella giornata (0 = prima lezione). */
  ordine: number;
  minuti: number;
  materia: string;
  istruttore_id: ID | null;
  /** Lezione di recupero: sana le assenze della stessa materia e non ne produce di nuove. */
  recupero: boolean;
  /** Il programma diventa visibile ai frequentatori solo dopo la validazione. */
  validata: boolean;
  validata_da: ID | null;
  validata_il: string | null;
  note: string;
  creato_il: string;
  modificato_il: string;
  modificato_da: ID | null;
}

export type StatoPresenza = 'presente' | 'parziale' | 'assente';

/** Rapportino presenze di una giornata di corso: lo compilano i frequentatori, lo valida chi guida. */
export interface Rapportino {
  id: ID;
  corso_id: ID;
  data: string;
  note: string;
  compilato_da: ID | null;
  compilato_il: string;
  validato_da: ID | null;
  validato_il: string | null;
}

/** Presenza di un frequentatore in una giornata (orario standard salvo diversa indicazione). */
export interface Presenza {
  id: ID;
  corso_id: ID;
  data: string;
  user_id: ID;
  stato: StatoPresenza;
  /** Orario effettivo, solo per la presenza parziale. */
  dalle: string | null;
  alle: string | null;
  motivo: string;
}

/** Materia che un istruttore è abilitato a erogare. */
export interface Abilitazione {
  id: ID;
  user_id: ID;
  programma: string;
  materia: string;
}

export interface Dati {
  utenti: Utente[];
  corsi: Corso[];
  iscrizioni: Iscrizione[];
  anagrafiche: Anagrafica[];
  training: DatiTraining[];
  istruttori: Istruttore[];
  registrazioni: Registrazione[];
  lezioni: Lezione[];
  abilitazioni: Abilitazione[];
  rapportini: Rapportino[];
  presenze: Presenza[];
}

export const datiVuoti = (): Dati => ({
  utenti: [],
  corsi: [],
  iscrizioni: [],
  anagrafiche: [],
  training: [],
  istruttori: [],
  registrazioni: [],
  lezioni: [],
  abilitazioni: [],
  rapportini: [],
  presenze: [],
});

export const ETICHETTA_RUOLO: Record<Ruolo, string> = {
  admin: 'Training Manager',
  direttore: 'Direttore del corso',
  instructor: 'Istruttore',
  trainee: 'Frequentatore',
};

export const ETICHETTA_RUOLO_CORSO: Record<RuoloCorso, string> = {
  direttore: 'Direttore',
  instructor: 'Istruttore',
  trainee: 'Frequentatore',
};
