import { z } from 'zod';
import { booleenQuery, pagination } from './communs.ts';

const anneeCourante = () => new Date().getFullYear();

const champs = {
  titre: z.string().trim().min(1, 'Le titre est obligatoire').max(150, '150 caractères maximum'),
  auteur: z.string().trim().min(1, "L'auteur est obligatoire").max(100, '100 caractères maximum'),
  annee: z.number().int()
    .min(1450, "L'année doit être supérieure ou égale à 1450")
    .refine((a) => a <= anneeCourante(), "L'année ne peut pas dépasser l'année courante"),
};

export const creerOuvrage = z.object(champs);

export const modifierOuvrage = z.object(champs).partial()
  .refine((o) => Object.keys(o).length > 0, 'Au moins un champ à modifier (titre, auteur, annee)');

export const listerOuvrages = z.object({
  ...pagination,
  disponible: booleenQuery.optional(),
});

export type CreerOuvrage = z.output<typeof creerOuvrage>;
export type ModifierOuvrage = z.output<typeof modifierOuvrage>;
export type ListerOuvrages = z.output<typeof listerOuvrages>;
