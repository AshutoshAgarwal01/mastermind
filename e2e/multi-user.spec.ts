import { test, expect } from '@playwright/test';
import { dismissRoleReveal, fillPegs, getRoomCode } from './helpers';

test('multi-user: two humans vote roles, Coder sets the code, Decoder cracks it', async ({ browser }) => {
  // Runs alongside other spec files' tests in parallel workers; give it headroom above
  // Playwright's default 30s budget so worker-machine contention doesn't cause flaky failures.
  test.setTimeout(60_000);

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
    await expect(host.locator('.leaderboard__name', { hasText: 'Bob' })).toBeVisible();
    await expect(host.getByRole('img', { name: 'Rank 1, cracked it on round 1' })).toBeVisible();

    // Only the host (room creator) gets a Play Again button.
    await expect(host.getByRole('button', { name: 'Play Again' })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Play Again' })).toHaveCount(0);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test("multi-user: a Decoder's pending peg recolor does not leak into round 2 while another Decoder is still playing", async ({
  browser,
}) => {
  // Runs alongside other spec files' tests in parallel workers; give it headroom above
  // Playwright's default 30s budget so worker-machine contention doesn't cause flaky failures.
  test.setTimeout(60_000);

  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const guest2Context = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const guest2 = await guest2Context.newPage();

  try {
    await host.goto('/');
    await host.getByRole('button', { name: 'Create Game' }).click();
    await host.getByLabel('Your name tag').fill('Alice');
    await host.getByRole('button', { name: 'Easy', exact: true }).click();
    await host.getByRole('button', { name: 'Create' }).click();

    await expect(host.getByRole('heading', { name: 'Lobby' })).toBeVisible();
    const roomCode = await getRoomCode(host);

    await guest.goto('/');
    await guest.getByRole('button', { name: 'Join Game' }).click();
    await guest.getByLabel('Room code').fill(roomCode);
    await guest.getByLabel('Name tag').fill('Bob');
    await guest.getByRole('button', { name: 'Join' }).click();
    await expect(guest.getByRole('heading', { name: 'Lobby' })).toBeVisible();

    await guest2.goto('/');
    await guest2.getByRole('button', { name: 'Join Game' }).click();
    await guest2.getByLabel('Room code').fill(roomCode);
    await guest2.getByLabel('Name tag').fill('Carol');
    await guest2.getByRole('button', { name: 'Join' }).click();
    await expect(guest2.getByRole('heading', { name: 'Lobby' })).toBeVisible();

    await expect(host.getByText('Bob')).toBeVisible();
    await expect(host.getByText('Carol')).toBeVisible();

    await host.getByRole('button', { name: 'Start Game' }).click();

    await expect(host.getByRole('heading', { name: 'Choose Your Role' })).toBeVisible({ timeout: 10_000 });
    await expect(guest.getByRole('heading', { name: 'Choose Your Role' })).toBeVisible({ timeout: 10_000 });
    await expect(guest2.getByRole('heading', { name: 'Choose Your Role' })).toBeVisible({ timeout: 10_000 });

    await host.getByRole('button', { name: 'Coder', exact: true }).click();
    await guest.getByRole('button', { name: 'Decoder', exact: true }).click();
    await guest2.getByRole('button', { name: 'Decoder', exact: true }).click();

    await expect(host.getByRole('heading', { name: 'Roles Assigned' })).toBeVisible({ timeout: 20_000 });
    await expect(guest.getByRole('heading', { name: 'Roles Assigned' })).toBeVisible({ timeout: 20_000 });
    await expect(guest2.getByRole('heading', { name: 'Roles Assigned' })).toBeVisible({ timeout: 20_000 });

    await dismissRoleReveal(host);
    await dismissRoleReveal(guest);
    await dismissRoleReveal(guest2);

    await expect(host.getByRole('heading', { name: 'Set the Secret Code' })).toBeVisible({ timeout: 10_000 });
    await fillPegs(host, ['Purple', 'Orange', 'Red', 'Blue']);
    await host.getByRole('button', { name: 'Set Code' }).click();

    await expect(guest.locator('.round-indicator')).toHaveAttribute('aria-label', 'Round 1 of 12', {
      timeout: 10_000,
    });
    await expect(guest2.locator('.round-indicator')).toHaveAttribute('aria-label', 'Round 1 of 12', {
      timeout: 10_000,
    });

    // Bob fills round 1 and locks peg 0 as Red.
    await fillPegs(guest, ['Red', 'Blue', 'Green', 'Yellow']);
    const bobPegs = guest.locator('.guess-row--current .peg-slot');
    await bobPegs.first().dblclick();
    await expect(bobPegs.first()).toHaveAttribute('aria-label', 'Red (locked)');

    // Single-tap (not double-tap) the locked peg with a NEW color selected — starts the 300ms
    // recolor-disambiguation timer — then submit immediately, before it fires. Carol is still
    // mid-round, so room.round stays at 1 for Bob even after his own submission is accepted.
    const bobPalette = guest.locator('.color-palette');
    await bobPalette.getByRole('button', { name: 'Purple' }).click();
    await bobPegs.first().click();
    await guest.getByRole('button', { name: 'Submit' }).click();
    await expect(guest.getByRole('button', { name: 'Waiting…' })).toBeVisible();

    // Wait past the original 300ms window while Carol is still mid-round — the stale timer must
    // not be allowed to fire and corrupt Bob's carried-over locked color.
    await guest.waitForTimeout(500);

    // Carol finishes round 1 for everyone, advancing the room to round 2.
    await fillPegs(guest2, ['Yellow', 'Green', 'Blue', 'Red']);
    await guest2.getByRole('button', { name: 'Submit' }).click();

    // Round 2's first peg for Bob must carry over the ORIGINAL locked color (Red), not the stale
    // post-submit recolor (Purple) that the pending timer would otherwise have applied.
    await expect(guest.locator('.round-indicator')).toHaveAttribute('aria-label', 'Round 2 of 12', {
      timeout: 10_000,
    });
    const round2Pegs = guest.locator('.guess-row--current .peg-slot');
    await expect(round2Pegs.first()).toHaveAttribute('aria-label', 'Red (locked)');
  } finally {
    await hostContext.close();
    await guestContext.close();
    await guest2Context.close();
  }
});
