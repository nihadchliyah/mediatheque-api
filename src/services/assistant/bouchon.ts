import { setTimeout as attendre } from 'node:timers/promises';
import type { Demande, Evenement, FournisseurIA } from './types.ts';

type Ouvrage = { titre: string; auteur: string; annee?: number; disponible?: boolean };
type Choix = { nom: string; args: Record<string, unknown> };
type Resultat = {
  ouvrages?: Ouvrage[];
  emprunts?: (Ouvrage & { retourPrevu: string })[];
  reservations?: (Ouvrage & { rang: number })[];
};

const MOTS_VIDES = new Set([
  'avez', 'vous', 'des', 'les', 'livre', 'livres', 'ouvrage', 'ouvrages', 'quel', 'quels', 'quelle', 'quelles',
  'est', 'sont', 'disponible', 'disponibles', 'cherche', 'trouve', 'auteur', 'catalogue', 'une', 'pour',
  'dans', 'avec', 'sur', 'par', 'qui', 'que', 'quoi', 'mais', 'merci', 'bonjour', 'peux', 'pouvez', 'tu',
]);

const estimerJetons = (texte: string) => Math.ceil(texte.length / 4);

function motCle(question: string): string | undefined {
  const mots = question.split(/[^\p{L}\p{N}]+/u).filter((m) => m.length >= 3 && !MOTS_VIDES.has(m.toLowerCase()));
  const nomPropre = mots.find((m, i) => i > 0 && /^\p{Lu}/u.test(m));
  return nomPropre ?? [...mots].sort((a, b) => b.length - a.length)[0];
}

function choisir(question: string): Choix {
  if (/r.?serv/i.test(question)) return { nom: 'mes_reservations', args: {} };
  if (/emprunt|rendre|retour/i.test(question)) return { nom: 'mes_emprunts', args: {} };
  const recherche = motCle(question);
  return {
    nom: 'rechercher_ouvrages',
    args: { ...(recherche && { recherche }), ...(/disponible/i.test(question) && { disponible: true }) },
  };
}

function rediger({ nom, args }: Choix, resultat: Resultat): string {
  if (nom === 'mes_emprunts') {
    const emprunts = resultat.emprunts ?? [];
    if (emprunts.length === 0) return "Vous n'avez aucun emprunt en cours.";
    return `Vous avez ${emprunts.length} emprunt(s) en cours :\n`
      + emprunts.map((e) => `- ${e.titre} (${e.auteur}), retour prévu le ${e.retourPrevu}`).join('\n');
  }
  if (nom === 'mes_reservations') {
    const reservations = resultat.reservations ?? [];
    if (reservations.length === 0) return "Vous n'avez aucune réservation en attente.";
    return `Vous avez ${reservations.length} réservation(s) :\n`
      + reservations.map((r) => `- ${r.titre} (${r.auteur}), rang ${r.rang} dans la file`).join('\n');
  }
  const ouvrages = resultat.ouvrages ?? [];
  const critere = args.recherche ? ` pour « ${String(args.recherche)} »` : '';
  if (ouvrages.length === 0) return `Je n'ai trouvé aucun ouvrage${critere}.`;
  return `Voici ${ouvrages.length} ouvrage(s)${critere} :\n`
    + ouvrages.map((o) => `- ${o.titre} (${o.auteur}, ${o.annee}) : ${o.disponible ? 'disponible' : 'emprunté'}`).join('\n');
}

export class FournisseurBouchon implements FournisseurIA {
  readonly nom = 'bouchon';
  readonly delaiMs: number;

  constructor(delaiMs = 20) {
    this.delaiMs = delaiMs;
  }

  async *diffuser({ systeme, historique, question, outils, signal }: Demande): AsyncGenerator<Evenement> {
    const choix = choisir(question);
    const outil = outils.find((o) => o.nom === choix.nom);
    if (!outil) throw new Error(`Outil ${choix.nom} indisponible`);

    yield { type: 'outil', nom: outil.nom };
    const resultat = await outil.executer(choix.args);
    const texte = `[Mode bouchon] ${rediger(choix, resultat as Resultat)}`;

    for (const morceau of texte.split(/(?<=\s)/)) {
      try {
        await attendre(this.delaiMs, undefined, { signal });
      } catch {
        return;
      }
      yield { type: 'texte', texte: morceau };
    }

    const entree = estimerJetons(systeme + historique.map((m) => m.content).join('') + question);
    const sortie = estimerJetons(texte);
    yield { type: 'usage', usage: { entree, sortie, total: entree + sortie } };
  }
}
