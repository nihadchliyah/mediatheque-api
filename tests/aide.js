import bcrypt from 'bcryptjs';
import { creerApp } from '../src/app.js';
import { prisma } from '../src/db.js';

export const BIBLIO = { email: 'biblio.test@example.net', motDePasse: 'Biblio-Test-2026' };

export async function reinitialiserBase() {
  if (!new URL(process.env.DATABASE_URL).pathname.includes('test')) {
    throw new Error('Les tests doivent utiliser une base de test');
  }
  await prisma.$executeRaw`TRUNCATE TABLE refresh_tokens, emprunts, ouvrages, utilisateurs RESTART IDENTITY CASCADE`;
  await prisma.utilisateur.create({
    data: { email: BIBLIO.email, motDePasseHache: await bcrypt.hash(BIBLIO.motDePasse, 12), role: 'bibliothecaire' },
  });
  await prisma.ouvrage.createMany({
    data: [
      { titre: 'Germinal', auteur: 'Émile Zola', annee: 1885 },
      { titre: 'Candide', auteur: 'Voltaire', annee: 1759 },
      { titre: 'La Peste', auteur: 'Albert Camus', annee: 1947 },
    ],
  });
}

export function demarrer(options) {
  return new Promise((resolve) => {
    const serveur = creerApp(options).listen(0, () => {
      const base = `http://127.0.0.1:${serveur.address().port}`;
      resolve({ base, arreter: () => new Promise((r) => serveur.close(r)) });
    });
  });
}

export function client(base) {
  return async function requete(methode, chemin, { jeton, corps, entetes = {} } = {}) {
    const reponse = await fetch(base + chemin, {
      method: methode,
      headers: {
        ...(corps !== undefined && { 'Content-Type': 'application/json' }),
        ...(jeton && { Authorization: `Bearer ${jeton}` }),
        ...entetes,
      },
      body: corps === undefined ? undefined : typeof corps === 'string' ? corps : JSON.stringify(corps),
    });
    const texte = await reponse.text();
    return { statut: reponse.status, entetes: reponse.headers, corps: texte ? JSON.parse(texte) : null };
  };
}

export async function connecter(requete, { email, motDePasse }) {
  const { statut, corps } = await requete('POST', '/api/auth/connexion', { corps: { email, motDePasse } });
  if (statut !== 200) throw new Error(`Connexion impossible pour ${email} : ${statut}`);
  return corps;
}

export async function inscrireEtConnecter(requete, email, motDePasse = 'Membre-Test-2026') {
  await requete('POST', '/api/auth/inscription', { corps: { email, motDePasse } });
  return connecter(requete, { email, motDePasse });
}

export { prisma };
