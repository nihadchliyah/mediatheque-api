import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { client, demarrer, prisma, reinitialiserBase } from './aide.js';

describe('Durcissement', () => {
  let serveur;
  let requete;

  before(async () => {
    await reinitialiserBase();
    serveur = await demarrer({ originesAutorisees: ['http://localhost:5173'] });
    requete = client(serveur.base);
  });

  after(async () => {
    await serveur.arreter();
    await prisma.$disconnect();
  });

  it('en-têtes helmet présents et technologie masquée', async () => {
    const { entetes } = await requete('GET', '/sante');
    assert.equal(entetes.get('x-content-type-options'), 'nosniff');
    assert.ok(entetes.get('content-security-policy'));
    assert.ok(entetes.get('strict-transport-security'));
    assert.equal(entetes.get('x-powered-by'), null);
  });

  it('CORS : origine déclarée acceptée, origine non déclarée refusée', async () => {
    const autorisee = await requete('GET', '/sante', { entetes: { Origin: 'http://localhost:5173' } });
    assert.equal(autorisee.entetes.get('access-control-allow-origin'), 'http://localhost:5173');

    const refusee = await requete('GET', '/sante', { entetes: { Origin: 'https://pirate.example' } });
    assert.equal(refusee.statut, 403);
    assert.equal(refusee.entetes.get('access-control-allow-origin'), null);
  });

  it('corps JSON limité à 100 Ko', async () => {
    const { statut } = await requete('POST', '/api/auth/inscription', {
      corps: { email: 'gros@example.net', motDePasse: 'x'.repeat(110 * 1024) },
    });
    assert.equal(statut, 413);
  });

  it('route inconnue : 404 en JSON sans détail technique', async () => {
    const { statut, corps } = await requete('GET', '/nimporte');
    assert.equal(statut, 404);
    assert.deepEqual(corps, { erreur: 'Route inconnue' });
  });

  it('limitation de débit : 429 à la onzième tentative sur /api/auth', async () => {
    const tentative = () => requete('POST', '/api/auth/connexion', {
      corps: { email: 'inconnu@example.net', motDePasse: 'Mauvais-Mot-2026' },
    });
    for (let i = 1; i <= 10; i += 1) {
      assert.equal((await tentative()).statut, 401, `tentative ${i}`);
    }
    const onzieme = await tentative();
    assert.equal(onzieme.statut, 429);
    assert.ok(!JSON.stringify(onzieme.corps).includes('at '));
  });
});
