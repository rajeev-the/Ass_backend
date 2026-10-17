# BookLeaf Support Portal — Backend API

Production-ready backend API service for the **BookLeaf Publishing Author Support Portal**, built with **Node.js 20+**, **Express 5**, **MongoDB (Mongoose)**, **Socket.io**, and an AI triage & drafting engine supporting **Anthropic Claude**, **OpenAI**, and **Google Gemini** with an offline Knowledge Base fallback.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Architecture & Project Structure](#architecture--project-structure)
4. [Getting Started & Local Setup](#getting-started--local-setup)
5. [Default Seed Credentials](#default-seed-credentials)
6. [API Documentation (Swagger)](#api-documentation-swagger)
7. [AI Strategy & Multi-Provider Architecture](#ai-strategy--multi-provider-architecture)
8. [Real-time WebSocket Events](#real-time-websocket-events)
9. [Security & RBAC Enforcement](#security--rbac-enforcement)
10. [Error Handling & API Contract](#error-handling--api-contract)
11. [Testing & Verification](#testing--verification)
12. [Deployment Guide](#deployment-guide)

---

## 1. Features

- **Robust Role-Based Access Control (RBAC):** Strict boundaries between `author` and `admin`. Authors can only see their own books and tickets. Internal notes and AI triage internals are strictly isolated from authors.
- **Normalized Data Architecture:** 10 authors, 18 books, and demo tickets seeded directly from the provided sample dataset. Atomic ticket numbering (`BL-000001` format via counters collection).
- **Author Portal Operations:**
  - View published & in-production books with automated royalty calculations (total earned, paid, and pending).
  - Create support tickets with instant 201 response.
  - Public reply threads with automated reopening of `Resolved` tickets upon author follow-up.
- **Admin Support Operations:**
  - Ticket queue with multi-criteria filtering (`status`, `category`, `priority`, `assignedTo`, `date range`, `fulltext query`).
  - Urgency-based sorting: Unresolved tickets first → Highest priority first → Oldest created first.
  - Calculated ticket `ageHours` and 48h SLA overdue alerts.
  - Status transition state machine (`Open`, `In Progress`, `Resolved`, `Closed`) with automated audit trail system messages.
  - Private internal notes visible only to admins.
  - Self-assignment and automated transition from `Open` to `In Progress` on first admin reply.
- **AI Triage & Draft Engine:**
  - Asynchronous background pipeline on ticket submission (never blocks ticket creation).
  - Classifies into 6 domain categories and 4 priority levels with reasoning and confidence scores.
  - Generates context-aware, empathetic draft responses using author book context and the verbatim BookLeaf Publishing Knowledge Base.
  - **Dynamic Multi-Provider Support:** Switch between Anthropic, OpenAI, or Google Gemini at runtime.
  - **Zero-Dependency Offline Fallback:** Fully functional even without an API key or when offline, utilizing rule-based classification and templated knowledge-base drafting.
- **Real-time Synchronization:** Socket.io rooms per author, per ticket, and a dedicated admin room for live queue updates, replies, and status changes.

---

## 2. Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Runtime** | Node.js 20+ (ES Modules) | High performance JavaScript runtime |
| **Framework** | Express 5 | Next-generation web framework with native async error handling |
| **Database** | MongoDB + Mongoose 8 | Document database with schema validation & atomic counters |
| **Local Fallback DB** | `mongodb-memory-server` | Zero-configuration local database when standalone Mongo isn't running |
| **Authentication** | JWT (`jsonwebtoken`) + `bcryptjs` | Stateless Bearer token authentication with password hashing |
| **Validation** | Zod | Strictly validated request bodies, queries, and environment variables |
| **Real-time** | Socket.io 4 | Bidirectional event-driven communication |
| **Security** | Helmet, CORS, Rate Limiters, Mongo Sanitize | Defense in depth against common web vulnerabilities |
| **API Docs** | Swagger UI (`swagger-ui-express`) | Interactive OpenAPI 3.0 documentation at `/api/docs` |
| **Testing** | Node.js Native Test Runner (`node:test`, `supertest`) | Zero-dependency fast integration test suites |

---

## 3. Architecture & Project Structure

The project strictly follows layered architecture:
`Routes → Middleware → Controllers → Services → Models`.

```
Backend/
├── seed/
│   ├── bookleaf_sample_data.json   # Full sample dataset (10 authors, 18 books)
│   └── seed.js                     # Idempotent DB seeder
├── src/
│   ├── config/
│   │   ├── env.js                  # Zod-validated environment config
│   │   └── db.js                   # Mongoose connection with MongoMemoryServer fallback
│   ├── constants/
│   │   └── (referenced via utils)
│   ├── controllers/
│   │   ├── admin.controller.js     # Admin tickets, stats, triage & AI config endpoints
│   │   ├── auth.controller.js      # Login and me endpoints
│   │   └── author.controller.js    # Books and author ticket management
│   ├── docs/
│   │   └── swagger.js              # Complete OpenAPI 3.0 specification
│   ├── middleware/
│   │   ├── auth.js                 # JWT bearer token verification
│   │   ├── errorHandler.js         # Central error handler with standardized envelope
│   │   ├── notFound.js             # 404 handler
│   │   ├── rateLimiters.js         # Rate limiting for auth, AI, and global routes
│   │   ├── requireRole.js          # Role-based access control (admin / author)
│   │   └── validate.js             # Express 5 compatible Zod request validator
│   ├── models/
│   │   ├── Book.js                 # Book schema with production stage & royalty fields
│   │   ├── Counter.js              # Atomic sequence generator for ticket IDs
│   │   ├── Message.js              # Ticket conversation messages (replies, notes, system)
│   │   ├── Setting.js              # Dynamic system configuration (AI provider, keys)
│   │   ├── Ticket.js               # Core ticket schema with triage, AI draft & metrics
│   │   └── User.js                 # User schema (author & admin)
│   ├── realtime/
│   │   └── socket.js               # Socket.io server and broadcast emit helpers
│   ├── routes/
│   │   ├── admin.routes.js         # /api/admin/*
│   │   ├── auth.routes.js          # /api/auth/*
│   │   ├── author.routes.js        # /api/me/*
│   │   └── index.js                # Base router mounting
│   ├── services/
│   │   ├── ai/
│   │   │   ├── aiClient.js         # Multi-provider client (Anthropic, OpenAI, Gemini) + Circuit Breaker
│   │   │   ├── classifier.js       # Live LLM categorization & prioritization
│   │   │   ├── contextBuilder.js   # Author, book & royalty context assembly
│   │   │   ├── drafter.js          # AI draft response generator with caching
│   │   │   ├── fallbackClassifier.js# Deterministic keyword & ISBN rule classifier
│   │   │   ├── knowledgeBase.js    # Verbatim BookLeaf publishing guidelines & rules
│   │   │   ├── pipeline.js         # Asynchronous non-blocking background triage pipeline
│   │   │   └── prompts.js          # Few-shot, token-conscious system prompts
│   │   ├── auth.service.js         # User authentication & token issuance
│   │   ├── book.service.js         # Author book queries & summary calculations
│   │   ├── royalty.service.js      # Royalty payout dates, threshold & quarter math
│   │   └── ticket.service.js       # Ticket lifecycle, visibility rules, transitions & messaging
│   ├── utils/
│   │   ├── AppError.js             # Custom operational error class
│   │   ├── asyncHandler.js         # Async wrapper for route handlers
│   │   ├── constants.js            # Enums (categories, statuses, priorities, models)
│   │   └── ticketNumber.js         # Atomic ticket sequence formatter
│   ├── app.js                      # Express app setup and middleware pipeline
│   └── index.js                    # HTTP server initialization and Socket.io binding
├── tests/
│   ├── ai.test.js                  # AI fallback, KB drafting & circuit breaker tests
│   ├── foundation.test.js          # Auth, RBAC, health check, docs & error tests
│   └── tickets.test.js             # Ticket CRUD, status transitions, visibility tests
├── .env.example
├── package.json
└── README.md
```

---

## 4. Getting Started & Local Setup

### Prerequisites
- Node.js 20.x or higher
- npm 9.x or higher
- (Optional) Local or remote MongoDB instance. If no MongoDB is running, the server **automatically starts an in-memory MongoDB instance** so you can test immediately with zero setup!

### 1. Clone & Install Dependencies
```bash
cd Backend
npm install
```

### 2. Configure Environment Variables
Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

Default `.env` configuration:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/bookleaf
JWT_SECRET=super_strong_bookleaf_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173

# AI Settings (Optional - works 100% offline without keys!)
AI_PROVIDER=anthropic
AI_API_KEY=
AI_MODEL=claude-3-haiku-20240307
AI_TIMEOUT_MS=15000
AI_MAX_RETRIES=1
AI_ENABLED=false
```

### 3. Seed Database
Seed 10 authors, 18 books, 2 admins, and 6 sample tickets:
```bash
npm run seed
```

### 4. Start Development Server
```bash
npm run dev
```
The server will start on `http://localhost:5000`.

---

## 5. Default Seed Credentials

All accounts are created during `npm run seed`:

| Role | Email | Password | Details |
|---|---|---|---|
| **Admin** | `admin@bookleaf.com` | `Admin@123` | Ops Admin |
| **Admin** | `support@bookleaf.com` | `Admin@123` | Support Agent |
| **Author** | `priya.sharma@email.com` | `Author@123` | Priya Sharma (`AUTH001`) |
| **Author** | `rohit.kapoor@email.com` | `Author@123` | Rohit Kapoor (`AUTH002`) |
| **Author** | `ananya.reddy@email.com` | `Author@123` | Ananya Reddy (`AUTH003`) |
| **Author** | `vikram.joshi@email.com` | `Author@123` | Vikram Joshi (`AUTH004`) |
| **Author** | `meera.nair@email.com` | `Author@123` | Meera Nair (`AUTH005`) |
| **Author** | `arjun.malhotra@email.com` | `Author@123` | Arjun Malhotra (`AUTH006`) |
| **Author** | `sneha.kulkarni@email.com` | `Author@123` | Sneha Kulkarni (`AUTH007`) |
| **Author** | `farhan.sheikh@email.com` | `Author@123` | Farhan Sheikh (`AUTH008`) |
| **Author** | `kavita.deshmukh@email.com` | `Author@123` | Kavita Deshmukh (`AUTH009`) |
| **Author** | `diya.chatterjee@email.com` | `Author@123` | Diya Chatterjee (`AUTH010`) |

---

## 6. API Documentation (Swagger)

Interactive OpenAPI 3.0 documentation is available directly in the browser:
👉 **[http://localhost:5000/api/docs](http://localhost:5000/api/docs)**

Click **Authorize** at the top right of the Swagger UI and enter `Bearer <your_token>` to test authenticated endpoints directly.

---

## 7. AI Strategy & Multi-Provider Architecture

### 7.1 Zero-Block Background Pipeline
1. When an author submits `POST /api/me/tickets`, the backend applies deterministic fallback classification immediately and returns `201 Created` within ~20ms.
2. The AI triage pipeline runs asynchronously in the background. It classifies the ticket, updates `priority` and `category` (retaining fallback/original values in `aiValue`), generates an initial draft, and broadcasts a `ticket:draft_ready` Socket.io event to admins.
3. If the AI service is disabled or encounters network errors, the ticket remains fully operational with its deterministic fallback triage.

### 7.2 Multi-Provider Support & Runtime Switching
The backend supports three premier AI providers out of the box:
- **Anthropic Claude:** `claude-3-haiku-20240307`, `claude-3-5-sonnet-20241022`
- **OpenAI:** `gpt-4o-mini`, `gpt-4o`
- **Google Gemini:** `gemini-1.5-flash`, `gemini-1.5-pro`

Admins can inspect or change the active provider and API key directly via REST endpoints without restarting the server:
- `GET /api/admin/ai-config`: View current provider, model, and whether an API key is configured.
- `PATCH /api/admin/ai-config`: Dynamically update provider (`anthropic`, `openai`, `gemini`), model, enabled state, and API key.

### 7.3 Offline Knowledge Base Fallback
If `AI_ENABLED=false` or no API key is provided, the backend engages an intelligent offline fallback engine:
- Evaluates ticket subject and body against the verbatim BookLeaf Knowledge Base (royalty minimum payout ₹1,000 threshold, quarterly schedule, ISBN distribution, cover review cycle, and author copies).
- Computes exact mathematical facts from the database (e.g. pending royalties, payout eligibility).
- Drafts a complete, polite response signed off as *BookLeaf Author Support Team*.

### 7.4 Cost & Token Optimization
- **Concise System Prompts:** Structured with few-shot examples and minimal token overhead.
- **Message-Count Draft Caching:** AI drafts are cached against the ticket's message count. Fetching a draft multiple times does not trigger new LLM calls unless new messages have arrived or the admin explicitly passes `?regenerate=true`.
- **Token Usage Accounting:** Token counts (`inputTokens`, `outputTokens`, `latencyMs`) are tracked in the database and summarized in `GET /api/admin/tickets/stats`.
- **Circuit Breaker:** Automatically trips after 3 consecutive failures to prevent cascading latency and runaway billing, resetting after a 60-second cooldown.

---

## 8. Real-time WebSocket Events

Connect to Socket.io at `ws://localhost:5000` with JWT auth in query or headers:
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: 'YOUR_JWT_TOKEN' },
});
```

### Rooms
- `user:<userId>`: Joined automatically by the authenticated user.
- `ticket:<ticketId>`: Joined when viewing a specific ticket thread.
- `admins`: Automatically joined by admin users for real-time queue updates.

### Broadcast Events
| Event | Room | Payload | Description |
|---|---|---|---|
| `ticket:created` | `admins` | `{ ticket }` | Emitted when a new ticket is submitted |
| `ticket:updated` | `admins`, `ticket:<id>`, `user:<authorId>` | `{ ticket }` | Emitted on status, priority, or category changes |
| `ticket:draft_ready` | `admins` | `{ ticketId, draft }` | Emitted when background AI completes draft generation |
| `message:created` | `ticket:<id>`, `user:<authorId>` (public only) | `{ ticketId, message }` | Emitted on new reply or internal note (internal notes never sent to authors) |

---

## 9. Security & RBAC Enforcement

- **Strict Visibility Boundary:** Internal notes (`type: 'internal_note'`), AI confidence scores, and raw usage data are stripped before returning ticket payloads to authors.
- **Defense Against Enumeration:** Authors attempting to access another author's ticket or book receive a generic `404 NOT_FOUND` rather than a `403 FORBIDDEN` to prevent resource ID enumeration.
- **NoSQL Injection Sanitization:** `express-mongo-sanitize` scrubs all `$` and `.` operators from `req.body`, `req.query`, and `req.params`.
- **Rate Limiting:**
  - Login route: Maximum 10 failed/successful attempts per 15 minutes per IP.
  - AI regeneration route: Maximum 20 requests per hour per admin.
  - Global API: 300 requests per 15 minutes per IP.
- **Payload Constraints:** Strict 100kb body limit on all endpoints.

---

## 10. Error Handling & API Contract

All responses conform to a predictable envelope:

### Success Response
```json
{
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 12, "pages": 1 }
}
```

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      { "field": "subject", "message": "Subject must be at least 5 characters" }
    ]
  }
}
```

### Standard Error Codes
- `VALIDATION_ERROR` (400): Schema validation failure.
- `INVALID_CREDENTIALS` (401): Incorrect email or password.
- `UNAUTHORIZED` (401): Missing or malformed JWT token.
- `FORBIDDEN` (403): Insufficient role permissions.
- `NOT_FOUND` (404): Resource not found.
- `INVALID_STATUS_TRANSITION` (422): Disallowed state machine transition.
- `RATE_LIMITED` (429): Rate threshold exceeded.
- `AI_UNAVAILABLE` (503): Circuit breaker open or AI provider unreachable.
- `INTERNAL_ERROR` (500): Unhandled server exception (stack trace never leaked in production).

---

## 11. Testing & Verification

The test suite runs using Node.js's native test runner (`node:test`) and `supertest`:

```bash
# Run all test suites
npm test

# Run linter
npm run lint

# Format code
npm run format
```

### Test Coverage
- **Foundation Suite (`tests/foundation.test.js`):** Health check, 404 handler, login validation, credential verification, JWT issuance, `/auth/me` inspection, Swagger UI documentation endpoint.
- **Tickets & Books Suite (`tests/tickets.test.js`):** Author book aggregation, author ticket submission, internal note isolation, public message auto-reopen, admin queue filtering & urgency sorting, admin PATCH status transitions, self-assignment, author profile inspection, RBAC enforcement.
- **AI Suite (`tests/ai.test.js`):** Fallback rule classifier, ISBN critical priority rule, context builder assembly, Knowledge Base offline draft generation, message count cache invalidation, circuit breaker trip and recovery.

---

## 12. Deployment Guide

### Deploying to Render / Railway / Fly.io

1. **Database:** Create a free MongoDB Atlas cluster and obtain the connection string.
2. **Environment Variables:** Set the following variables in your hosting dashboard:
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/bookleaf?retryWrites=true&w=majority
   JWT_SECRET=<generate_a_random_64_character_hex_string>
   JWT_EXPIRES_IN=7d
   CLIENT_ORIGIN=https://your-frontend-domain.vercel.app
   AI_ENABLED=true
   AI_PROVIDER=anthropic
   AI_API_KEY=<your_api_key>
   AI_MODEL=claude-3-haiku-20240307
   ```
3. **Build & Start Commands:**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. **Initial Database Seed:** Run `npm run seed` once against your production MongoDB URI to populate initial authors, books, admins, and sample tickets.
5. **Health Check:** Point your hosting health check path to `/api/health`.

---

## License
MIT
