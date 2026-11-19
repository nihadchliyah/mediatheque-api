import type { z } from 'zod';

export type Message = { role: 'user' | 'assistant'; content: string };

export type Outil = {
  nom: string;
  description: string;
  parametres: z.ZodObject;
  executer: (args: unknown) => Promise<unknown>;
};

export type Usage = { entree: number; sortie: number; total: number };

export type Evenement =
  | { type: 'texte'; texte: string }
  | { type: 'outil'; nom: string }
  | { type: 'usage'; usage: Usage };

export type Demande = {
  systeme: string;
  historique: Message[];
  question: string;
  outils: Outil[];
  signal: AbortSignal;
};

export interface FournisseurIA {
  readonly nom: string;
  diffuser(demande: Demande): AsyncGenerator<Evenement>;
}
