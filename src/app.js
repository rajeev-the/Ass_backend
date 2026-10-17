import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import env from './config/env.js';
import routes from './routes/index.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimiters.js';

import { swaggerUi, swaggerSpec, swaggerUiOptions } from './docs/swagger.js';

const app = express();

// Security headers (relaxed CSP for Swagger UI)
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// Serve Swagger API documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// CORS configuration
const allowedOrigins = [env.CLIENT_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile, Postman) or matching frontend origins
      if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// HTTP request logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

// Body parsers
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Sanitize query and body against NoSQL injection (Express 5 compatible)
app.use((req, _res, next) => {
  if (req.body) {
    mongoSanitize.sanitize(req.body);
  }
  if (req.params) {
    mongoSanitize.sanitize(req.params);
  }
  if (req.query) {
    mongoSanitize.sanitize(req.query);
  }
  next();
});

// Apply global rate limiting to all API routes
app.use('/api', globalLimiter);

// Mount API routes
app.use('/api', routes);

// 404 handler for unknown routes
app.use(notFound);

// Central error handler
app.use(errorHandler);

export default app;
