import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { disconnectRedis } from '@/lib/redis';

const app = createApp();
const unique = Date.now();
const email = `it-auth-${unique}@example.com`;
const password = 'Integr4tionPass';

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: 'it-auth-' } } });
  await prisma.$disconnect();
  await disconnectRedis();
});

describe('auth flow (integration)', () => {
  it('rejects invalid registration payloads with details', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'x', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('registers, returns tokens, sets refresh cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Integration Tester', email, password });
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(email);
    const cookies = res.headers['set-cookie'];
    expect(String(cookies)).toContain('tf_refresh=');
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Dup', email, password });
    expect(res.status).toBe(409);
  });

  it('logs in and reaches /me with the access token', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);
  });

  it('uniform 401 on wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email, password }).expect(200);

    // Grab the current cookie, rotate, then replay the old cookie.
    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    const oldCookie = login.headers['set-cookie'][0].split(';')[0];

    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(200);
    expect(rotated.body.data.accessToken).toBeTruthy();

    // Replaying the pre-rotation token must be rejected and kill the session.
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie);
    expect(replay.status).toBe(401);

    const newCookie = rotated.headers['set-cookie'][0].split(';')[0];
    const afterTheft = await request(app).post('/api/v1/auth/refresh').set('Cookie', newCookie);
    expect(afterTheft.status).toBe(401);
  });

  it('requires auth for protected routes', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
    await request(app).get('/api/v1/workspaces').expect(401);
  });
});
