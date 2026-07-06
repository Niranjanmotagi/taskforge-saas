import request from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { disconnectRedis } from '@/lib/redis';

const app = createApp();
const unique = Date.now();

async function registerAndLogin(tag: string): Promise<string> {
  const email = `it-tenant-${tag}-${unique}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ name: `Tenant ${tag}`, email, password: 'Integr4tionPass' })
    .expect(201);
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'Integr4tionPass' })
    .expect(200);
  return login.body.data.accessToken as string;
}

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { name: { startsWith: 'IT Tenant WS' } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'it-tenant-' } } });
  await prisma.$disconnect();
  await disconnectRedis();
});

describe('tenant isolation (integration)', () => {
  let tokenA: string;
  let tokenB: string;
  let workspaceId: string;
  let projectId: string;

  beforeAll(async () => {
    tokenA = await registerAndLogin('alice');
    tokenB = await registerAndLogin('mallory');

    const ws = await request(app)
      .post('/api/v1/workspaces')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `IT Tenant WS ${unique}` })
      .expect(201);
    workspaceId = ws.body.data.id;

    const project = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Secret Project' })
      .expect(201);
    projectId = project.body.data.id;
  });

  it('owner can read their workspace and project', async () => {
    await request(app)
      .get(`/api/v1/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
  });

  it('non-members are locked out of every workspace-scoped route', async () => {
    const routes = [
      `/api/v1/workspaces/${workspaceId}`,
      `/api/v1/workspaces/${workspaceId}/projects`,
      `/api/v1/workspaces/${workspaceId}/projects/${projectId}`,
      `/api/v1/workspaces/${workspaceId}/members`,
      `/api/v1/workspaces/${workspaceId}/tasks`,
      `/api/v1/workspaces/${workspaceId}/reports/dashboard`,
      `/api/v1/workspaces/${workspaceId}/channels`,
      `/api/v1/workspaces/${workspaceId}/search?q=secret`,
    ];
    for (const route of routes) {
      const res = await request(app).get(route).set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(403);
    }
  });

  it('non-members cannot mutate either', async () => {
    await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Sneaky Project' })
      .expect(403);
    await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hacked' })
      .expect(403);
  });

  it('workspace list only shows own memberships', async () => {
    const res = await request(app)
      .get('/api/v1/workspaces')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const ids = (res.body.data as Array<{ id: string }>).map((w) => w.id);
    expect(ids).not.toContain(workspaceId);
  });
});
