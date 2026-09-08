import type { Page } from '@playwright/test';

/** Fills the current active peg row one color at a time via the color palette overlay. */
export async function fillPegs(page: Page, colors: string[]): Promise<void> {
  for (const color of colors) {
    await page.getByRole('button', { name: 'Empty slot' }).first().click();
    await page.locator('.color-palette').getByRole('button', { name: color }).click();
  }
}

/** Reads the room code shown on the Lobby screen (e.g. "AB3XZ"). */
export async function getRoomCode(page: Page): Promise<string> {
  const text = await page.locator('.room-code strong').innerText();
  return text.trim();
}

/** Clicks Continue on the RoleReveal screen if it hasn't already auto-advanced. */
export async function dismissRoleReveal(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: 'Continue' })
    .click({ timeout: 5_000 })
    .catch(() => {
      // Already auto-advanced past RoleReveal — nothing to click.
    });
}
