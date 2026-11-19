import OpenAI from 'openai';
import type { FunctionTool, ResponseFunctionToolCall, ResponseInputItem } from 'openai/resources/responses/responses';
import { z } from 'zod';
import type { Demande, Evenement, FournisseurIA } from './types.ts';

const TOURS_MAX = 4;
const JETONS_SORTIE_MAX = 400;

export class FournisseurOpenAI implements FournisseurIA {
  readonly nom = 'openai';
  readonly client: OpenAI;
  readonly modele: string;

  constructor(cle: string, modele: string) {
    this.client = new OpenAI({ apiKey: cle, maxRetries: 1, timeout: 30_000 });
    this.modele = modele;
  }

  async *diffuser({ systeme, historique, question, outils, signal }: Demande): AsyncGenerator<Evenement> {
    const definitions: FunctionTool[] = outils.map((o) => ({
      type: 'function',
      name: o.nom,
      description: o.description,
      parameters: z.toJSONSchema(o.parametres) as Record<string, unknown>,
      strict: false,
    }));
    const entree: ResponseInputItem[] = [...historique, { role: 'user', content: question }];

    for (let tour = 0; tour < TOURS_MAX; tour++) {
      const flux = await this.client.responses.create({
        model: this.modele,
        instructions: systeme,
        input: entree,
        tools: definitions,
        max_output_tokens: JETONS_SORTIE_MAX,
        stream: true,
      }, { signal });

      const appels: ResponseFunctionToolCall[] = [];

      for await (const evenement of flux) {
        switch (evenement.type) {
          case 'response.output_text.delta':
            yield { type: 'texte', texte: evenement.delta };
            break;
          case 'response.output_item.done':
            if (evenement.item.type === 'function_call') appels.push(evenement.item);
            break;
          case 'response.completed':
          case 'response.incomplete': {
            const usage = evenement.response.usage;
            if (usage) {
              yield { type: 'usage', usage: { entree: usage.input_tokens, sortie: usage.output_tokens, total: usage.total_tokens } };
            }
            break;
          }
          case 'response.failed':
          case 'error':
            throw new Error('Réponse du fournisseur en échec');
        }
      }

      if (appels.length === 0) return;

      for (const appel of appels) {
        yield { type: 'outil', nom: appel.name };
        entree.push(appel, {
          type: 'function_call_output',
          call_id: appel.call_id,
          output: JSON.stringify(await executer(outils, appel)),
        });
      }
    }
  }
}

async function executer(outils: Demande['outils'], appel: ResponseFunctionToolCall): Promise<unknown> {
  const outil = outils.find((o) => o.nom === appel.name);
  if (!outil) return { erreur: `Outil inconnu : ${appel.name}` };
  try {
    return await outil.executer(JSON.parse(appel.arguments || '{}'));
  } catch {
    return { erreur: 'Arguments invalides' };
  }
}
