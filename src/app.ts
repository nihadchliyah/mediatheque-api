import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.ts';
import { ErreurHttp } from './erreurs.ts';
import { journal } from './middlewares/journal.ts';
import { authentifier } from './middlewares/auth.ts';
import { gestionnaireErreurs, routeInconnue } from './middlewares/erreurs.ts';
import { routeurAuth } from './routes/auth.ts';
import { routeurOuvrages } from './routes/ouvrages.ts';
import { routeurEmprunts } from './routes/emprunts.ts';

export type OptionsApp = {
  originesAutorisees?: string[];
  limiteAuth?: number;
};

export const limiteur = (fenetreMs: number, limite: number, message: string) => rateLimit({
  windowMs: fenetreMs,
  limit: limite,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => next(new ErreurHttp(429, message)),
});

export function creerApp({ originesAutorisees = config.CORS_ORIGINS, limiteAuth = 10 }: OptionsApp = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(journal);
  app.use(helmet());
  app.use(cors({
    origin: (origine, callback) => {
      if (!origine || originesAutorisees.includes(origine)) return callback(null, true);
      callback(new ErreurHttp(403, 'Origine non autorisée'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(limiteur(60 * 1000, 300, 'Trop de requêtes, réessayez dans une minute'));
  app.use(express.json({ limit: '100kb' }));

  app.get('/sante', (_req, res) => {
    res.json({ statut: 'ok' });
  });
  app.use('/api/auth', limiteur(15 * 60 * 1000, limiteAuth, 'Trop de tentatives, réessayez dans 15 minutes'), routeurAuth);
  app.use('/api/ouvrages', authentifier, routeurOuvrages);
  app.use('/api/emprunts', authentifier, routeurEmprunts);

  app.use(routeInconnue);
  app.use(gestionnaireErreurs);

  return app;
}
