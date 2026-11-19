import { Router, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { valider } from '../middlewares/valider.ts';
import { utilisateurConnecte } from '../middlewares/auth.ts';
import { questionAssistant } from '../schemas/assistant.ts';
import { ErreurHttp } from '../erreurs.ts';
import { memoire, repondre, type FournisseurIA } from '../services/assistant/index.ts';

function evenementSse(res: Response, donnees: unknown, evenement?: string) {
  res.write(`${evenement ? `event: ${evenement}\n` : ''}data: ${JSON.stringify(donnees)}\n\n`);
}

function journaliserInterruption(utilisateurId: number) {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`${new Date().toISOString()} assistant interrompu par le client utilisateur=${utilisateurId}`);
  }
}

export function creerRouteurAssistant(fournisseur: FournisseurIA, limiteParMinute: number) {
  const routeur = Router();

  const limiteur = rateLimit({
    windowMs: 60 * 1000,
    limit: limiteParMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `utilisateur-${utilisateurConnecte(req).id}`,
    handler: (_req, _res, next) => next(new ErreurHttp(429, "Trop de questions à l'assistant, réessayez dans une minute")),
  });

  routeur.post('/flux', limiteur, valider({ body: questionAssistant }, async ({ body }, req, res) => {
    const utilisateur = utilisateurConnecte(req);
    const controleur = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controleur.abort();
    });

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    try {
      for await (const evenement of repondre(fournisseur, utilisateur, body.question, controleur.signal)) {
        if (evenement.type === 'texte') evenementSse(res, { texte: evenement.texte });
        else evenementSse(res, { nom: evenement.nom }, 'outil');
      }
      if (controleur.signal.aborted) journaliserInterruption(utilisateur.id);
      else evenementSse(res, {}, 'fin');
    } catch (err) {
      if (controleur.signal.aborted) {
        journaliserInterruption(utilisateur.id);
      } else {
        console.error(`Erreur de l'assistant (${fournisseur.nom}) : ${err instanceof Error ? err.name : 'inconnue'}`);
        evenementSse(res, { erreur: "L'assistant est momentanément indisponible" }, 'erreur');
      }
    }
    res.end();
  }));

  routeur.delete('/memoire', (req, res) => {
    memoire.effacer(utilisateurConnecte(req).id);
    res.status(204).end();
  });

  return routeur;
}
