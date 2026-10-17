import swaggerUi from 'swagger-ui-express';
import env from '../config/env.js';
import { CATEGORIES, PRIORITIES, STATUSES } from '../utils/constants.js';

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'BookLeaf Support Portal API',
    version: '1.0.0',
    description:
      'Backend REST API for the BookLeaf Publishing Author Support Portal, featuring JWT authentication, role-based access control, ticket management, multi-provider AI triage & drafting (Anthropic Claude, OpenAI, Gemini), and real-time Socket.io updates.',
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}`,
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT bearer token in format: Bearer <token>',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
              },
              message: {
                type: 'string',
                example: 'Invalid request payload',
              },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                },
                example: [{ field: 'email', message: 'Invalid email address' }],
              },
            },
            required: ['code', 'message'],
          },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 42 },
          pages: { type: 'integer', example: 3 },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '65f1234567890abcdef12345' },
          role: { type: 'string', enum: ['author', 'admin'], example: 'author' },
          name: { type: 'string', example: 'Priya Sharma' },
          email: { type: 'string', example: 'priya.sharma@email.com' },
          authorCode: { type: 'string', nullable: true, example: 'AUTH001' },
          phone: { type: 'string', nullable: true, example: '+91 98765 43210' },
          city: { type: 'string', nullable: true, example: 'Varanasi' },
          joinedDate: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Book: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '65f1234567890abcdef12346' },
          bookCode: { type: 'string', example: 'BK001' },
          author: { type: 'string', example: '65f1234567890abcdef12345' },
          title: { type: 'string', example: 'Whispers of the Ganges' },
          isbn: { type: 'string', example: '978-81-923456-0-1' },
          genre: { type: 'string', example: 'Literary Fiction' },
          publicationDate: { type: 'string', format: 'date-time', nullable: true },
          status: { type: 'string', example: 'Published & Live' },
          isPublished: { type: 'boolean', example: true },
          productionStageIndex: { type: 'integer', nullable: true, example: 5 },
          mrp: { type: 'number', example: 399 },
          royaltyPerCopy: { type: 'number', example: 59.85 },
          totalCopiesSold: { type: 'integer', example: 1420 },
          totalRoyaltyEarned: { type: 'number', example: 84987 },
          royaltyPaid: { type: 'number', example: 72000 },
          royaltyPending: { type: 'number', example: 12987 },
          lastRoyaltyPayoutDate: { type: 'string', format: 'date-time', nullable: true },
          printPartner: { type: 'string', nullable: true, example: 'Repro Books, Mumbai' },
          availableOn: {
            type: 'array',
            items: { type: 'string' },
            example: ['Amazon.in', 'Flipkart', 'BookLeaf Bookstore', 'Kindle'],
          },
        },
      },
      TicketAuthorView: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          ticketNumber: { type: 'string', example: 'BL-000001' },
          subject: { type: 'string', example: 'Discrepancy in Q3 Royalty Payment' },
          description: { type: 'string' },
          status: { type: 'string', enum: STATUSES, example: 'Open' },
          book: {
            type: 'object',
            nullable: true,
            properties: {
              _id: { type: 'string' },
              title: { type: 'string' },
              isbn: { type: 'string' },
              status: { type: 'string' },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          lastActivityAt: { type: 'string', format: 'date-time' },
          resolvedAt: { type: 'string', format: 'date-time', nullable: true },
          messageCount: { type: 'integer', example: 3 },
        },
      },
      TicketAdminView: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          ticketNumber: { type: 'string', example: 'BL-000001' },
          subject: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: STATUSES },
          category: {
            type: 'object',
            properties: {
              value: { type: 'string', enum: CATEGORIES },
              source: { type: 'string', enum: ['ai', 'fallback', 'admin'] },
              aiValue: { type: 'string', nullable: true },
              confidence: { type: 'number', nullable: true },
            },
          },
          priority: {
            type: 'object',
            properties: {
              value: { type: 'string', enum: PRIORITIES },
              source: { type: 'string', enum: ['ai', 'fallback', 'admin'] },
              aiValue: { type: 'string', nullable: true },
              reason: { type: 'string', nullable: true },
            },
          },
          priorityRank: { type: 'integer', example: 1 },
          ageHours: { type: 'integer', example: 4 },
          ai: {
            type: 'object',
            properties: {
              classificationStatus: { type: 'string', enum: ['pending', 'done', 'failed', 'skipped'] },
              draft: { type: 'string', nullable: true },
              draftStatus: { type: 'string', enum: ['none', 'pending', 'ready', 'failed'] },
              draftGeneratedAt: { type: 'string', format: 'date-time', nullable: true },
              draftBasedOnMessageCount: { type: 'integer' },
              lastError: { type: 'string', nullable: true },
              usage: { type: 'array', items: { type: 'object' } },
            },
          },
          assignedTo: {
            type: 'object',
            nullable: true,
            properties: {
              _id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
          author: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              authorCode: { type: 'string' },
            },
          },
          book: { type: 'object', nullable: true },
          firstResponseAt: { type: 'string', format: 'date-time', nullable: true },
          resolvedAt: { type: 'string', format: 'date-time', nullable: true },
          lastActivityAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          ticket: { type: 'string' },
          sender: {
            type: 'object',
            nullable: true,
            properties: {
              _id: { type: 'string' },
              name: { type: 'string' },
              role: { type: 'string' },
            },
          },
          senderRole: { type: 'string', enum: ['author', 'admin', 'system'] },
          type: { type: 'string', enum: ['reply', 'internal_note', 'system'] },
          body: { type: 'string' },
          usedAiDraft: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'Health Check & Service Status',
        description: 'Returns health status of the API, MongoDB connection, and AI circuit breaker/availability.',
        tags: ['System'],
        responses: {
          200: {
            description: 'API is healthy and running',
            content: {
              'application/json': {
                example: {
                  status: 'ok',
                  db: 'connected',
                  ai: 'fallback_active',
                  timestamp: '2026-10-15T18:25:00.000Z',
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'User Login',
        description: 'Authenticate an author or admin with email and password. Returns a JWT bearer token.',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'priya.sharma@email.com' },
                  password: { type: 'string', example: 'Author@123' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Authentication successful',
            content: {
              'application/json': {
                example: {
                  data: {
                    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                    user: {
                      id: '65f1234567890abcdef12345',
                      name: 'Priya Sharma',
                      email: 'priya.sharma@email.com',
                      role: 'author',
                      authorCode: 'AUTH001',
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          429: { description: 'Rate limit exceeded (10 attempts per 15 min)' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        summary: 'Current User Profile',
        description: 'Retrieve current authenticated user session details.',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Current user profile',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          401: { description: 'Missing or invalid token' },
        },
      },
    },
    '/api/me/books': {
      get: {
        summary: 'Author Books & Financial Summary',
        description: 'Returns all books authored by the logged-in author, along with aggregated royalty metrics.',
        tags: ['Author'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Books list and summary',
            content: {
              'application/json': {
                example: {
                  data: {
                    books: [],
                    summary: {
                      totalEarned: 84987,
                      totalPaid: 72000,
                      totalPending: 12987,
                      publishedCount: 1,
                      inProductionCount: 0,
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden (authors only)' },
        },
      },
    },
    '/api/me/books/{bookId}': {
      get: {
        summary: 'Author Single Book Details',
        description: 'Returns detailed data for a specific book owned by the author.',
        tags: ['Author'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'bookId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Book details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/Book' },
                  },
                },
              },
            },
          },
          404: { description: 'Book not found or belongs to another author' },
        },
      },
    },
    '/api/me/tickets': {
      get: {
        summary: 'List Author Tickets',
        description: 'Returns paginated list of tickets created by the logged-in author. Internal notes and AI metadata are stripped.',
        tags: ['Author'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: STATUSES } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: {
            description: 'Author tickets list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/TicketAuthorView' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create New Support Ticket',
        description: 'Submit a new support ticket. Instant 201 response with local fallback classification; AI runs asynchronously in background.',
        tags: ['Author'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['subject', 'description'],
                properties: {
                  bookId: { type: 'string', nullable: true, example: '65f1234567890abcdef12346' },
                  subject: { type: 'string', minLength: 5, maxLength: 150, example: 'Query regarding Q3 royalty distribution' },
                  description: { type: 'string', minLength: 20, maxLength: 5000, example: 'I have not received my royalty statement for the quarter ending September.' },
                  attachments: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        size: { type: 'number' },
                        mimeType: { type: 'string' },
                        url: { type: 'string', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Ticket created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { $ref: '#/components/schemas/TicketAuthorView' },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error' },
          404: { description: 'Specified bookId does not belong to author' },
        },
      },
    },
    '/api/me/tickets/{id}': {
      get: {
        summary: 'Get Author Ticket by ID',
        description: 'Returns ticket details and public conversation history (excluding internal notes).',
        tags: ['Author'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Ticket and conversation',
            content: {
              'application/json': {
                example: {
                  data: {
                    ticket: {},
                    messages: [],
                  },
                },
              },
            },
          },
          404: { description: 'Ticket not found or belongs to another author' },
        },
      },
    },
    '/api/me/tickets/{id}/messages': {
      post: {
        summary: 'Author Reply / Follow-up Message',
        description: 'Add a reply to an ongoing ticket. Automatically transitions tickets in Resolved state back to Open. Returns 422 if ticket is Closed.',
        tags: ['Author'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['body'],
                properties: {
                  body: { type: 'string', minLength: 1, maxLength: 5000, example: 'Thank you, but could you check my updated bank account details?' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Message sent successfully' },
          422: { description: 'Cannot message on Closed ticket' },
        },
      },
    },
    '/api/admin/tickets': {
      get: {
        summary: 'Admin Ticket Queue',
        description: 'Query and filter support tickets with urgency sorting, pagination, and calculated age in hours.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
          { name: 'assignedTo', in: 'query', schema: { type: 'string' }, description: 'ObjectId, "me", or "unassigned"' },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Fulltext search across subject and description' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['urgency', 'newest', 'oldest'], default: 'urgency' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: {
            description: 'Admin queue results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/TicketAdminView' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/admin/tickets/stats': {
      get: {
        summary: 'Admin Ticket Statistics & Metrics',
        description: 'Aggregate counts across statuses, open ticket priorities, unassigned tickets, overdue 48h tickets, and AI token metrics.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Stats overview',
            content: {
              'application/json': {
                example: {
                  data: {
                    byStatus: { Open: 5, 'In Progress': 1, Resolved: 0, Closed: 0 },
                    byPriority: { Low: 1, Medium: 1, High: 3, Critical: 1 },
                    unassigned: 4,
                    overdue48h: 2,
                    aiFailed: 0,
                    tokens: { input: 1240, output: 430 },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/admin/tickets/{id}': {
      get: {
        summary: 'Admin Single Ticket View',
        description: 'Full ticket data including author details, book details, AI draft and usage metrics, and all messages including internal notes.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Full ticket details',
            content: {
              'application/json': {
                example: {
                  data: {
                    ticket: {},
                    messages: [],
                  },
                },
              },
            },
          },
          404: { description: 'Ticket not found' },
        },
      },
      patch: {
        summary: 'Update Ticket (Status, Priority, Category, Assignment)',
        description: 'Admin modifications. Changing status writes an audit trail system message. Overriding priority or category retains the original AI values.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: STATUSES },
                  category: { type: 'string', enum: CATEGORIES },
                  priority: { type: 'string', enum: PRIORITIES },
                  assignedTo: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Ticket updated successfully' },
          422: { description: 'Invalid status transition (e.g. Closed -> Resolved)' },
        },
      },
    },
    '/api/admin/tickets/{id}/assign-to-me': {
      post: {
        summary: 'Assign Ticket to Current Admin',
        description: 'Self-assign ticket to the currently logged in admin and record a system audit message.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Ticket assigned to current admin' },
        },
      },
    },
    '/api/admin/tickets/{id}/messages': {
      post: {
        summary: 'Post Admin Reply or Internal Note',
        description: 'Admin can send public replies to authors or internal notes visible only to fellow admins. Public replies automatically transition Open tickets to In Progress.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['body', 'type'],
                properties: {
                  body: { type: 'string', minLength: 1, maxLength: 5000 },
                  type: { type: 'string', enum: ['reply', 'internal_note'] },
                  usedAiDraft: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Message posted' },
          422: { description: 'Cannot message on Closed ticket' },
        },
      },
    },
    '/api/admin/tickets/{id}/ai-draft': {
      post: {
        summary: 'Generate or Retrieve AI Draft Response',
        description: 'Returns the cached draft response based on ticket and conversation history. Set ?regenerate=true to force a fresh draft generation. Seamlessly falls back to BookLeaf Knowledge Base rules if no API key is provided.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'regenerate', in: 'query', schema: { type: 'boolean', default: false } },
        ],
        responses: {
          200: {
            description: 'AI Draft response',
            content: {
              'application/json': {
                example: {
                  data: {
                    draft: 'Dear Priya,\n\nThank you for reaching out regarding your royalty statement...',
                    cached: true,
                    status: 'ready',
                  },
                },
              },
            },
          },
          503: { description: 'AI unavailable and fallback failed' },
        },
      },
    },
    '/api/admin/tickets/{id}/reclassify': {
      post: {
        summary: 'Re-run AI Classification',
        description: 'Triggers AI reclassification for category and priority using current ticket context.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Reclassified ticket',
            content: {
              'application/json': {
                example: {
                  data: {
                    category: { value: 'Royalty & Payments', source: 'ai', confidence: 0.95 },
                    priority: { value: 'High', source: 'ai', reason: 'Unpaid financial query' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/admin/authors/{id}': {
      get: {
        summary: 'Admin Author Details with Associated Books',
        description: 'View full profile of an author, including all published and in-production books.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Author profile and book list',
            content: {
              'application/json': {
                example: {
                  data: {
                    author: {},
                    books: [],
                  },
                },
              },
            },
          },
          404: { description: 'Author not found' },
        },
      },
    },
    '/api/admin/ai-config': {
      get: {
        summary: 'Get AI Provider & Key Settings',
        description: 'Check active AI provider (anthropic, openai, gemini), model, enabled status, and whether a runtime API key is configured (masked).',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Current AI Configuration',
            content: {
              'application/json': {
                example: {
                  data: {
                    provider: 'anthropic',
                    model: 'claude-3-haiku-20240307',
                    enabled: true,
                    isConfigured: false,
                    apiKeyConfigured: false,
                  },
                },
              },
            },
          },
        },
      },
      patch: {
        summary: 'Update AI Provider & Key Settings at Runtime',
        description: 'Allows admins to dynamically change the AI provider (Anthropic, OpenAI, Gemini), set the API key, toggle AI on/off, or switch models without restarting the server.',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  provider: { type: 'string', enum: ['anthropic', 'openai', 'gemini'] },
                  model: { type: 'string' },
                  enabled: { type: 'boolean' },
                  apiKey: { type: 'string', example: 'sk-ant-api...' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'AI configuration updated successfully',
          },
          400: { description: 'Validation error' },
        },
      },
    },
  },
};

export const swaggerUiOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'BookLeaf Support Portal API Docs',
};

export { swaggerUi };
