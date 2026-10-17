import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import connectDB, { disconnectDB } from '../src/config/db.js';
import runSeed from '../seed/seed.js';

test('Task 2 Tickets & Books Suite', async (t) => {
  await connectDB();
  await runSeed();

  // Login tokens
  let author1Token = ''; // Priya Sharma (AUTH001, owns BK001, BK002)
  let author2Token = ''; // Rohit Kapoor (AUTH002, owns BK003, BK004)
  let adminToken = ''; // Ops Admin (admin@bookleaf.com)
  let author1Id = '';
  let _author2Id = '';
  let priyaBook1Id = '';
  let rohitBook1Id = '';

  await t.test('Setup: authenticate users', async () => {
    const resA1 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'priya.sharma@email.com', password: 'Author@123' });
    author1Token = resA1.body.data.token;
    author1Id = resA1.body.data.user._id;

    const resA2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rohit.kapoor@email.com', password: 'Author@123' });
    author2Token = resA2.body.data.token;
    _author2Id = resA2.body.data.user._id;

    const resAdmin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@bookleaf.com', password: 'Admin@123' });
    adminToken = resAdmin.body.data.token;
  });

  /* ==========================================================================
     B6: /me/books with summary
     ========================================================================== */

  await t.test('B6: GET /api/me/books returns author books and summary', async () => {
    const res = await request(app)
      .get('/api/me/books')
      .set('Authorization', `Bearer ${author1Token}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data.books));
    assert.equal(res.body.data.books.length, 2);

    priyaBook1Id = res.body.data.books[0]._id;

    const summary = res.body.data.summary;
    assert.ok(summary);
    assert.equal(summary.publishedCount, 2);
    assert.equal(summary.inProductionCount, 0);
    assert.equal(summary.totalEarned, 11970 + 7938);
    assert.equal(summary.totalPaid, 8400 + 7938);
    assert.equal(summary.totalPending, 3570);
  });

  await t.test('B6: GET /api/me/books/:bookId returns own book only', async () => {
    // 1. Own book
    const resOwn = await request(app)
      .get(`/api/me/books/${priyaBook1Id}`)
      .set('Authorization', `Bearer ${author1Token}`);
    assert.equal(resOwn.status, 200);
    assert.equal(resOwn.body.data._id, priyaBook1Id);

    // Get Rohit's book ID
    const resRohitBooks = await request(app)
      .get('/api/me/books')
      .set('Authorization', `Bearer ${author2Token}`);
    rohitBook1Id = resRohitBooks.body.data.books[0]._id;

    // 2. Accessing another author's book returns 404 NOT_FOUND (never leak)
    const resForeign = await request(app)
      .get(`/api/me/books/${rohitBook1Id}`)
      .set('Authorization', `Bearer ${author1Token}`);
    assert.equal(resForeign.status, 404);
    assert.equal(resForeign.body.error.code, 'NOT_FOUND');
  });

  /* ==========================================================================
     B7: Author ticket CRUD + visibility rules + follow-ups
     ========================================================================== */

  let createdTicketId = '';
  await t.test(
    'B7: POST /api/me/tickets creates ticket with fallback triage and initial message',
    async () => {
      // Validation failure: subject < 5 chars
      const resVal = await request(app)
        .get('/api/me/tickets')
        .set('Authorization', `Bearer ${author1Token}`);
      assert.equal(resVal.status, 200);

      const resBad = await request(app)
        .post('/api/me/tickets')
        .set('Authorization', `Bearer ${author1Token}`)
        .send({
          bookId: priyaBook1Id,
          subject: 'Hey',
          description: 'Too short',
        });
      assert.equal(resBad.status, 400);
      assert.equal(resBad.body.error.code, 'VALIDATION_ERROR');

      // Foreign book validation: trying to raise ticket on another author's book returns 404
      const resBadBook = await request(app)
        .post('/api/me/tickets')
        .set('Authorization', `Bearer ${author1Token}`)
        .send({
          bookId: rohitBook1Id,
          subject: 'Inquiry about sales data',
          description: 'Detailed description about royalties and missing sales numbers here.',
        });
      assert.equal(resBadBook.status, 404);

      // Success creation
      const resCreate = await request(app)
        .post('/api/me/tickets')
        .set('Authorization', `Bearer ${author1Token}`)
        .send({
          bookId: priyaBook1Id,
          subject: 'Royalty payout calculation query',
          description:
            'Could you please clarify why my Q3 royalty payment is still showing as pending in my ledger?',
        });

      assert.equal(resCreate.status, 201);
      const tData = resCreate.body.data;
      assert.ok(tData.ticketNumber.startsWith('BL-'));
      assert.equal(tData.status, 'Open');
      assert.equal(tData.category.value, 'Royalty & Payments');
      assert.equal(tData.priority.value, 'Medium');
      // Author-safe projection: ai fields stripped
      assert.equal(tData.ai, undefined);
      assert.equal(tData.category.source, undefined);

      createdTicketId = tData._id;
    }
  );

  await t.test('B7: GET /api/me/tickets returns author-safe list with pagination', async () => {
    const res = await request(app)
      .get('/api/me/tickets?page=1&limit=10')
      .set('Authorization', `Bearer ${author1Token}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 2); // Seeded demo ticket + created ticket
    assert.ok(res.body.meta.total >= 2);

    // Check author safety on list items
    res.body.data.forEach((ticket) => {
      assert.equal(ticket.ai, undefined);
      assert.equal(ticket.category.source, undefined);
      assert.equal(ticket.priority.source, undefined);
    });
  });

  await t.test('B7: GET /api/me/tickets/:id enforces internal notes visibility rule', async () => {
    // BL-000002 has an internal note written by Ops Admin during seed.
    // Let's get BL-000002's ID from admin
    const resAdminList = await request(app)
      .get('/api/admin/tickets')
      .set('Authorization', `Bearer ${adminToken}`);

    const t2 = resAdminList.body.data.find((t) => t.ticketNumber === 'BL-000002');
    assert.ok(t2);

    // Rohit (owner of BL-000002) fetches his ticket
    const resRohit = await request(app)
      .get(`/api/me/tickets/${t2._id}`)
      .set('Authorization', `Bearer ${author2Token}`);

    assert.equal(resRohit.status, 200);
    assert.ok(Array.isArray(resRohit.body.data.messages));

    // Author must NEVER see internal_notes
    const hasInternalNote = resRohit.body.data.messages.some((m) => m.type === 'internal_note');
    assert.equal(hasInternalNote, false, 'Author must NEVER receive internal_note messages!');

    // Priya trying to view Rohit's ticket gets 404 NOT_FOUND
    const resForbidden = await request(app)
      .get(`/api/me/tickets/${t2._id}`)
      .set('Authorization', `Bearer ${author1Token}`);
    assert.equal(resForbidden.status, 404);
  });

  await t.test(
    'B7: POST /api/me/tickets/:id/messages adds reply and reopens Resolved ticket',
    async () => {
      // Ticket 4 in seed (BL-000004) is Priya's Resolved ticket
      const resAdminList = await request(app)
        .get('/api/admin/tickets')
        .set('Authorization', `Bearer ${adminToken}`);

      const t4 = resAdminList.body.data.find((t) => t.ticketNumber === 'BL-000004');
      assert.ok(t4);
      assert.equal(t4.status, 'Resolved');

      // Priya replies to her Resolved ticket
      const resReply = await request(app)
        .post(`/api/me/tickets/${t4._id}/messages`)
        .set('Authorization', `Bearer ${author1Token}`)
        .send({ body: 'Thank you! Could you also confirm the tracking number when available?' });

      assert.equal(resReply.status, 201);

      // Ticket should automatically reopen to 'Open'
      const resCheck = await request(app)
        .get(`/api/me/tickets/${t4._id}`)
        .set('Authorization', `Bearer ${author1Token}`);
      assert.equal(resCheck.body.data.ticket.status, 'Open');
    }
  );

  /* ==========================================================================
     B8: Admin queue, urgency sort, stats & filters
     ========================================================================== */

  await t.test(
    'B8: GET /api/admin/tickets supports filtering, ageHours, and urgency sort',
    async () => {
      const res = await request(app)
        .get('/api/admin/tickets?sort=urgency')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 6);

      // Each ticket must have ageHours
      res.body.data.forEach((ticket) => {
        assert.ok(typeof ticket.ageHours === 'number');
        assert.ok(ticket.ageHours >= 0);
      });

      // Check urgency sort: unresolved tickets (Open, In Progress) must come before Resolved/Closed
      let seenResolved = false;
      for (const t of res.body.data) {
        if (t.status === 'Resolved' || t.status === 'Closed') {
          seenResolved = true;
        } else if (seenResolved) {
          assert.fail('Urgency sort failed: unresolved ticket appeared after resolved ticket');
        }
      }
    }
  );

  await t.test('B8: GET /api/admin/tickets/stats returns correct metrics', async () => {
    const res = await request(app)
      .get('/api/admin/tickets/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    const stats = res.body.data;

    assert.ok(stats.byStatus);
    assert.ok(typeof stats.byStatus.Open === 'number');
    assert.ok(typeof stats.byStatus['In Progress'] === 'number');
    assert.ok(typeof stats.byPriority === 'number' || typeof stats.byPriority === 'object');
    assert.ok(typeof stats.unassigned === 'number');
    assert.ok(typeof stats.overdue48h === 'number');
    assert.ok(typeof stats.tokens === 'object');
  });

  /* ==========================================================================
     B9: Admin PATCH transitions, system messages, assign-to-me, replies & notes
     ========================================================================== */

  await t.test('B9: PATCH /api/admin/tickets/:id enforces status transitions', async () => {
    // Test invalid status transition: Closed -> Resolved (only In Progress is allowed for closed)
    // First, transition a ticket to Closed
    const resClose = await request(app)
      .patch(`/api/admin/tickets/${createdTicketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Closed' });
    assert.equal(resClose.status, 200);
    assert.equal(resClose.body.data.status, 'Closed');

    // Attempt invalid transition: Closed -> Resolved
    const resInvalid = await request(app)
      .patch(`/api/admin/tickets/${createdTicketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Resolved' });
    assert.equal(resInvalid.status, 422);
    assert.equal(resInvalid.body.error.code, 'INVALID_STATUS_TRANSITION');

    // Reopen from Closed -> In Progress (allowed)
    const resReopen = await request(app)
      .patch(`/api/admin/tickets/${createdTicketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'In Progress' });
    assert.equal(resReopen.status, 200);
    assert.equal(resReopen.body.data.status, 'In Progress');

    // Update category & priority: sets source to 'admin'
    const resOverride = await request(app)
      .patch(`/api/admin/tickets/${createdTicketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        category: 'General Inquiry',
        priority: 'Low',
      });
    assert.equal(resOverride.status, 200);
    assert.equal(resOverride.body.data.category.source, 'admin');
    assert.equal(resOverride.body.data.priority.source, 'admin');
    assert.equal(resOverride.body.data.priorityRank, 3);
  });

  await t.test('B9: POST /api/admin/tickets/:id/assign-to-me assigns ticket', async () => {
    const res = await request(app)
      .post(`/api/admin/tickets/${createdTicketId}/assign-to-me`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.data.assignedTo);
  });

  await t.test(
    'B9: POST /api/admin/tickets/:id/messages creates internal_note and reply with auto In Progress',
    async () => {
      // 1. Post internal note
      const resNote = await request(app)
        .post(`/api/admin/tickets/${createdTicketId}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'internal_note',
          body: 'Investigated bank transaction id; awaiting finance confirmation.',
        });
      assert.equal(resNote.status, 201);
      assert.equal(resNote.body.data.type, 'internal_note');

      // 2. Post reply
      const resReply = await request(app)
        .post(`/api/admin/tickets/${createdTicketId}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'reply',
          body: 'Hello Priya, we have verified your details and your payout will be sent this week.',
        });
      assert.equal(resReply.status, 201);
      assert.equal(resReply.body.data.type, 'reply');

      // 3. Admin gets full ticket with messages (including internal note)
      const resFull = await request(app)
        .get(`/api/admin/tickets/${createdTicketId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(resFull.status, 200);
      assert.ok(resFull.body.data.ticket.firstResponseAt);

      const hasInternalNote = resFull.body.data.messages.some((m) => m.type === 'internal_note');
      assert.equal(hasInternalNote, true, 'Admin MUST see internal notes');
    }
  );

  await t.test('B9: GET /api/admin/authors/:id returns author profile with books', async () => {
    const res = await request(app)
      .get(`/api/admin/authors/${author1Id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.author.name, 'Priya Sharma');
    assert.ok(Array.isArray(res.body.data.books));
    assert.equal(res.body.data.books.length, 2);
  });

  await t.test(
    'RBAC: Author cannot access admin routes, Admin cannot access author /me routes',
    async () => {
      // Author accessing admin
      const resAuthorOnAdmin = await request(app)
        .get('/api/admin/tickets')
        .set('Authorization', `Bearer ${author1Token}`);
      assert.equal(resAuthorOnAdmin.status, 403);
      assert.equal(resAuthorOnAdmin.body.error.code, 'FORBIDDEN');

      // Admin accessing author-only route
      const resAdminOnAuthor = await request(app)
        .get('/api/me/books')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(resAdminOnAuthor.status, 403);
      assert.equal(resAdminOnAuthor.body.error.code, 'FORBIDDEN');
    }
  );

  await disconnectDB();
});
