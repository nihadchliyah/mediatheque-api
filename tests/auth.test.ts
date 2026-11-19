import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { decodeJwt } from 'jose';
import { BIBLIO, client, connecter, demarrer, prisma, reinitialiserBase, type Requete, type Serveur } from './aide.ts';

describe('Authentification', () => {
  let serveur: Serveur;
  let requete: Requete;
  const membre = { email: 'alice@example.net', motDePasse: 'Alice-Test-2026' };

  before(async () => {
    await reinitialiserBase();
    serveur = await demarrer({ limiteAuth: 100 });
    requete = client(serveur.base);
  });

  after(async () => {
    await serveur.arreter();
    await prisma.$disconnect();
  });

  it("inscription : crée un membre sans exposer le mot de passe, même si un rôle est demandé", async () => {
    const { statut, corps } = await requete('POST', '/api/auth/inscription', {
      corps: { ...membre, role: 'bibliothecaire' },
    });
    assert.equal(statut, 201);
    assert.equal(corps.email, membre.email);
    assert.equal(corps.role, 'membre');
    assert.equal(corps.motDePasse, undefined);
    assert.equal(corps.motDePasseHache, undefined);

    const enBase = await prisma.utilisateur.findUnique({ where: { email: membre.email } });
    assert.match(enBase?.motDePasseHache ?? '', /^\$2[aby]\$12\$/);
  });

  it('inscription : 409 si l’e-mail existe déjà', async () => {
    const { statut } = await requete('POST', '/api/auth/inscription', { corps: membre });
    assert.equal(statut, 409);
  });

  it('inscription : 400 avec les champs fautifs', async () => {
    const { statut, corps } = await requete('POST', '/api/auth/inscription', {
      corps: { email: 'pas-un-email', motDePasse: 'court' },
    });
    assert.equal(statut, 400);
    assert.deepEqual([...new Set(corps.champs.map((c: { champ: string }) => c.champ))].sort(), ['email', 'motDePasse']);
  });

  it('connexion réussie : renvoie un access token de 15 minutes et un refresh token', async () => {
    const { statut, corps } = await requete('POST', '/api/auth/connexion', { corps: membre });
    assert.equal(statut, 200);
    assert.ok(corps.accessToken);
    assert.ok(corps.refreshToken);

    const charge = decodeJwt(corps.accessToken);
    assert.equal(charge.role, 'membre');
    assert.ok((charge.exp ?? Infinity) - (charge.iat ?? 0) <= 15 * 60);
    assert.ok(!JSON.stringify(charge).includes('motDePasse'));
  });

  it('connexion échouée : même 401 que le compte existe ou non', async () => {
    const mauvais = await requete('POST', '/api/auth/connexion', {
      corps: { email: membre.email, motDePasse: 'Mauvais-Mot-2026' },
    });
    const inconnu = await requete('POST', '/api/auth/connexion', {
      corps: { email: 'personne@example.net', motDePasse: 'Mauvais-Mot-2026' },
    });
    assert.equal(mauvais.statut, 401);
    assert.equal(inconnu.statut, 401);
    assert.deepEqual(mauvais.corps, inconnu.corps);
  });

  it('rafraîchissement : émet de nouveaux jetons et refuse la réutilisation de l’ancien', async () => {
    const { refreshToken } = await connecter(requete, BIBLIO);

    const premier = await requete('POST', '/api/auth/rafraichir', { corps: { refreshToken } });
    assert.equal(premier.statut, 200);
    assert.ok(premier.corps.accessToken);
    assert.notEqual(premier.corps.refreshToken, refreshToken);

    const rejoue = await requete('POST', '/api/auth/rafraichir', { corps: { refreshToken } });
    assert.equal(rejoue.statut, 401);
  });

  it('déconnexion : révoque les refresh tokens de l’utilisateur', async () => {
    const { accessToken, refreshToken } = await connecter(requete, membre);

    const deconnexion = await requete('POST', '/api/auth/deconnexion', { jeton: accessToken });
    assert.equal(deconnexion.statut, 204);

    const apres = await requete('POST', '/api/auth/rafraichir', { corps: { refreshToken } });
    assert.equal(apres.statut, 401);
  });
});
