import { prisma, type Transaction } from '../db.ts';
import { Conflit, NonTrouve } from '../erreurs.ts';
import type { CreerOuvrage, ListerOuvrages, ModifierOuvrage } from '../schemas/ouvrages.ts';

export async function lister({ page, limite, disponible }: ListerOuvrages) {
  const where = disponible === undefined ? {} : { disponible };
  const [donnees, total] = await prisma.$transaction([
    prisma.ouvrage.findMany({ where, orderBy: { id: 'asc' }, skip: (page - 1) * limite, take: limite }),
    prisma.ouvrage.count({ where }),
  ]);
  return { donnees, total };
}

export function trouverAvecEmpruntsEnCours(id: number, utilisateurId?: number) {
  return prisma.ouvrage.findUnique({
    where: { id },
    include: {
      emprunts: {
        where: { rendu: false, ...(utilisateurId !== undefined && { utilisateurId }) },
        orderBy: { dateEmprunt: 'desc' },
      },
    },
  });
}

export function creer(donnees: CreerOuvrage) {
  return prisma.ouvrage.create({ data: donnees });
}

export function modifier(id: number, donnees: ModifierOuvrage) {
  return prisma.ouvrage.update({ where: { id }, data: donnees });
}

export async function verrouillerOuvrage(tx: Transaction, id: number) {
  const [ouvrage] = await tx.$queryRaw<{ id: number; disponible: boolean }[]>`SELECT id, disponible FROM ouvrages WHERE id = ${id} FOR UPDATE`;
  return ouvrage;
}

export function supprimer(id: number) {
  return prisma.$transaction(async (tx) => {
    if (!(await verrouillerOuvrage(tx, id))) throw new NonTrouve('Ouvrage introuvable');
    const enCours = await tx.emprunt.count({ where: { ouvrageId: id, rendu: false } });
    if (enCours > 0) throw new Conflit('Impossible de supprimer un ouvrage actuellement emprunté');
    await tx.ouvrage.delete({ where: { id } });
  });
}
