import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { BIBLIO, client, connecter, demarrer, prisma, reinitialiserBase } from './aide.js';

describe('Validation des entrées', () => {
  let serveur;
  let requete;
  let biblio;

  before(async () => {
    await reinitialiserBase();
    serveur = await demarrer({ limiteAuth: 100 });
    requete = client(serveur.base);
    biblio = (await connecter(requete, BIBLIO)).accessToken;
  });

  after(async () => {
    await serveur.arreter();
    await prisma.$disconnect();
  });

  it('identifiant hors de la plage des entiers : 400 et non 500', async () => {
    const trop = '2147483648';
    const parametre = await requete('GET', `/api/ouvrages/${trop}`, { jeton: biblio });
    const corps = await requete('POST', '/api/emprunts', {
      jeton: biblio, corps: { ouvrageId: Number(trop), dateRetourPrevue: '2099-01-01' },
    });
    const query = await requete('GET', `/api/emprunts?utilisateurId=${trop}`, { jeton: biblio });

    assert.equal(parametre.statut, 400);
    assert.equal(corps.statut, 400);
    assert.equal(corps.corps.champs[0].champ, 'ouvrageId');
    assert.equal(query.statut, 400);
  });
});
