import { execSync } from 'child_process';

/**
 * Push the Prisma schema into an isolated "tests" schema of the dev database
 * so integration tests never touch developer data.
 */
export default function globalSetup(): void {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://taskforge:taskforge_dev_password@localhost:5433/taskforge?schema=tests';
  execSync('npx prisma db push --skip-generate', {
    cwd: __dirname + '/..',
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
