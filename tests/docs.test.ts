import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { client, demarrer, type Requete, type Serveur } from './aide.ts';

const METHODES = ['get', 'post', 'patch', 'delete'] as const;

describe('Documentation OpenAPI', () => {
  let serveur: Serveur;
  let requete: Requete;

  before(async () => {
    serveur = await demarrer();
    requete = client(serveur.base);
  });

  after(async () => {
    await serveur.arreter();
  });

  it('/api/docs sert Swagger UI sans authentification', async () => {
    const reponse = await fetch(`${serveur.base}/api/docs/`);
    assert.equal(reponse.status, 200);
    assert.match(reponse.headers.get('content-type') ?? '', /text\/html/);
    assert.match(await reponse.text(), /swagger-ui/);
  });

  it('/api/docs.json renvoie une spécification OpenAPI 3.1 valide en JSON', async () => {
    const { statut, entetes, corps } = await requete('GET', '/api/docs.json');
    assert.equal(statut, 200);
    assert.match(entetes.get('content-type') ?? '', /application\/json/);
    assert.equal(corps.openapi, '3.1.0');
    assert.deepEqual(corps.components.securitySchemes.bearerAuth, { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
    for (const chemin of ['/api/auth/connexion', '/api/ouvrages/{id}', '/api/emprunts/{id}/retour', '/api/reservations']) {
      assert.ok(corps.paths[chemin], `chemin documenté : ${chemin}`);
    }
  });

  it('chaque route sous /api, hors connexion, porte bearerAuth et documente 401 et ses erreurs', async () => {
    const { corps } = await requete('GET', '/api/docs.json');
    const publiques = new Set(['/api/auth/inscription', '/api/auth/connexion', '/api/auth/rafraichir']);
    for (const [chemin, operations] of Object.entries<Record<string, any>>(corps.paths)) {
      for (const methode of METHODES) {
        const operation = operations[methode];
        if (!operation) continue;
        assert.ok(operation.summary, `${methode} ${chemin} : résumé`);
        const codes = Object.keys(operation.responses);
        assert.ok(codes.some((c) => c.startsWith('2')), `${methode} ${chemin} : réponse de succès`);
        if (!chemin.startsWith('/api/') || publiques.has(chemin)) continue;
        assert.deepEqual(operation.security, [{ bearerAuth: [] }], `${methode} ${chemin} : sécurité`);
        assert.ok(codes.includes('401'), `${methode} ${chemin} : 401`);
      }
    }
  });
});
