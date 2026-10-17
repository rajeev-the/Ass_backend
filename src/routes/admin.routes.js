import { Router } from 'express';
import adminController from '../controllers/admin.controller.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  adminTicketsQuerySchema,
  updateTicketSchema,
  adminMessageSchema,
  aiConfigSchema,
} from '../validators/admin.schema.js';
import { aiLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// Protect all /admin routes with auth & admin role
router.use(auth);
router.use(requireRole('admin'));

// AI Configuration (Dynamic admin settings)
router.get('/ai-config', adminController.getAiConfig);
router.patch('/ai-config', validate(aiConfigSchema), adminController.updateAiConfig);

// Admin Tickets Queue & Stats (stats before :id parameter)
router.get('/tickets', validate(adminTicketsQuerySchema), adminController.getTickets);
router.get('/tickets/stats', adminController.getStats);
router.get('/tickets/:id', adminController.getTicketById);
router.patch('/tickets/:id', validate(updateTicketSchema), adminController.updateTicket);
router.post('/tickets/:id/assign-to-me', adminController.assignToMe);
router.post('/tickets/:id/messages', validate(adminMessageSchema), adminController.addMessage);

// AI draft and reclassify on specific ticket
router.post('/tickets/:id/ai-draft', aiLimiter, adminController.getAiDraft);
router.post('/tickets/:id/reclassify', adminController.reclassifyTicket);

// Authors details for admin
router.get('/authors/:id', adminController.getAuthorById);

export default router;
