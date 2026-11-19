import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { z } from 'zod';
import type { Demande, Evenement, FournisseurIA } from './types.ts';

const TOURS_MAX = 4;

type AppelOutil = { id: string; nom: string; args: string };

export class FournisseurOpenAI implements FournisseurIA {
  readonly nom = 'openai';
  readonly client: OpenAI;
  readonly modele: string;

  constructor(cle: string, modele: string) {
    this.client = new OpenAI({ apiKey: cle, maxRetries: 1, timeout: 30_000 });
    this.modele = modele;
  }

  async *diffuser({ systeme, historique, question, outils, signal }: Demande): AsyncGenerator<Evenement> {
    const definitions: ChatCompletionTool[] = outils.map((o) => ({
      type: 'function',
      function: {
        name: o.nom,
        description: o.description,
        parameters: z.toJSONSchema(o.parametres) as Record<string, unknown>,
      },
    }));
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systeme },
      ...historique,
      { role: 'user', content: question },
    ];

    for (let tour = 0; tour < TOURS_MAX; tour++) {
      const flux = await this.client.chat.completions.create({
        model: this.modele,
        messages,
        tools: definitions,
        stream: true,
        stream_options: { include_usage: true },
      }, { signal });

      const appels: AppelOutil[] = [];
      let texte = '';
      let raisonFin: string | null = null;

      for await (const morceau of flux) {
        if (morceau.usage) {
          const { prompt_tokens: entree, completion_tokens: sortie, total_tokens: total } = morceau.usage;
          yield { type: 'usage', usage: { entree, sortie, total } };
        }
        const choix = morceau.choices[0];
        if (!choix) continue;
        if (choix.delta.content) {
          texte += choix.delta.content;
          yield { type: 'texte', texte: choix.delta.content };
        }
        for (const appel of choix.delta.tool_calls ?? []) {
          const courant = appels[appel.index] ??= { id: '', nom: '', args: '' };
          if (appel.id) courant.id = appel.id;
          if (appel.function?.name) courant.nom += appel.function.name;
          if (appel.function?.arguments) courant.args += appel.function.arguments;
        }
        if (choix.finish_reason) raisonFin = choix.finish_reason;
      }

      if (raisonFin !== 'tool_calls' || appels.length === 0) return;

      messages.push({
        role: 'assistant',
        content: texte || null,
        tool_calls: appels.map((a) => ({ id: a.id, type: 'function', function: { name: a.nom, arguments: a.args } })),
      });
      for (const appel of appels) {
        yield { type: 'outil', nom: appel.nom };
        messages.push({ role: 'tool', tool_call_id: appel.id, content: JSON.stringify(await executer(outils, appel)) });
      }
    }
  }
}

async function executer(outils: Demande['outils'], appel: AppelOutil): Promise<unknown> {
  const outil = outils.find((o) => o.nom === appel.nom);
  if (!outil) return { erreur: `Outil inconnu : ${appel.nom}` };
  try {
    return await outil.executer(JSON.parse(appel.args || '{}'));
  } catch {
    return { erreur: 'Arguments invalides' };
  }
}
