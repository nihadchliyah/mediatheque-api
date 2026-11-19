import { z } from 'zod';

const id = z.number().int().positive();
const date = z.iso.datetime();

export const erreur = z.object({
  erreur: z.string().meta({ example: 'Ressource introuvable' }),
  champs: z.array(z.object({ champ: z.string(), message: z.string() })).optional(),
}).meta({ id: 'Erreur' });

export const utilisateurPublic = z.object({
  id,
  email: z.email().meta({ example: 'camille@example.net' }),
  role: z.enum(['membre', 'bibliothecaire']),
  creeLe: date,
}).meta({ id: 'Utilisateur' });

export const jetons = z.object({
  accessToken: z.string().meta({ description: 'JWT HS256 valable 15 minutes' }),
  refreshToken: z.string().meta({ description: 'JWT à usage unique, révocable, valable 7 jours' }),
  tokenType: z.literal('Bearer'),
}).meta({ id: 'Jetons' });

const resume = {
  ouvrage: z.object({ id, titre: z.string(), auteur: z.string() }),
  utilisateur: z.object({ id, email: z.email() }),
};

export const ouvrage = z.object({
  id,
  titre: z.string().meta({ example: 'Germinal' }),
  auteur: z.string().meta({ example: 'Émile Zola' }),
  annee: z.number().int().meta({ example: 1885 }),
  disponible: z.boolean(),
  creeLe: date,
  majLe: date,
}).meta({ id: 'Ouvrage' });

const champsEmprunt = {
  id,
  ouvrageId: id,
  utilisateurId: id,
  dateEmprunt: date,
  dateRetourPrevue: date,
  rendu: z.boolean(),
  creeLe: date,
  majLe: date,
};

export const ouvrageDetail = ouvrage.extend({
  emprunts: z.array(z.object(champsEmprunt))
    .meta({ description: "Emprunts en cours : tous pour un bibliothécaire, seulement les siens pour un membre" }),
}).meta({ id: 'OuvrageDetail' });

export const emprunt = z.object({ ...champsEmprunt, ...resume }).meta({ id: 'Emprunt' });

export const retour = emprunt.extend({
  empruntSuivant: emprunt.nullable()
    .meta({ description: "Emprunt créé pour la plus ancienne réservation de l'ouvrage, ou null si l'ouvrage redevient disponible" }),
}).meta({ id: 'Retour' });

export const reservation = z.object({
  id,
  ouvrageId: id,
  utilisateurId: id,
  creeLe: date,
  ...resume,
}).meta({ id: 'Reservation' });

export const reservationCreee = reservation.extend({
  rang: z.number().int().positive().meta({ description: "Position dans la file d'attente de l'ouvrage" }),
}).meta({ id: 'ReservationCreee' });

export const page = <T extends z.ZodType>(element: T, nom: string) => z.object({
  donnees: z.array(element),
  page: z.number().int(),
  limite: z.number().int(),
  total: z.number().int(),
  pages: z.number().int(),
}).meta({ id: nom });

export const sante = z.object({ statut: z.literal('ok') });
