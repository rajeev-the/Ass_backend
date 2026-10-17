export class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details = null) {
    return new AppError(message, 400, 'VALIDATION_ERROR', details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static invalidCredentials(message = 'Invalid email or password') {
    return new AppError(message, 401, 'INVALID_CREDENTIALS');
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message = 'Resource already exists') {
    return new AppError(message, 409, 'CONFLICT');
  }

  static unprocessable(message = 'Invalid status transition') {
    return new AppError(message, 422, 'INVALID_STATUS_TRANSITION');
  }

  static rateLimited(message = 'Too many requests, please try again later') {
    return new AppError(message, 429, 'RATE_LIMITED');
  }

  static aiUnavailable(message = 'AI assistant is currently unavailable') {
    return new AppError(message, 503, 'AI_UNAVAILABLE');
  }
}

export default AppError;
