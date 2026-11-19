import { z } from 'zod';

z.config(z.locales.fr());

const ENTIER_MAX = 2147483647;

export const identifiant = z.number({ error: "L'identifiant doit être un nombre" })
  .int("L'identifiant doit être un entier")
  .positive("L'identifiant doit être positif")
  .max(ENTIER_MAX, "L'identifiant est trop grand");

export const identifiantTexte = z.coerce.number({ error: "L'identifiant doit être un nombre" })
  .pipe(identifiant);

export const idParams = z.object({
  id: identifiantTexte.meta({ description: 'Identifiant de la ressource', example: 1 }),
});

export const booleenQuery = z.enum(['true', 'false'], { error: 'Valeur attendue : true ou false' })
  .transform((v) => v === 'true');

export const pagination = {
  page: z.coerce.number().int().min(1).max(100000).default(1).meta({ description: 'Numéro de page, à partir de 1' }),
  limite: z.coerce.number().int().min(1).default(10).transform((v) => Math.min(v, 50))
    .meta({ description: 'Éléments par page, plafonné à 50' }),
};

const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;
export const dateIso = z.string({ error: 'Date ISO 8601 attendue' })
  .regex(ISO, 'Date ISO 8601 attendue (ex. 2026-12-31 ou 2026-12-31T10:00:00Z)')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Date inexistante')
  .transform((v) => new Date(v))
  .meta({ description: 'Date ISO 8601', example: '2026-12-31' });
