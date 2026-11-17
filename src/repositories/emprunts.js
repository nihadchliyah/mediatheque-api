import { prisma } from '../db.js';
import { Conflit, NonTrouve } from '../erreurs.js';

const avecOuvrage = { ouvrage: { select: { id: true, titre: true, auteur: true } } };

export async function lister({ page, limite, rendu }) {
  const where = rendu === undefined ? {} : { rendu };
  const [donnees, total] = await prisma.$transaction([
    prisma.emprunt.findMany({
      where, include: avecOuvrage, orderBy: { id: 'asc' }, skip: (page - 1) * limite, take: limite,
    }),
    prisma.emprunt.count({ where }),
  ]);
  return { donnees, total };
}

export function trouver(id) {
  return prisma.emprunt.findUnique({ where: { id }, include: avecOuvrage });
}

export function creer({ ouvrageId, ...donnees }) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.ouvrage.updateMany({
      where: { id: ouvrageId, disponible: true },
      data: { disponible: false },
    });
    if (count === 0) {
      const ouvrage = await tx.ouvrage.findUnique({ where: { id: ouvrageId } });
      if (!ouvrage) throw new NonTrouve(`Ouvrage ${ouvrageId} introuvable`);
      throw new Conflit(`L'ouvrage ${ouvrageId} est déjà emprunté`);
    }
    return tx.emprunt.create({ data: { ouvrageId, ...donnees }, include: avecOuvrage });
  });
}

export function modifier(id, donnees) {
  return prisma.emprunt.update({ where: { id }, data: donnees, include: avecOuvrage });
}

export function retourner(id) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.emprunt.updateMany({ where: { id, rendu: false }, data: { rendu: true } });
    const emprunt = await tx.emprunt.findUnique({ where: { id }, include: avecOuvrage });
    if (!emprunt) throw new NonTrouve(`Emprunt ${id} introuvable`);
    if (count === 0) throw new Conflit(`L'emprunt ${id} est déjà rendu`);
    await tx.ouvrage.update({ where: { id: emprunt.ouvrageId }, data: { disponible: true } });
    return emprunt;
  });
}

export function supprimer(id) {
  return prisma.$transaction(async (tx) => {
    const emprunt = await tx.emprunt.delete({ where: { id } });
    if (!emprunt.rendu) {
      await tx.ouvrage.update({ where: { id: emprunt.ouvrageId }, data: { disponible: true } });
    }
  });
}
