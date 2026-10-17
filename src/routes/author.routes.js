import { Router } from 'express';
import authorController from '../controllers/author.controller.js';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  createTicketSchema,
  authorMessageSchema,
  authorTicketsQuerySchema,
} from '../validators/author.schema.js';

const router = Router();

// Protect all /me routes with auth & author role
router.use(auth);
router.use(requireRole('author'));

// Books
router.get('/books', authorController.getBooks);
router.get('/books/:bookId', authorController.getBookById);

// Tickets
router.get('/tickets', validate(authorTicketsQuerySchema), authorController.getTickets);
router.post('/tickets', validate(createTicketSchema), authorController.createTicket);
router.get('/tickets/:id', authorController.getTicketById);
router.post('/tickets/:id/messages', validate(authorMessageSchema), authorController.addMessage);

export default router;
