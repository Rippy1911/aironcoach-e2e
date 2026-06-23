/**
 * Global setup: auto-capture pro storage state when credentials are present.
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.resolve(__dirname, '..', '.env') });

export default async function globalSetup() {
  const proState = path.resolve(__dirname, '.auth/pro.json');
  if (fs.existsSync(proState)) return;

  const email = process.env.USER_NAME ?? process.env.E2E_LOGIN_EMAIL;
  const password = process.env.USER_PASS ?? process.env.E2E_LOGIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      '⚠ e2e/.auth/pro.json missing and no USER_NAME/USER_PASS — pro specs will fail. Run: npm run e2e:auth-password -- --slot=pro',
    );
    return;
  }

  console.log('Capturing pro storage state via password login…');
  execSync('npx tsx e2e/password-login-setup.ts --slot=pro', {
    stdio: 'inherit',
    env: process.env,
  });
}
