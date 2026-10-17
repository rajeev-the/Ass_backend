import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import connectDB, { disconnectDB } from '../src/config/db.js';
import runSeed from '../seed/seed.js';

test('Task 1 Foundation Integration Suite', async (t) => {
  await connectDB();
  await runSeed();

  await t.test('1. GET /api/health returns 200 with status ok and db status', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(['connected', 'connecting'].includes(res.body.db));
    assert.ok(typeof res.body.ai === 'string');
  });

  await t.test('2. Unmatched route returns 404 with NOT_FOUND error code', async () => {
    const res = await request(app).get('/api/non-existent-route');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  await t.test(
    '3. POST /api/auth/login with invalid email format returns 400 VALIDATION_ERROR',
    async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'secret' });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(res.body.error.details));
      assert.equal(res.body.error.details[0].field, 'email');
    }
  );

  await t.test(
    '4. POST /api/auth/login with missing password returns 400 VALIDATION_ERROR',
    async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'admin@bookleaf.com' });

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.equal(res.body.error.details[0].field, 'password');
    }
  );

  await t.test(
    '5. POST /api/auth/login with incorrect credentials returns 401 INVALID_CREDENTIALS',
    async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@bookleaf.com', password: 'WrongPassword' });

      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
    }
  );

  let adminToken = '';
  await t.test(
    '6. POST /api/auth/login with correct admin credentials returns 200 and JWT',
    async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@bookleaf.com', password: 'Admin@123' });

      assert.equal(res.status, 200);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.user.role, 'admin');
      assert.equal(res.body.data.user.email, 'admin@bookleaf.com');
      assert.equal(res.body.data.user.passwordHash, undefined); // sanitized
      adminToken = res.body.data.token;
    }
  );

  let authorToken = '';
  await t.test(
    '7. POST /api/auth/login with author credentials returns 200 and authorCode',
    async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'priya.sharma@email.com', password: 'Author@123' });

      assert.equal(res.status, 200);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.user.role, 'author');
      assert.equal(res.body.data.user.authorCode, 'AUTH001');
      assert.equal(res.body.data.user.passwordHash, undefined); // sanitized
      authorToken = res.body.data.token;
    }
  );

  await t.test('8. GET /api/auth/me without token returns 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  await t.test('9. GET /api/auth/me with invalid token returns 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.value');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  await t.test('10. GET /api/auth/me with valid admin token returns admin profile', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.role, 'admin');
    assert.equal(res.body.data.email, 'admin@bookleaf.com');
  });

  await t.test('11. GET /api/auth/me with valid author token returns author profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authorToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.role, 'author');
    assert.equal(res.body.data.email, 'priya.sharma@email.com');
    assert.equal(res.body.data.authorCode, 'AUTH001');
  });

  await t.test('12. GET /api/docs/ serves Swagger UI documentation', async () => {
    const res = await request(app).get('/api/docs/');
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('swagger-ui'));
  });

  await disconnectDB();
});
