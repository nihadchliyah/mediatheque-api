import { z } from 'zod';
import { prisma } from '../../db.ts';
import type { UtilisateurConnecte } from '../auth.ts';
import type { Outil } from './types.ts';

const LIMITE = 10;

const rechercherOuvrages = z.object({
  recherche: z.string().trim().max(100).optional()
    .describe("Mot ou expression cherché dans le titre ou l'auteur ; omis pour parcourir le catalogue"),
  disponible: z.boolean().optional().describe('true pour ne garder que les ouvrages empruntables'),
});

const sansArgument = z.object({});

const date = (d: Date) => d.toISOString().slice(0, 10);

export function creerOutils(utilisateur: UtilisateurConnecte): Outil[] {
  return [
    {
      nom: 'rechercher_ouvrages',
      description: `Cherche des ouvrages du catalogue par titre ou auteur (${LIMITE} résultats au plus).`,
      parametres: rechercherOuvrages,
      async executer(args) {
        const { recherche, disponible } = rechercherOuvrages.parse(args);
        const ouvrages = await prisma.ouvrage.findMany({
          where: {
            ...(disponible !== undefined && { disponible }),
            ...(recherche && {
              OR: [
                { titre: { contains: recherche, mode: 'insensitive' } },
                { auteur: { contains: recherche, mode: 'insensitive' } },
              ],
            }),
          },
          select: { id: true, titre: true, auteur: true, annee: true, disponible: true },
          orderBy: { titre: 'asc' },
          take: LIMITE,
        });
        return { ouvrages };
      },
    },
    {
      nom: 'mes_emprunts',
      description: "Liste les emprunts en cours de l'utilisateur connecté, avec leur date de retour prévue.",
      parametres: sansArgument,
      async executer() {
        const emprunts = await prisma.emprunt.findMany({
          where: { utilisateurId: utilisateur.id, rendu: false },
          select: { dateRetourPrevue: true, ouvrage: { select: { titre: true, auteur: true } } },
          orderBy: { dateRetourPrevue: 'asc' },
          take: LIMITE,
        });
        return {
          emprunts: emprunts.map((e) => ({ ...e.ouvrage, retourPrevu: date(e.dateRetourPrevue) })),
        };
      },
    },
    {
      nom: 'mes_reservations',
      description: "Liste les réservations de l'utilisateur connecté et son rang dans la file de chaque ouvrage.",
      parametres: sansArgument,
      async executer() {
        const reservations = await prisma.reservation.findMany({
          where: { utilisateurId: utilisateur.id },
          select: { ouvrageId: true, creeLe: true, ouvrage: { select: { titre: true, auteur: true } } },
          orderBy: { creeLe: 'asc' },
          take: LIMITE,
        });
        return {
          reservations: await Promise.all(reservations.map(async (r) => ({
            ...r.ouvrage,
            rang: 1 + await prisma.reservation.count({ where: { ouvrageId: r.ouvrageId, creeLe: { lt: r.creeLe } } }),
          }))),
        };
      },
    },
  ];
}
