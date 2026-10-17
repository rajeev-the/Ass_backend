import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './auth.routes.js';
import authorRoutes from './author.routes.js';
import adminRoutes from './admin.routes.js';
import env from '../config/env.js';

const router = Router();

// GET /api/health
router.get('/health', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';

  const aiStatus = !env.AI_ENABLED || !env.AI_API_KEY ? 'disabled' : 'enabled';

  res.status(200).json({
    status: 'ok',
    db: dbStatus,
    ai: aiStatus,
    timestamp: new Date().toISOString(),
  });
});

// Mount sub-routers
router.use('/auth', authRoutes);
router.use('/me', authorRoutes);
router.use('/admin', adminRoutes);

export default router;
