import { z } from 'zod';

export const questionAssistant = z.object({
  question: z.string().trim()
    .min(1, 'La question est obligatoire')
    .max(500, '500 caractères maximum')
    .meta({ example: 'Quels livres de Camus sont disponibles ?' }),
}).meta({ id: 'QuestionAssistant' });
