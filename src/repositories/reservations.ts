import { prisma } from '../db.ts';
import { Conflit, NonTrouve } from '../erreurs.ts';
import { verrouillerOuvrage } from './ouvrages.ts';
import type { ListerReservations } from '../schemas/reservations.ts';

export const relations = {
  ouvrage: { select: { id: true, titre: true, auteur: true } },
  utilisateur: { select: { id: true, email: true } },
} as const;

type Criteres = { ouvrageId?: number; utilisateurId?: number };

const filtre = ({ ouvrageId, utilisateurId }: Criteres) => ({
  ...(ouvrageId !== undefined && { ouvrageId }),
  ...(utilisateurId !== undefined && { utilisateurId }),
});

const ordreFile = [{ creeLe: 'asc' }, { id: 'asc' }] as const;

export async function lister({ page, limite, ...criteres }: ListerReservations) {
  const where = filtre(criteres);
  const [donnees, total] = await prisma.$transaction([
    prisma.reservation.findMany({
      where, include: relations, orderBy: [...ordreFile], skip: (page - 1) * limite, take: limite,
    }),
    prisma.reservation.count({ where }),
  ]);
  return { donnees, total };
}

export function trouver(id: number, utilisateurId?: number) {
  return prisma.reservation.findFirst({ where: { id, ...filtre({ utilisateurId }) }, include: relations });
}

export function creer({ ouvrageId, utilisateurId }: { ouvrageId: number; utilisateurId: number }) {
  return prisma.$transaction(async (tx) => {
    const ouvrage = await verrouillerOuvrage(tx, ouvrageId);
    if (!ouvrage) throw new NonTrouve(`Ouvrage ${ouvrageId} introuvable`);
    if (ouvrage.disponible) {
      throw new Conflit(`L'ouvrage ${ouvrageId} est disponible : empruntez-le directement`);
    }
    const dejaEmprunte = await tx.emprunt.count({ where: { ouvrageId, utilisateurId, rendu: false } });
    if (dejaEmprunte > 0) throw new Conflit(`Vous empruntez déjà l'ouvrage ${ouvrageId}`);
    const existante = await tx.reservation.count({ where: { ouvrageId, utilisateurId } });
    if (existante > 0) throw new Conflit(`Vous avez déjà une réservation active pour l'ouvrage ${ouvrageId}`);
    const rang = await tx.reservation.count({ where: { ouvrageId } });
    const reservation = await tx.reservation.create({ data: { ouvrageId, utilisateurId }, include: relations });
    return { ...reservation, rang: rang + 1 };
  });
}

export async function annuler(id: number, utilisateurId?: number) {
  const { count } = await prisma.reservation.deleteMany({ where: { id, ...filtre({ utilisateurId }) } });
  if (count === 0) throw new NonTrouve(`Réservation ${id} introuvable`);
}
