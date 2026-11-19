import { z } from 'zod';
import { booleenQuery, dateIso, identifiant, identifiantTexte, pagination } from './communs.ts';

export const creerEmprunt = z.object({
  ouvrageId: identifiant,
  utilisateurId: identifiant.optional().meta({ description: 'Ignoré pour un membre, qui emprunte toujours pour lui-même' }),
  dateEmprunt: dateIso.optional(),
  dateRetourPrevue: dateIso,
}).refine(
  (e) => e.dateRetourPrevue > (e.dateEmprunt ?? new Date()),
  { message: "La date de retour prévue doit être postérieure à la date d'emprunt", path: ['dateRetourPrevue'] },
).meta({ id: 'CreerEmprunt' });

export const modifierEmprunt = z.object({
  dateEmprunt: dateIso,
  dateRetourPrevue: dateIso,
}).partial()
  .refine((o) => Object.keys(o).length > 0, 'Au moins un champ à modifier (dateEmprunt, dateRetourPrevue)')
  .refine(
    (o) => !o.dateEmprunt || !o.dateRetourPrevue || o.dateRetourPrevue > o.dateEmprunt,
    { message: "La date de retour prévue doit être postérieure à la date d'emprunt", path: ['dateRetourPrevue'] },
  ).meta({ id: 'ModifierEmprunt' });

export const listerEmprunts = z.object({
  ...pagination,
  rendu: booleenQuery.optional(),
  utilisateurId: identifiantTexte.optional(),
});

export type CreerEmprunt = z.output<typeof creerEmprunt>;
export type ModifierEmprunt = z.output<typeof modifierEmprunt>;
export type ListerEmprunts = z.output<typeof listerEmprunts>;
