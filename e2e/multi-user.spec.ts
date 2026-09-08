import { test, expect } from '@playwright/test';
import { dismissRoleReveal, fillPegs, getRoomCode } from './helpers';

test('multi-user: two humans vote roles, Coder sets the code, Decoder cracks it', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  try {
    await host.goto('/');
    await host.getByRole('button', { name: 'Create Game' }).click();
    await host.getByLabel('Your name tag').fill('Alice');
    await host.getByRole('button', { name: 'Easy', exact: true }).click();
    await host.getByRole('button', { name: 'Create' }).click();

    await expect(host.getByRole('heading', { name: 'Lobby' })).toBeVisible();
    const roomCode = await getRoomCode(host);
    expect(roomCode).toMatch(/^[A-Z0-9]{5}$/);

    await guest.goto('/');
    await guest.getByRole('button', { name: 'Join Game' }).click();
    await guest.getByLabel('Room code').fill(roomCode);
    await guest.getByLabel('Name tag').fill('Bob');
    await guest.getByRole('button', { name: 'Join' }).click();

    await expect(guest.getByRole('heading', { name: 'Lobby' })).toBeVisible();
    await expect(host.getByText('Bob')).toBeVisible();

    await host.getByRole('button', { name: 'Start Game' }).click();

    // 2+ humans get a real 15s role vote (game-rules.md §3).
    await expect(host.getByRole('heading', { name: 'Choose Your Role' })).toBeVisible({ timeout: 10_000 });
    await expect(guest.getByRole('heading', { name: 'Choose Your Role' })).toBeVisible({ timeout: 10_000 });

    await host.getByRole('button', { name: 'Coder', exact: true }).click();
    await guest.getByRole('button', { name: 'Decoder', exact: true }).click();

    await expect(host.getByRole('heading', { name: 'Roles Assigned' })).toBeVisible({ timeout: 20_000 });
    await expect(guest.getByRole('heading', { name: 'Roles Assigned' })).toBeVisible({ timeout: 20_000 });

    await dismissRoleReveal(host);
    await dismissRoleReveal(guest);

    // Human Coder must set the code before the round timer starts.
    await expect(host.getByRole('heading', { name: 'Set the Secret Code' })).toBeVisible({ timeout: 10_000 });
    await expect(guest.getByRole('heading', { name: 'Setting the Secret Code' })).toBeVisible({ timeout: 10_000 });

    const secretCode = ['Purple', 'Orange', 'Red', 'Blue'];
    await fillPegs(host, secretCode);
    await host.getByRole('button', { name: 'Set Code' }).click();

    await expect(guest.locator('.round-indicator')).toHaveAttribute('aria-label', 'Round 1 of 12', {
      timeout: 10_000,
    });
    await fillPegs(guest, secretCode);
    await guest.getByRole('button', { name: 'Submit' }).click();

    // Guest guessed the exact secret code -> perfect score and immediate game end.
    await expect(guest.locator('.guess-row__feedback').first()).toHaveAttribute(
      'aria-label',
      '4 correct position, 0 correct color',
      { timeout: 10_000 },
    );
    await expect(guest.getByRole('heading', { name: 'Code Cracked!' })).toBeVisible({ timeout: 10_000 });
    await expect(host.getByRole('heading', { name: 'Code Cracked!' })).toBeVisible({ timeout: 10_000 });
    await expect(host.getByText('#1 Bob')).toBeVisible();

    // Only the host (room creator) gets a Play Again button.
    await expect(host.getByRole('button', { name: 'Play Again' })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Play Again' })).toHaveCount(0);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
