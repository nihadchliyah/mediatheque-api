import express from 'express';
import { journal } from './middlewares/journal.js';
import { gestionnaireErreurs, routeInconnue } from './middlewares/erreurs.js';
import { routeurOuvrages } from './routes/ouvrages.js';
import { routeurEmprunts } from './routes/emprunts.js';

export const app = express();

app.disable('x-powered-by');
app.use(journal);
app.use(express.json());

app.get('/sante', (_req, res) => res.json({ statut: 'ok' }));
app.use('/api/ouvrages', routeurOuvrages);
app.use('/api/emprunts', routeurEmprunts);

app.use(routeInconnue);
app.use(gestionnaireErreurs);
