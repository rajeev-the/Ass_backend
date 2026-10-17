import rateLimit from 'express-rate-limit';
import AppError from '../utils/AppError.js';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      new AppError(
        'Too many requests from this IP, please try again after 15 minutes',
        429,
        'RATE_LIMITED'
      )
    );
  },
});

// Login rate limiter disabled for development/testing
export const loginLimiter = (_req, _res, next) => next();

export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      new AppError(
        'AI generation rate limit exceeded, please try again in an hour',
        429,
        'RATE_LIMITED'
      )
    );
  },
});
