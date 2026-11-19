import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  BIBLIO, client, connecter, demarrer, inscrireEtConnecter, prisma, reinitialiserBase,
  type Requete, type Serveur,
} from './aide.ts';

describe('Réservations', () => {
  let serveur: Serveur;
  let requete: Requete;
  let biblio: string;
  let alice: string;
  let bruno: string;
  let chloe: string;
  let empruntAlice: number;
  let reservationBruno: number;
  let reservationChloe: number;

  before(async () => {
    await reinitialiserBase();
    serveur = await demarrer({ limiteAuth: 100 });
    requete = client(serveur.base);
    biblio = (await connecter(requete, BIBLIO)).accessToken;
    alice = (await inscrireEtConnecter(requete, 'alice@example.net')).accessToken;
    bruno = (await inscrireEtConnecter(requete, 'bruno@example.net')).accessToken;
    chloe = (await inscrireEtConnecter(requete, 'chloe@example.net')).accessToken;
    const { corps } = await requete('POST', '/api/emprunts', {
      jeton: alice, corps: { ouvrageId: 1, dateRetourPrevue: '2099-01-01' },
    });
    empruntAlice = corps.id;
  });

  after(async () => {
    await serveur.arreter();
    await prisma.$disconnect();
  });

  it('sans jeton : 401', async () => {
    const { statut } = await requete('GET', '/api/reservations');
    assert.equal(statut, 401);
  });

  it('un ouvrage disponible ne se réserve pas : 409 ; un ouvrage inconnu : 404 ; un corps invalide : 400', async () => {
    const disponible = await requete('POST', '/api/reservations', { jeton: bruno, corps: { ouvrageId: 2 } });
    const inconnu = await requete('POST', '/api/reservations', { jeton: bruno, corps: { ouvrageId: 999 } });
    const invalide = await requete('POST', '/api/reservations', { jeton: bruno, corps: { ouvrageId: 'un' } });
    assert.equal(disponible.statut, 409);
    assert.equal(inconnu.statut, 404);
    assert.equal(invalide.statut, 400);
    assert.equal(invalide.corps.champs[0].champ, 'ouvrageId');
  });

  it('un membre réserve un ouvrage indisponible : 201 avec son rang dans la file', async () => {
    const premier = await requete('POST', '/api/reservations', { jeton: bruno, corps: { ouvrageId: 1 } });
    const second = await requete('POST', '/api/reservations', { jeton: chloe, corps: { ouvrageId: 1 } });
    assert.equal(premier.statut, 201);
    assert.equal(premier.corps.rang, 1);
    assert.equal(premier.corps.utilisateur.email, 'bruno@example.net');
    assert.equal(second.statut, 201);
    assert.equal(second.corps.rang, 2);
    reservationBruno = premier.corps.id;
    reservationChloe = second.corps.id;
  });

  it('une seule réservation active par membre et par ouvrage : 409', async () => {
    const doublon = await requete('POST', '/api/reservations', { jeton: bruno, corps: { ouvrageId: 1 } });
    assert.equal(doublon.statut, 409);
    assert.equal(await prisma.reservation.count({ where: { ouvrageId: 1 } }), 2);
  });

  it('l’emprunteur ne réserve pas son propre ouvrage et le bibliothécaire ne réserve pas : 409 et 403', async () => {
    const emprunteur = await requete('POST', '/api/reservations', { jeton: alice, corps: { ouvrageId: 1 } });
    const parBiblio = await requete('POST', '/api/reservations', { jeton: biblio, corps: { ouvrageId: 1 } });
    assert.equal(emprunteur.statut, 409);
    assert.equal(parBiblio.statut, 403);
  });

  it('un membre ne voit ni n’annule les réservations d’un autre ; le bibliothécaire voit tout', async () => {
    const listeAlice = await requete('GET', '/api/reservations', { jeton: alice });
    const listeBruno = await requete('GET', '/api/reservations', { jeton: bruno });
    const filtreIgnore = await requete('GET', '/api/reservations?utilisateurId=4', { jeton: bruno });
    const detail = await requete('GET', `/api/reservations/${reservationChloe}`, { jeton: bruno });
    const annulation = await requete('DELETE', `/api/reservations/${reservationChloe}`, { jeton: bruno });
    const listeBiblio = await requete('GET', '/api/reservations', { jeton: biblio });

    assert.equal(listeAlice.corps.total, 0);
    assert.equal(listeBruno.corps.total, 1);
    assert.equal(listeBruno.corps.donnees[0].id, reservationBruno);
    assert.equal(filtreIgnore.corps.total, 1);
    assert.equal(detail.statut, 404);
    assert.equal(annulation.statut, 404);
    assert.equal(listeBiblio.corps.total, 2);
  });

  it('au retour, la réservation la plus ancienne devient un emprunt dans la même transaction', async () => {
    const retour = await requete('POST', `/api/emprunts/${empruntAlice}/retour`, { jeton: alice });
    assert.equal(retour.statut, 200);
    assert.equal(retour.corps.rendu, true);
    assert.equal(retour.corps.empruntSuivant.utilisateur.email, 'bruno@example.net');
    assert.equal(retour.corps.empruntSuivant.rendu, false);

    const ouvrage = await prisma.ouvrage.findUnique({ where: { id: 1 } });
    assert.equal(ouvrage?.disponible, false);
    assert.equal(await prisma.reservation.count({ where: { id: reservationBruno } }), 0);

    const empruntsBruno = await requete('GET', '/api/emprunts?rendu=false', { jeton: bruno });
    assert.equal(empruntsBruno.corps.total, 1);
    assert.equal(empruntsBruno.corps.donnees[0].ouvrage.id, 1);
  });

  it('un membre annule sa réservation : 204 puis 404', async () => {
    const annulation = await requete('DELETE', `/api/reservations/${reservationChloe}`, { jeton: chloe });
    const encore = await requete('DELETE', `/api/reservations/${reservationChloe}`, { jeton: chloe });
    assert.equal(annulation.statut, 204);
    assert.equal(encore.statut, 404);
  });

  it('sans réservation en attente, le retour rend l’ouvrage disponible', async () => {
    const { corps } = await requete('GET', '/api/emprunts?rendu=false', { jeton: bruno });
    const retour = await requete('POST', `/api/emprunts/${corps.donnees[0].id}/retour`, { jeton: bruno });
    assert.equal(retour.statut, 200);
    assert.equal(retour.corps.empruntSuivant, null);
    const ouvrage = await prisma.ouvrage.findUnique({ where: { id: 1 } });
    assert.equal(ouvrage?.disponible, true);
  });
});
