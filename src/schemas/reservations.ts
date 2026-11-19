import { z } from 'zod';
import { identifiant, identifiantTexte, pagination } from './communs.ts';

export const creerReservation = z.object({
  ouvrageId: identifiant,
}).meta({ id: 'CreerReservation' });

export const listerReservations = z.object({
  ...pagination,
  ouvrageId: identifiantTexte.optional(),
  utilisateurId: identifiantTexte.optional(),
});

export type CreerReservation = z.output<typeof creerReservation>;
export type ListerReservations = z.output<typeof listerReservations>;
