export type DetailChamp = { champ: string; message: string };

export class ErreurHttp extends Error {
  readonly statut: number;
  readonly details?: DetailChamp[];

  constructor(statut: number, message: string, details?: DetailChamp[]) {
    super(message);
    this.name = 'ErreurHttp';
    this.statut = statut;
    this.details = details;
  }
}

export class NonTrouve extends ErreurHttp {
  constructor(message = 'Ressource introuvable') {
    super(404, message);
  }
}

export class Conflit extends ErreurHttp {
  constructor(message = 'Conflit') {
    super(409, message);
  }
}

export class RequeteInvalide extends ErreurHttp {
  constructor(message = 'Requête invalide', details?: DetailChamp[]) {
    super(400, message, details);
  }
}
