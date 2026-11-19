import { prisma } from '../db.js';
import { Conflit, NonTrouve, RequeteInvalide } from '../erreurs.js';

const relations = {
  ouvrage: { select: { id: true, titre: true, auteur: true } },
  utilisateur: { select: { id: true, email: true } },
};

const filtre = ({ rendu, utilisateurId }) => ({
  ...(rendu !== undefined && { rendu }),
  ...(utilisateurId !== undefined && { utilisateurId }),
});

export async function lister({ page, limite, ...criteres }) {
  const where = filtre(criteres);
  const [donnees, total] = await prisma.$transaction([
    prisma.emprunt.findMany({
      where, include: relations, orderBy: { id: 'asc' }, skip: (page - 1) * limite, take: limite,
    }),
    prisma.emprunt.count({ where }),
  ]);
  return { donnees, total };
}

export function trouver(id, utilisateurId) {
  return prisma.emprunt.findFirst({ where: { id, ...filtre({ utilisateurId }) }, include: relations });
}

export function creer({ ouvrageId, utilisateurId, ...donnees }) {
  return prisma.$transaction(async (tx) => {
    if (!(await tx.utilisateur.findUnique({ where: { id: utilisateurId }, select: { id: true } }))) {
      throw new NonTrouve(`Utilisateur ${utilisateurId} introuvable`);
    }
    const { count } = await tx.ouvrage.updateMany({
      where: { id: ouvrageId, disponible: true },
      data: { disponible: false },
    });
    if (count === 0) {
      const ouvrage = await tx.ouvrage.findUnique({ where: { id: ouvrageId } });
      if (!ouvrage) throw new NonTrouve(`Ouvrage ${ouvrageId} introuvable`);
      throw new Conflit(`L'ouvrage ${ouvrageId} est déjà emprunté`);
    }
    return tx.emprunt.create({ data: { ouvrageId, utilisateurId, ...donnees }, include: relations });
  });
}

export function modifier(id, donnees) {
  return prisma.$transaction(async (tx) => {
    const actuel = await tx.emprunt.findUnique({ where: { id } });
    if (!actuel) throw new NonTrouve(`Emprunt ${id} introuvable`);
    const dateEmprunt = donnees.dateEmprunt ?? actuel.dateEmprunt;
    const dateRetourPrevue = donnees.dateRetourPrevue ?? actuel.dateRetourPrevue;
    if (dateRetourPrevue <= dateEmprunt) {
      throw new RequeteInvalide('Paramètres invalides (body)', [{
        champ: donnees.dateRetourPrevue ? 'dateRetourPrevue' : 'dateEmprunt',
        message: "La date de retour prévue doit être postérieure à la date d'emprunt",
      }]);
    }
    return tx.emprunt.update({ where: { id }, data: donnees, include: relations });
  });
}

export function retourner(id, utilisateurId) {
  return prisma.$transaction(async (tx) => {
    const where = { id, ...filtre({ utilisateurId }) };
    const { count } = await tx.emprunt.updateMany({ where: { ...where, rendu: false }, data: { rendu: true } });
    const emprunt = await tx.emprunt.findFirst({ where, include: relations });
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
