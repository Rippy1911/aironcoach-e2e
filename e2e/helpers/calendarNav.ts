import type { Page } from '@playwright/test';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function headerToYm(header: string): number | null {
  const t = header.trim();
  for (let i = 0; i < MONTHS.length; i++) {
    if (t.startsWith(MONTHS[i])) {
      const year = Number.parseInt(t.slice(MONTHS[i].length).trim(), 10);
      if (!Number.isNaN(year)) return year * 100 + (i + 1);
    }
  }
  return null;
}

/** Calendar header uses English `MMMM yyyy` (date-fns). Navigate until `isoDate`'s month is visible. */
export async function calendarEnsureMonthForDate(page: Page, isoDate: string): Promise<void> {
  const [y, m] = isoDate.split('-').map(Number);
  const goal = y * 100 + m;
  const headerLocator = page.locator('h2').filter({ hasText: /\d{4}/ }).first();
  const nav = page.locator('div.flex.items-center.justify-between').first().locator('button');

  for (let i = 0; i < 14; i++) {
    const txt = await headerLocator.textContent();
    const cur = txt ? headerToYm(txt) : null;
    if (cur === goal) return;
    if (cur == null || cur < goal) {
      await nav.nth(1).click();
    } else {
      await nav.nth(0).click();
    }
    await page.waitForTimeout(350);
  }
}
