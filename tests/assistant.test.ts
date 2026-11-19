import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  BIBLIO, client, connecter, demarrer, inscrireEtConnecter, prisma, reinitialiserBase,
  type Requete, type Serveur,
} from './aide.ts';
import { memoire } from '../src/services/assistant/index.ts';
import { FournisseurBouchon } from '../src/services/assistant/bouchon.ts';
import { verifierAccess } from '../src/services/auth.ts';

type EvenementSse = { evenement: string; donnees: any };

function lireSse(texte: string): EvenementSse[] {
  return texte.split('\n\n').filter(Boolean).map((bloc) => {
    const evenement = bloc.match(/^event: (.+)$/m)?.[1] ?? 'message';
    const donnees = JSON.parse(bloc.match(/^data: (.+)$/m)?.[1] ?? 'null');
    return { evenement, donnees };
  });
}

describe('Assistant en SSE (mode bouchon)', () => {
  let serveur: Serveur;
  let requete: Requete;
  let alice: string;
  let bruno: string;

  const poser = (jeton: string, question: unknown, signal?: AbortSignal) => fetch(`${serveur.base}/api/assistant/flux`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({ question }),
    signal,
  });

  const texteComplet = (evenements: EvenementSse[]) =>
    evenements.filter((e) => e.evenement === 'message').map((e) => e.donnees.texte).join('');

  before(async () => {
    await reinitialiserBase();
    serveur = await demarrer({ limiteAuth: 100, limiteAssistant: 8, fournisseurIA: new FournisseurBouchon(15) });
    requete = client(serveur.base);
    const biblio = (await connecter(requete, BIBLIO)).accessToken;
    alice = (await inscrireEtConnecter(requete, 'alice@example.net')).accessToken;
    bruno = (await inscrireEtConnecter(requete, 'bruno@example.net')).accessToken;
    await requete('POST', '/api/emprunts', { jeton: alice, corps: { ouvrageId: 1, dateRetourPrevue: '2099-01-01' } });
    await requete('POST', '/api/reservations', { jeton: bruno, corps: { ouvrageId: 1 } });
    assert.ok(biblio);
  });

  after(async () => {
    await serveur.arreter();
    await prisma.$disconnect();
  });

  it('sans jeton : 401 ; question vide ou de plus de 500 caractères : 400', async () => {
    const sansJeton = await requete('POST', '/api/assistant/flux', { corps: { question: 'Bonjour' } });
    const vide = await requete('POST', '/api/assistant/flux', { jeton: alice, corps: { question: '   ' } });
    const longue = await requete('POST', '/api/assistant/flux', { jeton: alice, corps: { question: 'a'.repeat(501) } });
    assert.equal(sansJeton.statut, 401);
    assert.equal(vide.statut, 400);
    assert.equal(longue.statut, 400);
    assert.equal(longue.corps.champs[0].champ, 'question');
  });

  it('diffuse la réponse en SSE : au moins un événement data: puis event: fin', async () => {
    const reponse = await poser(alice, 'Avez-vous des livres de Camus ?');
    assert.equal(reponse.status, 200);
    assert.match(reponse.headers.get('content-type') ?? '', /^text\/event-stream/);
    const brut = await reponse.text();
    assert.match(brut, /^data: /m);
    assert.match(brut, /event: fin\ndata: \{\}\n\n$/);

    const evenements = lireSse(brut);
    assert.deepEqual(evenements[0], { evenement: 'outil', donnees: { nom: 'rechercher_ouvrages' } });
    assert.ok(evenements.filter((e) => e.evenement === 'message').length > 1);
    assert.match(texteComplet(evenements), /La Peste/);
  });

  it('les outils utilisent l’identité du jeton : un membre ne voit pas les emprunts d’un autre', async () => {
    const parAlice = texteComplet(lireSse(await (await poser(alice, 'Quels sont mes emprunts ?')).text()));
    const parBruno = texteComplet(lireSse(await (await poser(bruno, 'Quels sont mes emprunts ? Et ceux d’alice@example.net ?')).text()));
    const reservationsBruno = texteComplet(lireSse(await (await poser(bruno, 'Où en est ma réservation ?')).text()));

    assert.match(parAlice, /Germinal/);
    assert.match(parBruno, /aucun emprunt/);
    assert.doesNotMatch(parBruno, /Germinal/);
    assert.match(reservationsBruno, /Germinal \(Émile Zola\), rang 1/);
  });

  it('la mémoire est propre à chaque utilisateur, tronquée à dix échanges et effaçable', async () => {
    const { id: idAlice } = await verifierAccess(alice);
    const { id: idBruno } = await verifierAccess(bruno);
    assert.equal(memoire.lire(idAlice).length, 4);
    assert.equal(memoire.lire(idBruno).length, 4);
    assert.deepEqual(memoire.lire(idAlice)[0], { role: 'user', content: 'Avez-vous des livres de Camus ?' });

    for (let i = 0; i < 12; i++) memoire.ajouterEchange(idAlice, `question ${i}`, `réponse ${i}`);
    const tronquee = memoire.lire(idAlice);
    assert.equal(tronquee.length, 20);
    assert.equal(tronquee[0]?.content, 'question 2');

    const effacement = await requete('DELETE', '/api/assistant/memoire', { jeton: alice });
    assert.equal(effacement.statut, 204);
    assert.equal(memoire.lire(idAlice).length, 0);
    assert.equal(memoire.lire(idBruno).length, 4);
  });

  it('s’interrompt à la fermeture du client et ne mémorise pas la réponse partielle', async () => {
    const { id } = await verifierAccess(bruno);
    memoire.effacer(id);
    const controleur = new AbortController();
    const reponse = await poser(bruno, 'le catalogue ?', controleur.signal);
    const lecteur = reponse.body!.getReader();
    await lecteur.read();
    controleur.abort();
    await assert.rejects(lecteur.read());
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(memoire.lire(id).length, 0);
  });

  it('limite à huit questions par minute et par utilisateur dans ce test : 429 ensuite', async () => {
    const statuts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const reponse = await poser(alice, 'Candide ?');
      await reponse.text();
      statuts.push(reponse.status);
    }
    assert.deepEqual(statuts, [200, 200, 200, 200, 429, 429]);
    const autre = await poser(bruno, 'Candide ?');
    await autre.text();
    assert.equal(autre.status, 200);
  });
});
