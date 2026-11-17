import { z } from 'zod';
import { booleenQuery, dateIso, pagination } from './communs.js';

const emprunteur = z.string().trim().min(2, '2 caractères minimum').max(80, '80 caractères maximum');

export const creerEmprunt = z.object({
  ouvrageId: z.number().int().positive(),
  emprunteur,
  dateEmprunt: dateIso.optional(),
  dateRetourPrevue: dateIso,
}).refine(
  (e) => e.dateRetourPrevue > (e.dateEmprunt ?? new Date()),
  { message: "La date de retour prévue doit être postérieure à la date d'emprunt", path: ['dateRetourPrevue'] },
);

export const modifierEmprunt = z.object({
  emprunteur,
  dateEmprunt: dateIso,
  dateRetourPrevue: dateIso,
}).partial()
  .refine((o) => Object.keys(o).length > 0, 'Au moins un champ à modifier');

export const listerEmprunts = z.object({
  ...pagination,
  rendu: booleenQuery.optional(),
});
