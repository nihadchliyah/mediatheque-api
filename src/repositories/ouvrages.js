import { prisma } from '../db.js';
import { Conflit, NonTrouve } from '../erreurs.js';

export async function lister({ page, limite, disponible }) {
  const where = disponible === undefined ? {} : { disponible };
  const [donnees, total] = await prisma.$transaction([
    prisma.ouvrage.findMany({ where, orderBy: { id: 'asc' }, skip: (page - 1) * limite, take: limite }),
    prisma.ouvrage.count({ where }),
  ]);
  return { donnees, total };
}

export function trouverAvecEmpruntsEnCours(id, utilisateurId) {
  return prisma.ouvrage.findUnique({
    where: { id },
    include: { emprunts: { where: { rendu: false, ...(utilisateurId && { utilisateurId }) }, orderBy: { dateEmprunt: 'desc' } } },
  });
}

export function creer(donnees) {
  return prisma.ouvrage.create({ data: donnees });
}

export function modifier(id, donnees) {
  return prisma.ouvrage.update({ where: { id }, data: donnees });
}

export function supprimer(id) {
  return prisma.$transaction(async (tx) => {
    const verrou = await tx.$queryRaw`SELECT id FROM ouvrages WHERE id = ${id} FOR UPDATE`;
    if (verrou.length === 0) throw new NonTrouve('Ouvrage introuvable');
    const enCours = await tx.emprunt.count({ where: { ouvrageId: id, rendu: false } });
    if (enCours > 0) throw new Conflit('Impossible de supprimer un ouvrage actuellement emprunté');
    await tx.ouvrage.delete({ where: { id } });
  });
}
