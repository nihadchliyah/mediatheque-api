import { z } from 'zod';

z.config(z.locales.fr());

export const idParams = z.object({
  id: z.coerce.number({ error: "L'identifiant doit être un nombre" })
    .int("L'identifiant doit être un entier")
    .positive("L'identifiant doit être positif"),
});

export const booleenQuery = z.enum(['true', 'false'], { error: 'Valeur attendue : true ou false' })
  .transform((v) => v === 'true');

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).default(10).transform((v) => Math.min(v, 50)),
};

const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;
export const dateIso = z.string({ error: 'Date ISO 8601 attendue' })
  .regex(ISO, 'Date ISO 8601 attendue (ex. 2026-12-31 ou 2026-12-31T10:00:00Z)')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Date inexistante')
  .transform((v) => new Date(v));
