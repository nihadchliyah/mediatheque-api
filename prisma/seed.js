import { prisma } from '../src/db.js';

const ouvrages = [
  { titre: 'Les Misérables', auteur: 'Victor Hugo', annee: 1862 },
  { titre: 'Madame Bovary', auteur: 'Gustave Flaubert', annee: 1857 },
  { titre: "L'Étranger", auteur: 'Albert Camus', annee: 1942 },
  { titre: 'Le Petit Prince', auteur: 'Antoine de Saint-Exupéry', annee: 1943 },
  { titre: 'Germinal', auteur: 'Émile Zola', annee: 1885 },
  { titre: 'Le Rouge et le Noir', auteur: 'Stendhal', annee: 1830 },
  { titre: 'Vingt mille lieues sous les mers', auteur: 'Jules Verne', annee: 1870 },
  { titre: 'La Peste', auteur: 'Albert Camus', annee: 1947 },
  { titre: 'Bel-Ami', auteur: 'Guy de Maupassant', annee: 1885 },
  { titre: 'Candide', auteur: 'Voltaire', annee: 1759 },
];

const jours = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`TRUNCATE TABLE emprunts, ouvrages RESTART IDENTITY CASCADE`;
    await tx.ouvrage.createMany({ data: ouvrages });

    await tx.emprunt.createMany({
      data: [
        { ouvrageId: 1, emprunteur: 'Camille', dateEmprunt: jours(-5), dateRetourPrevue: jours(16) },
        { ouvrageId: 2, emprunteur: 'Léo', dateEmprunt: jours(-10), dateRetourPrevue: jours(11) },
        { ouvrageId: 3, emprunteur: 'Inès', dateEmprunt: jours(-30), dateRetourPrevue: jours(-9), rendu: true },
      ],
    });
    await tx.ouvrage.updateMany({ where: { id: { in: [1, 2] } }, data: { disponible: false } });
  });
  console.log('Seed terminé : 10 ouvrages, 3 emprunts (dont 1 rendu).');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
