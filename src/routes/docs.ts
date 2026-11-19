import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { documentOpenApi } from '../docs/openapi.ts';

export const routeurDocs = Router();

routeurDocs.get('/docs.json', (_req, res) => {
  res.json(documentOpenApi);
});

routeurDocs.use('/docs', swaggerUi.serve, swaggerUi.setup(documentOpenApi, {
  customSiteTitle: 'API Médiathèque',
  swaggerOptions: { persistAuthorization: true },
}));
