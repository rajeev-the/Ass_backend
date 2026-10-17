import { z } from 'zod';
import {
  STATUSES,
  CATEGORIES,
  PRIORITIES,
  normalizeStatus,
  normalizeCategory,
  normalizePriority,
} from '../utils/constants.js';

const emptyToUndefined = (schema) =>
  z.preprocess((val) => (val === '' ? undefined : val), schema);

export const adminTicketsQuerySchema = {
  query: z.object({
    status: z.preprocess((val) => normalizeStatus(val), z.enum(STATUSES).optional()),
    category: z.preprocess((val) => normalizeCategory(val), z.enum(CATEGORIES).optional()),
    priority: z.preprocess((val) => normalizePriority(val), z.enum(PRIORITIES).optional()),
    assignedTo: emptyToUndefined(z.string().optional()),
    from: emptyToUndefined(z.string().optional()),
    to: emptyToUndefined(z.string().optional()),
    q: emptyToUndefined(z.string().optional()),
    sort: emptyToUndefined(z.enum(['urgency', 'oldest', 'newest']).optional().default('urgency')),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
};

export const updateTicketSchema = {
  body: z
    .object({
      status: z.preprocess((val) => normalizeStatus(val), z.enum(STATUSES).optional()),
      category: z.preprocess((val) => normalizeCategory(val), z.enum(CATEGORIES).optional()),
      priority: z.preprocess((val) => normalizePriority(val), z.enum(PRIORITIES).optional()),
      assignedTo: z.string().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field to update must be provided',
    }),
};

export const adminMessageSchema = {
  body: z.object({
    body: z
      .string({ required_error: 'Message body is required' })
      .trim()
      .min(1, 'Message cannot be empty')
      .max(10000, 'Message cannot exceed 10000 characters'),
    type: z.enum(['reply', 'internal_note'], {
      required_error: "Type must be either 'reply' or 'internal_note'",
    }),
    usedAiDraft: z.boolean().optional().default(false),
  }),
};

export const aiConfigSchema = {
  body: z.object({
    provider: z.enum(['anthropic', 'openai', 'gemini']).optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
    enabled: z.boolean().optional(),
    timeoutMs: z.coerce.number().positive().optional(),
    maxRetries: z.coerce.number().int().min(0).max(3).optional(),
  }),
};

export default {
  adminTicketsQuerySchema,
  updateTicketSchema,
  adminMessageSchema,
  aiConfigSchema,
};
