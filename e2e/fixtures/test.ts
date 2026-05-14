import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../helpers/apiClient';
import { env, type Slot } from '../helpers/env';

type Fixtures = {
  api: ApiClient;
  /** Slot inferred from the project name. Throws if used outside a slotted project. */
  slot: Slot;
  /** Email associated with the active slot. */
  slotEmail: string;
};

export const test = base.extend<Fixtures>({
  api: async ({ page }, use) => {
    const api = new ApiClient(page);
    await use(api);
  },
  slot: async ({}, use, info) => {
    const project = info.project.name;
    if (project === 'free' || project === 'pro' || project === 'admin' || project === 'fresh') {
      await use(project);
    } else if (project === 'mobile-pro' || project === 'promo' || project === 'promo-mobile') {
      await use('pro');
    } else {
      throw new Error(
        `Tried to read \`slot\` fixture from project="${project}". Use only inside a slotted project.`,
      );
    }
  },
  slotEmail: async ({ slot }, use) => {
    await use(env.emails[slot]);
  },
});

export { expect };
