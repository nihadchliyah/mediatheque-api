import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { BIBLIO, client, connecter, demarrer, prisma, reinitialiserBase, type Requete, type Serveur } from './aide.ts';

describe('Validation des entrées', () => {
  let serveur: Serveur;
  let requete: Requete;
  let biblio: string;

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

  it('PATCH d’un emprunt : la date de retour reste postérieure à la date d’emprunt enregistrée', async () => {
    const { corps: emprunt } = await requete('POST', '/api/emprunts', {
      jeton: biblio,
      corps: { ouvrageId: 2, dateEmprunt: '2026-11-01', dateRetourPrevue: '2026-11-20' },
    });

    const retourAvant = await requete('PATCH', `/api/emprunts/${emprunt.id}`, {
      jeton: biblio, corps: { dateRetourPrevue: '2026-10-15' },
    });
    const empruntApres = await requete('PATCH', `/api/emprunts/${emprunt.id}`, {
      jeton: biblio, corps: { dateEmprunt: '2026-12-01' },
    });
    const deuxDates = await requete('PATCH', `/api/emprunts/${emprunt.id}`, {
      jeton: biblio, corps: { dateEmprunt: '2026-11-10', dateRetourPrevue: '2026-11-05' },
    });
    const valide = await requete('PATCH', `/api/emprunts/${emprunt.id}`, {
      jeton: biblio, corps: { dateRetourPrevue: '2026-11-30' },
    });

    assert.equal(retourAvant.statut, 400);
    assert.equal(retourAvant.corps.champs[0].champ, 'dateRetourPrevue');
    assert.equal(empruntApres.statut, 400);
    assert.equal(empruntApres.corps.champs[0].champ, 'dateEmprunt');
    assert.equal(deuxDates.statut, 400);
    assert.equal(valide.statut, 200);
  });

  it('suppression d’un ouvrage : 409 s’il est emprunté, 404 s’il est inconnu, 204 sinon', async () => {
    await requete('POST', '/api/emprunts', {
      jeton: biblio, corps: { ouvrageId: 1, dateRetourPrevue: '2099-01-01' },
    });

    const emprunte = await requete('DELETE', '/api/ouvrages/1', { jeton: biblio });
    const inconnu = await requete('DELETE', '/api/ouvrages/9999', { jeton: biblio });
    const libre = await requete('DELETE', '/api/ouvrages/3', { jeton: biblio });

    assert.equal(emprunte.statut, 409);
    assert.equal(inconnu.statut, 404);
    assert.equal(libre.statut, 204);
    assert.equal(await prisma.ouvrage.count({ where: { id: 1 } }), 1);
  });
});
