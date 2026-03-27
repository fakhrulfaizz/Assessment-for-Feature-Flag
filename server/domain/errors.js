export class DomainError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  constructor(message, details = null) {
    super(400, message, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(message, details = null) {
    super(404, message, details);
  }
}

export class ConflictError extends DomainError {
  constructor(message, details = null) {
    super(409, message, details);
  }
}
