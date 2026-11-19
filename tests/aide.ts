import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import { creerApp, type OptionsApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';

export type Identifiants = { email: string; motDePasse: string };
export type Serveur = { base: string; arreter: () => Promise<void> };
export type Reponse = { statut: number; entetes: Headers; corps: any };
export type Requete = (
  methode: string,
  chemin: string,
  options?: { jeton?: string; corps?: unknown; entetes?: Record<string, string> },
) => Promise<Reponse>;

export const BIBLIO: Identifiants = { email: 'biblio.test@example.net', motDePasse: 'Biblio-Test-2026' };

export async function reinitialiserBase() {
  if (!new URL(process.env.DATABASE_URL ?? 'x:').pathname.includes('test')) {
    throw new Error('Les tests doivent utiliser une base de test');
  }
  await prisma.$executeRaw`TRUNCATE TABLE refresh_tokens, reservations, emprunts, ouvrages, utilisateurs RESTART IDENTITY CASCADE`;
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

export function demarrer(options?: OptionsApp): Promise<Serveur> {
  return new Promise((resolve) => {
    const serveur = creerApp(options).listen(0, () => {
      const { port } = serveur.address() as AddressInfo;
      resolve({
        base: `http://127.0.0.1:${port}`,
        arreter: () => new Promise((r) => {
          serveur.closeAllConnections();
          serveur.close(() => r());
        }),
      });
    });
  });
}

export function client(base: string): Requete {
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

export async function connecter(requete: Requete, { email, motDePasse }: Identifiants) {
  const { statut, corps } = await requete('POST', '/api/auth/connexion', { corps: { email, motDePasse } });
  if (statut !== 200) throw new Error(`Connexion impossible pour ${email} : ${statut}`);
  return corps as { accessToken: string; refreshToken: string };
}

export async function inscrireEtConnecter(requete: Requete, email: string, motDePasse = 'Membre-Test-2026') {
  await requete('POST', '/api/auth/inscription', { corps: { email, motDePasse } });
  return connecter(requete, { email, motDePasse });
}

export { prisma };
