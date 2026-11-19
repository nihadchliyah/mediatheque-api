import type { Message } from './types.ts';

export const ECHANGES_MAX = 10;

const conversations = new Map<number, Message[]>();

export function lire(utilisateurId: number): Message[] {
  return [...(conversations.get(utilisateurId) ?? [])];
}

export function ajouterEchange(utilisateurId: number, question: string, reponse: string) {
  const messages: Message[] = [
    ...lire(utilisateurId),
    { role: 'user', content: question },
    { role: 'assistant', content: reponse },
  ];
  conversations.set(utilisateurId, messages.slice(-ECHANGES_MAX * 2));
}

export function effacer(utilisateurId: number) {
  conversations.delete(utilisateurId);
}
