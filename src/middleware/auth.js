import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

export const auth = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication token missing or invalid', 401, 'UNAUTHORIZED'));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new AppError('Authentication token missing', 401, 'UNAUTHORIZED'));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(
        new AppError('User belonging to this token no longer exists', 401, 'UNAUTHORIZED')
      );
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid authentication token', 401, 'UNAUTHORIZED'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Authentication token expired', 401, 'UNAUTHORIZED'));
    }
    next(error);
  }
};

export default auth;
