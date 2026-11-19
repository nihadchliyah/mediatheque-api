import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { BIBLIO, client, connecter, demarrer, inscrireEtConnecter, prisma, reinitialiserBase, type Requete, type Serveur } from './aide.ts';

describe('Autorisation', () => {
  let serveur: Serveur;
  let requete: Requete;
  let biblio: string;
  let alice: string;
  let bruno: string;
  let empruntAlice: number;

  before(async () => {
    await reinitialiserBase();
    serveur = await demarrer({ limiteAuth: 100 });
    requete = client(serveur.base);
    biblio = (await connecter(requete, BIBLIO)).accessToken;
    alice = (await inscrireEtConnecter(requete, 'alice@example.net')).accessToken;
    bruno = (await inscrireEtConnecter(requete, 'bruno@example.net')).accessToken;
  });

  after(async () => {
    await serveur.arreter();
    await prisma.$disconnect();
  });

  it('accès sans jeton : 401', async () => {
    const { statut } = await requete('GET', '/api/ouvrages');
    assert.equal(statut, 401);
  });

  it('accès avec un jeton invalide ou falsifié : 401, jamais 500', async () => {
    const invalide = await requete('GET', '/api/ouvrages', { jeton: 'abc.def.ghi' });
    const falsifie = await requete('GET', '/api/ouvrages', { jeton: `${alice.slice(0, -2)}xx` });
    assert.equal(invalide.statut, 401);
    assert.equal(falsifie.statut, 401);
  });

  it('un membre lit le catalogue', async () => {
    const { statut, corps } = await requete('GET', '/api/ouvrages', { jeton: alice });
    assert.equal(statut, 200);
    assert.equal(corps.total, 3);
  });

  it('rôle insuffisant : un membre ne peut pas modifier le catalogue (403)', async () => {
    const ouvrage = { titre: 'Bel-Ami', auteur: 'Guy de Maupassant', annee: 1885 };
    const creation = await requete('POST', '/api/ouvrages', { jeton: alice, corps: ouvrage });
    const suppression = await requete('DELETE', '/api/ouvrages/3', { jeton: alice });
    assert.equal(creation.statut, 403);
    assert.equal(suppression.statut, 403);
  });

  it('un bibliothécaire gère le catalogue', async () => {
    const ouvrage = { titre: 'Bel-Ami', auteur: 'Guy de Maupassant', annee: 1885 };
    const { statut } = await requete('POST', '/api/ouvrages', { jeton: biblio, corps: ouvrage });
    assert.equal(statut, 201);
  });

  it('un membre emprunte pour lui-même, même s’il indique un autre utilisateur', async () => {
    const { statut, corps } = await requete('POST', '/api/emprunts', {
      jeton: alice,
      corps: { ouvrageId: 1, utilisateurId: 1, dateRetourPrevue: '2099-01-01' },
    });
    assert.equal(statut, 201);
    assert.equal(corps.utilisateur.email, 'alice@example.net');
    empruntAlice = corps.id;
  });

  it('un membre ne voit pas les emprunts d’un autre', async () => {
    const liste = await requete('GET', '/api/emprunts', { jeton: bruno });
    assert.equal(liste.statut, 200);
    assert.equal(liste.corps.total, 0);

    const detail = await requete('GET', `/api/emprunts/${empruntAlice}`, { jeton: bruno });
    assert.equal(detail.statut, 404);

    const retour = await requete('POST', `/api/emprunts/${empruntAlice}/retour`, { jeton: bruno });
    assert.equal(retour.statut, 404);
  });

  it('un bibliothécaire voit tous les emprunts', async () => {
    const { corps } = await requete('GET', '/api/emprunts', { jeton: biblio });
    assert.equal(corps.total, 1);
  });

  it('le PATCH d’un emprunt est réservé aux bibliothécaires et ne change pas le propriétaire', async () => {
    const parMembre = await requete('PATCH', `/api/emprunts/${empruntAlice}`, {
      jeton: alice, corps: { dateRetourPrevue: '2099-02-01' },
    });
    assert.equal(parMembre.statut, 403);

    const parBiblio = await requete('PATCH', `/api/emprunts/${empruntAlice}`, {
      jeton: biblio, corps: { dateRetourPrevue: '2099-02-01', utilisateurId: 1 },
    });
    assert.equal(parBiblio.statut, 200);
    assert.equal(parBiblio.corps.utilisateur.email, 'alice@example.net');
  });

  it('un membre clôture son propre emprunt', async () => {
    const { statut, corps } = await requete('POST', `/api/emprunts/${empruntAlice}/retour`, { jeton: alice });
    assert.equal(statut, 200);
    assert.equal(corps.rendu, true);
  });
});
