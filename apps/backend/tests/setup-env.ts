/**
 * Test environment defaults. Integration tests hit the docker dev Postgres
 * (port 5433) with a dedicated schema so developer data stays untouched.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://taskforge:taskforge_dev_password@localhost:5433/taskforge?schema=tests';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef012345678';
process.env.COOKIE_SECRET = 'test-cookie-secret-0123456789abcdef0123456789';
process.env.LOG_LEVEL = 'error';
