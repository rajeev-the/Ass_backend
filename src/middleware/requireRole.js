import AppError from '../utils/AppError.js';

export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to access this resource', 403, 'FORBIDDEN')
      );
    }

    next();
  };

export default requireRole;
