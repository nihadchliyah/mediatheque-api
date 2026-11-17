export class ErreurHttp extends Error {
  constructor(statut, message, details) {
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
  constructor(message = 'Requête invalide', details) {
    super(400, message, details);
  }
}
