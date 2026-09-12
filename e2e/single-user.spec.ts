import { test, expect } from '@playwright/test';
import { dismissRoleReveal, fillPegs } from './helpers';

test('single-user: solo game auto-assigns a bot Coder and scores a submitted guess', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mastermind' })).toBeVisible();

  await page.getByRole('button', { name: 'Create Game' }).click();
  await page.getByLabel('Your name tag').fill('SoloTester');
  await page.getByRole('button', { name: 'Easy', exact: true }).click();
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  await expect(page.getByText('a bot Coder will automatically take the Coder role')).toBeVisible();

  await page.getByRole('button', { name: 'Start Game' }).click();

  // Solo play skips the role vote entirely (game-rules.md §3).
  await expect(page.getByRole('heading', { name: 'Roles Assigned' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('You are the')).toContainText('Decoder');
  await expect(page.getByText(/\(bot\) is the/)).toContainText('Coder');

  await dismissRoleReveal(page);

  await expect(page.locator('.round-indicator')).toHaveAttribute('aria-label', 'Round 1 of 12', {
    timeout: 10_000,
  });

  await fillPegs(page, ['Red', 'Blue', 'Green', 'Yellow']);
  await page.getByRole('button', { name: 'Submit' }).click();

  // A round-1 feedback row should appear with some exact/color-only score.
  await expect(page.locator('.guess-row__feedback').first()).toHaveAttribute(
    'aria-label',
    /\d+ correct position, \d+ correct color/,
    { timeout: 10_000 },
  );

  const leaveGameButton = page.getByRole('button', { name: 'Leave Game' });
  await leaveGameButton.click();
  const leaveDialog = page.getByRole('alertdialog');
  const cancelButton = leaveDialog.getByRole('button', { name: 'Cancel' });
  const confirmLeaveButton = leaveDialog.getByRole('button', { name: 'Leave', exact: true });
  await expect(cancelButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirmLeaveButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancelButton).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(leaveDialog).toBeHidden();
  await expect(leaveGameButton).toBeFocused();

  await leaveGameButton.click();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mastermind' })).toBeVisible();
});

test('single-user: leaving mid-round clears the unsubmitted draft guess for the next game', async ({ page }) => {
  await page.goto('/');

  async function createSoloGame(name: string) {
    await page.getByRole('button', { name: 'Create Game' }).click();
    await page.getByLabel('Your name tag').fill(name);
    await page.getByRole('button', { name: 'Easy', exact: true }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(page.getByRole('heading', { name: 'Roles Assigned' })).toBeVisible({ timeout: 10_000 });
    await dismissRoleReveal(page);
    await expect(page.locator('.round-indicator')).toHaveAttribute('aria-label', 'Round 1 of 12', {
      timeout: 10_000,
    });
  }

  await createSoloGame('DraftTester');

  // Fill in a full guess but never submit it.
  await fillPegs(page, ['Red', 'Blue', 'Green', 'Yellow']);
  await expect(page.locator('.guess-row--current .peg-slot').first()).toHaveAttribute('aria-label', 'Red');

  // Leave without submitting.
  await page.getByRole('button', { name: 'Leave Game' }).click();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mastermind' })).toBeVisible();

  // Start a brand-new game — the current guess row must be completely empty, not a leftover
  // copy of the previous game's unsubmitted draft.
  await createSoloGame('DraftTester2');

  const newRoundPegs = page.locator('.guess-row--current .peg-slot');
  await expect(newRoundPegs).toHaveCount(4);
  const labels = await newRoundPegs.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  expect(labels).toEqual(['Empty slot', 'Empty slot', 'Empty slot', 'Empty slot']);
});

test('single-user: peg circle size stays consistent across rows regardless of the timeout icon (6 pegs)', async ({
  page,
}) => {
  // This test deliberately waits out a real 20s Impossible-difficulty round timeout, which
  // exceeds Playwright's default 30s per-test budget.
  test.setTimeout(60_000);

  await page.goto('/');
  await page.getByRole('button', { name: 'Create Game' }).click();
  await page.getByLabel('Your name tag').fill('PegSizeTester');
  await page.getByRole('button', { name: 'Impossible', exact: true }).click();
  await page.getByRole('button', { name: '6 pegs' }).click();
  await page.getByRole('button', { name: 'Create' }).click();

  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.getByRole('heading', { name: 'Roles Assigned' })).toBeVisible({ timeout: 10_000 });
  await dismissRoleReveal(page);

  await expect(page.locator('.round-indicator')).toHaveAttribute('aria-label', 'Round 1 of 8', {
    timeout: 10_000,
  });

  // Leave round 1 completely blank so it times out for real and gets a ⏱ carried-over icon.
  await expect(page.locator('.round-indicator')).toHaveAttribute('aria-label', 'Round 2 of 8', {
    timeout: 25_000,
  });

  // Round 2: submit a full guess normally — this row should have no timeout icon.
  await fillPegs(page, ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange']);
  await page.getByRole('button', { name: 'Submit' }).click();

  const historicalRows = page.locator('.guess-row:not(.guess-row--current)');
  await expect(historicalRows).toHaveCount(2, { timeout: 10_000 });

  await expect(historicalRows.nth(0).locator('.guess-row__carried')).toBeVisible();
  await expect(historicalRows.nth(1).locator('.guess-row__carried')).toBeHidden();

  const [row1PegWidths, row2PegWidths] = await Promise.all([
    historicalRows
      .nth(0)
      .locator('.peg-slot')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width))),
    historicalRows
      .nth(1)
      .locator('.peg-slot')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width))),
  ]);

  expect(row1PegWidths).toHaveLength(6);
  expect(row2PegWidths).toHaveLength(6);
  // Every peg across both rows must be the same size, whether or not that row has the ⏱ icon.
  expect(new Set([...row1PegWidths, ...row2PegWidths]).size).toBe(1);

  await page.getByRole('button', { name: 'Leave Game' }).click();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mastermind' })).toBeVisible();
});
