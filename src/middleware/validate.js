import AppError from '../utils/AppError.js';

export const validate = (schema) => (req, _res, next) => {
  try {
    if (schema.body && req.body) {
      req.body = schema.body.parse(req.body);
    }
    if (schema.query && req.query) {
      const cleanQuery = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (value !== '') {
          cleanQuery[key] = value;
        }
      }
      const parsed = schema.query.parse(cleanQuery);
      req.validatedQuery = parsed;
      for (const key of Object.keys(req.query)) {
        delete req.query[key];
      }
      Object.assign(req.query, parsed);
    }
    if (schema.params && req.params) {
      const parsed = schema.params.parse(req.params);
      req.validatedParams = parsed;
      Object.assign(req.params, parsed);
    }
    next();
  } catch (error) {
    if (error.issues) {
      const details = error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      const firstMessage = details[0]?.message || 'Validation error';
      return next(new AppError(firstMessage, 400, 'VALIDATION_ERROR', details));
    }
    next(error);
  }
};

export default validate;
