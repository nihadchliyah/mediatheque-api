import { z } from 'zod';
import { booleenQuery, dateIso, pagination } from './communs.js';

const id = z.number().int().positive();

export const creerEmprunt = z.object({
  ouvrageId: id,
  utilisateurId: id.optional(),
  dateEmprunt: dateIso.optional(),
  dateRetourPrevue: dateIso,
}).refine(
  (e) => e.dateRetourPrevue > (e.dateEmprunt ?? new Date()),
  { message: "La date de retour prévue doit être postérieure à la date d'emprunt", path: ['dateRetourPrevue'] },
);

export const modifierEmprunt = z.object({
  dateEmprunt: dateIso,
  dateRetourPrevue: dateIso,
}).partial()
  .refine((o) => Object.keys(o).length > 0, 'Au moins un champ à modifier (dateEmprunt, dateRetourPrevue)');

export const listerEmprunts = z.object({
  ...pagination,
  rendu: booleenQuery.optional(),
  utilisateurId: z.coerce.number().int().positive().optional(),
});
