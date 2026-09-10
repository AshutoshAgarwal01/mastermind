import type { Page } from '@playwright/test';

/** Fills the current active peg row one color at a time via the always-visible color drawer. */
export async function fillPegs(page: Page, colors: string[]): Promise<void> {
  for (const color of colors) {
    const swatch = page.locator('.color-palette').getByRole('button', { name: color });
    // Swatches toggle selection off if re-clicked while already selected — skip the click for
    // back-to-back repeats of the same color so the selection stays active.
    if ((await swatch.getAttribute('aria-pressed')) !== 'true') {
      await swatch.click();
    }
    await page.getByRole('button', { name: 'Empty slot' }).first().click();
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
