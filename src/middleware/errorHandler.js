import env from '../config/env.js';

export const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || null;

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = `Resource not found with id: ${err.value}`;
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'CONFLICT';
    const fields = Object.keys(err.keyValue || {});
    message = `Duplicate value for field: ${fields.join(', ')}`;
    details = fields.map((f) => ({ field: f, message: `${f} already exists` }));
  }

  // Handle JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Authentication token expired';
  }

  if (statusCode >= 500 && env.NODE_ENV !== 'test') {
    console.error('Unhandled Server Error:', err);
  }

  const responseBody = {
    error: {
      code: errorCode,
      message,
      ...(details ? { details } : {}),
      ...(env.NODE_ENV === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
    },
  };

  res.status(statusCode).json(responseBody);
};

export default errorHandler;
