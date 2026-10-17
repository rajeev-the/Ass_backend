import { z } from 'zod';
import { STATUSES, normalizeStatus } from '../utils/constants.js';

export const createTicketSchema = {
  body: z.object({
    bookId: z.string().nullable().optional(),
    subject: z
      .string({ required_error: 'Subject is required' })
      .trim()
      .min(5, 'Subject must be at least 5 characters')
      .max(150, 'Subject cannot exceed 150 characters'),
    description: z
      .string({ required_error: 'Description is required' })
      .trim()
      .min(20, 'Description must be at least 20 characters')
      .max(5000, 'Description cannot exceed 5000 characters'),
    attachments: z
      .array(
        z.object({
          name: z.string().min(1, 'Attachment name is required'),
          size: z.number().nonnegative().optional().default(0),
          mimeType: z.string().optional().default('application/octet-stream'),
          url: z.string().nullable().optional().default(null),
        })
      )
      .optional()
      .default([]),
  }),
};

export const authorMessageSchema = {
  body: z.object({
    body: z
      .string({ required_error: 'Message body is required' })
      .trim()
      .min(1, 'Message cannot be empty')
      .max(10000, 'Message cannot exceed 10000 characters'),
  }),
};


export const authorTicketsQuerySchema = {
  query: z.object({
    status: z.preprocess((val) => normalizeStatus(val), z.enum(STATUSES).optional()),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

export default {
  createTicketSchema,
  authorMessageSchema,
  authorTicketsQuerySchema,
};
