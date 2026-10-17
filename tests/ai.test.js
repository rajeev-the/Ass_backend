import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import connectDB, { disconnectDB } from '../src/config/db.js';
import runSeed from '../seed/seed.js';
import {
  getQuarter,
  getPayoutDeadline,
  getRoyaltyFacts,
  formatCurrency,
} from '../src/services/royalty.service.js';
import { classifyWithFallback } from '../src/services/ai/fallbackClassifier.js';
import { getKbSectionsForCategory } from '../src/services/ai/knowledgeBase.js';
import { generateFallbackDraft } from '../src/services/ai/drafter.js';

test('Task 3 AI & Real-time Integration Suite', async (t) => {
  await connectDB();
  await runSeed();

  let adminToken = '';
  let authorToken = '';

  await t.test('Setup: authenticate', async () => {
    const resAdmin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@bookleaf.com', password: 'Admin@123' });
    adminToken = resAdmin.body.data.token;

    const resAuthor = await request(app)
      .post('/api/auth/login')
      .send({ email: 'priya.sharma@email.com', password: 'Author@123' });
    authorToken = resAuthor.body.data.token;
  });

  /* ==========================================================================
     B10: Royalty facts math and Knowledge Base
     ========================================================================== */

  await t.test('B10: Royalty service math and quarterly deadlines', () => {
    const q4 = getQuarter(new Date('2026-10-15'));
    assert.equal(q4.label, 'Q4 2026');
    assert.equal(q4.start.getMonth(), 9); // October (0-indexed)
    assert.equal(q4.end.getMonth(), 11); // December

    const deadline = getPayoutDeadline(q4.end);
    // 45 days after Dec 31 is mid February
    assert.equal(deadline.getMonth(), 1); // February (0-indexed)

    // Currency formatting
    assert.equal(formatCurrency(11970).replace(/\s/g, ''), '₹11,970');

    // Threshold check
    const belowThresholdBook = {
      status: 'Published & Live',
      royaltyPending: 850,
      totalRoyaltyEarned: 850,
      royaltyPaid: 0,
    };
    const facts = getRoyaltyFacts(belowThresholdBook);
    assert.equal(facts.belowThreshold, true);
    assert.equal(facts.neverPaid, true);
  });

  await t.test('B10: Knowledge Base minimal category mapping for cost control', () => {
    const royaltyKb = getKbSectionsForCategory('Royalty & Payments');
    assert.equal(royaltyKb.length, 1);
    assert.ok(royaltyKb[0].includes('80/20 royalty split'));

    const isbnKb = getKbSectionsForCategory('ISBN & Metadata Issues');
    assert.equal(isbnKb.length, 1);
    assert.ok(isbnKb[0].includes('unique ISBN'));

    const printKb = getKbSectionsForCategory('Printing & Quality');
    assert.ok(printKb[0].includes('5–7 business days'));
  });

  /* ==========================================================================
     B12 & B16: Test all 7 Knowledge Base sample queries against fallback
     ========================================================================== */

  await t.test('B12 & B16: Fallback classifier on all 7 KB query types', () => {
    // 1. Royalty & Payments overdue
    const q1 = classifyWithFallback(
      "I published my book 4 months ago and still haven't received any royalty. What's going on?"
    );
    assert.equal(q1.category, 'Royalty & Payments');
    assert.ok(['High', 'Critical'].includes(q1.priority));

    // 2. Royalty calculation query
    const q2 = classifyWithFallback(
      'My royalty amount seems too low. I sold 200 copies but only received ₹3,000.'
    );
    assert.equal(q2.category, 'Royalty & Payments');
    assert.ok(['High', 'Medium'].includes(q2.priority));

    // 3. ISBN error
    const q3 = classifyWithFallback(
      'My book is showing a different ISBN on Amazon than what’s on the physical copy.'
    );
    assert.equal(q3.category, 'ISBN & Metadata Issues');
    assert.ok(q3.priority === 'High' || q3.priority === 'Critical');

    // 4. Printing & Quality
    const q4 = classifyWithFallback(
      'I received my author copies and the print quality is terrible. The images are blurry and pages are misaligned.'
    );
    assert.equal(q4.category, 'Printing & Quality');
    assert.equal(q4.priority, 'High');

    // 5. Distribution & Availability
    const q5 = classifyWithFallback(
      'My book is published but it’s showing as "Currently Unavailable" on Amazon.'
    );
    assert.equal(q5.category, 'Distribution & Availability');
    assert.equal(q5.priority, 'High');

    // 6. Production updates
    const q6 = classifyWithFallback(
      'It’s been 3 weeks and my book is still in typesetting. When will it be done?'
    );
    assert.equal(q6.category, 'Book Status & Production Updates');
    assert.equal(q6.priority, 'Medium');

    // 7. General inquiry
    const q7 = classifyWithFallback(
      'Can I update the description of my book on Amazon after it’s already live?'
    );
    assert.equal(q7.category, 'General Inquiry');
    assert.equal(q7.priority, 'Low');
  });

  await t.test(
    'B16: Verifies fallback drafted responses follow tone guidelines for each category',
    () => {
      const author = { name: 'Priya Sharma', city: 'Mumbai' };
      const book = {
        title: 'Whispers of the Ganges',
        status: 'Published & Live',
        royaltyPending: 3570,
        totalRoyaltyEarned: 11970,
        royaltyPaid: 8400,
      };

      // Test Royalty draft
      const draftRoyalty = generateFallbackDraft({
        ticket: { category: { value: 'Royalty & Payments' } },
        author,
        book,
        royaltyFacts: getRoyaltyFacts(book),
      });
      assert.ok(draftRoyalty.startsWith('Dear Priya'));
      assert.ok(draftRoyalty.includes('80/20'));
      assert.ok(draftRoyalty.includes('BookLeaf Author Support'));

      // Test Printing draft
      const draftPrint = generateFallbackDraft({
        ticket: { category: { value: 'Printing & Quality' } },
        author,
        book,
      });
      assert.ok(draftPrint.includes('photographs of the defective copies'));
      assert.ok(draftPrint.includes('5 to 7 business days'));
      assert.ok(draftPrint.includes('Warm regards,'));

      // Test Distribution draft
      const draftDist = generateFallbackDraft({
        ticket: { category: { value: 'Distribution & Availability' } },
        author,
        book,
      });
      assert.ok(draftDist.includes('stock sync issue'));
      assert.ok(draftDist.includes('24 to 48 hours'));

      // Test ISBN draft
      const draftIsbn = generateFallbackDraft({
        ticket: { category: { value: 'ISBN & Metadata Issues' } },
        author,
        book,
      });
      assert.ok(draftIsbn.includes('production team in Delhi'));
      assert.ok(draftIsbn.includes('48 hours'));
    }
  );

  /* ==========================================================================
     B14: Endpoints: POST /api/admin/tickets/:id/ai-draft & /reclassify
     ========================================================================== */

  let testTicketId = '';
  await t.test('B14: Generate AI draft on ticket (with caching and ?regenerate=true)', async () => {
    const resList = await request(app)
      .get('/api/admin/tickets')
      .set('Authorization', `Bearer ${adminToken}`);
    const ticket1 = resList.body.data[0];
    assert.ok(ticket1);
    testTicketId = ticket1._id;

    // 1. Initial draft generation
    const resDraft = await request(app)
      .post(`/api/admin/tickets/${testTicketId}/ai-draft`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resDraft.status, 200);
    assert.ok(resDraft.body.data.draft);
    assert.equal(resDraft.body.data.draftStatus, 'ready');

    // 2. Second call should return cached draft
    const resCached = await request(app)
      .post(`/api/admin/tickets/${testTicketId}/ai-draft`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resCached.status, 200);
    assert.equal(resCached.body.data.cached, true);
    assert.equal(resCached.body.data.draft, resDraft.body.data.draft);

    // 3. Forced regeneration with ?regenerate=true
    const resRegen = await request(app)
      .post(`/api/admin/tickets/${testTicketId}/ai-draft?regenerate=true`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resRegen.status, 200);
    assert.equal(resRegen.body.data.cached, false);
  });

  await t.test('B14: POST /api/admin/tickets/:id/reclassify re-runs classification', async () => {
    const resReclassify = await request(app)
      .post(`/api/admin/tickets/${testTicketId}/reclassify`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resReclassify.status, 200);
    assert.ok(resReclassify.body.data.category.value);
    assert.ok(resReclassify.body.data.priority.value);
    assert.ok(typeof resReclassify.body.data.priorityRank === 'number');
  });

  /* ==========================================================================
     Dynamic AI Config (User's custom feature requirement)
     ========================================================================== */

  await t.test(
    'Dynamic AI Config: Admin can view and update AI provider/key/settings dynamically',
    async () => {
      // 1. GET AI config
      const resGet = await request(app)
        .get('/api/admin/ai-config')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(resGet.status, 200);
      assert.ok(resGet.body.data.provider);
      assert.ok(typeof resGet.body.data.enabled === 'boolean');
      assert.ok(typeof resGet.body.data.hasKey === 'boolean');

      // 2. PATCH AI config to set provider to 'openai' and model
      const resUpdate = await request(app)
        .patch('/api/admin/ai-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          provider: 'openai',
          model: 'gpt-4o-mini',
          enabled: true,
        });

      assert.equal(resUpdate.status, 200);
      assert.equal(resUpdate.body.data.provider, 'openai');
      assert.equal(resUpdate.body.data.model, 'gpt-4o-mini');
    }
  );

  /* ==========================================================================
     B13: Background AI Pipeline after author ticket creation
     ========================================================================== */

  await t.test(
    'B13: POST /me/tickets triggers async AI pipeline and completes without crashing',
    async () => {
      const resCreate = await request(app)
        .post('/api/me/tickets')
        .set('Authorization', `Bearer ${authorToken}`)
        .send({
          subject: 'Author copy reprint inquiry',
          description:
            'Several pages in my author copies have misprints and distorted colors. How do I request reprints?',
        });

      assert.equal(resCreate.status, 201);
      const newId = resCreate.body.data._id;

      // Poll for async non-blocking pipeline completion
      let resCheck;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 500));
        resCheck = await request(app)
          .get(`/api/admin/tickets/${newId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        if (resCheck.body.data?.ticket?.ai?.draft) break;
      }

      assert.equal(resCheck.status, 200);
      assert.equal(resCheck.body.data.ticket.category.value, 'Printing & Quality');
      assert.ok(resCheck.body.data.ticket.ai.draft);
      assert.equal(resCheck.body.data.ticket.ai.draftStatus, 'ready');
    }
  );

  await disconnectDB();
});
