import { prisma } from '../db.js';

export async function lister({ page, limite, disponible }) {
  const where = disponible === undefined ? {} : { disponible };
  const [donnees, total] = await prisma.$transaction([
    prisma.ouvrage.findMany({ where, orderBy: { id: 'asc' }, skip: (page - 1) * limite, take: limite }),
    prisma.ouvrage.count({ where }),
  ]);
  return { donnees, total };
}

export function trouverAvecEmpruntsEnCours(id) {
  return prisma.ouvrage.findUnique({
    where: { id },
    include: { emprunts: { where: { rendu: false }, orderBy: { dateEmprunt: 'desc' } } },
  });
}

export function creer(donnees) {
  return prisma.ouvrage.create({ data: donnees });
}

export function modifier(id, donnees) {
  return prisma.ouvrage.update({ where: { id }, data: donnees });
}

export function compterEmpruntsEnCours(id) {
  return prisma.emprunt.count({ where: { ouvrageId: id, rendu: false } });
}

export function supprimer(id) {
  return prisma.ouvrage.delete({ where: { id } });
}
