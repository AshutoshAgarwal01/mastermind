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

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Leave Game' }).click();
  await expect(page.getByRole('heading', { name: 'Mastermind' })).toBeVisible();
});
