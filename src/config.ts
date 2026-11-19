import 'dotenv/config';
import { z } from 'zod';

const secret = z.string().min(32, 'doit contenir au moins 32 caractères');

const schema = z.object({
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: secret,
  JWT_REFRESH_SECRET: secret,
  JWT_ACCESS_DUREE: z.string().default('15m'),
  REFRESH_DUREE_JOURS: z.coerce.number().int().positive().default(7),
  CORS_ORIGINS: z.string().default('')
    .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean)),
  BCRYPT_COUT: z.coerce.number().int().min(12).default(12),
  IA_FOURNISSEUR: z.enum(['bouchon', 'openai']).default('bouchon'),
  OPENAI_API_KEY: z.string().optional().transform((v) => v || undefined),
  OPENAI_MODELE: z.string().min(1).default('gpt-4.1-mini'),
}).refine((c) => c.IA_FOURNISSEUR !== 'openai' || Boolean(c.OPENAI_API_KEY), {
  message: 'est obligatoire quand IA_FOURNISSEUR=openai',
  path: ['OPENAI_API_KEY'],
});

const resultat = schema.safeParse(process.env);
if (!resultat.success) {
  const champs = resultat.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(', ');
  throw new Error(`Configuration invalide : ${champs}`);
}

export const config = resultat.data;
export type Config = typeof config;
