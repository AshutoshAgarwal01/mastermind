# Mastermind Online — Game Rules

> **Status:** Draft, work in progress. This document covers game rules, roles,
> flow, and platform scope. Layout/UX, tech stack details, and distribution
> specifics are **not yet discussed** — see "Not Yet Covered" at the bottom.

## 1. Overview

An online, multiplayer version of the classic board game Mastermind. One player
(the **Coder**) sets a secret code at the start of the game; the rest (the
**Decoders**) compete across multiple rounds to guess it.

## 2. Players

- Minimum 1 human player.
- Maximum 4 human players.
- Optional: a single computer/bot player may join, bringing the max to 5 total.
  There can never be more than one bot in a game.
- The bot, if present, can only take the **Coder** role — never a Decoder.
- If there is only one human player, that player is always a Decoder and a bot
  Coder is automatically added.

## 3. Roles

Two roles exist: **Coder** and **Decoder**.

### Coder
- Sets the secret code once, at the very start of the game (not per round).
- Has no further active decisions for the rest of the game — the app computes
  all feedback automatically.
- Can see **all** Decoders' actual guesses and their feedback throughout the
  game.

### Decoder
- Submits one guess per round, trying to crack the secret code.
- Can see their **own** guesses and feedback.
- Can see **other players' feedback** (number of correct/incorrect peg
  matches), but **not** their actual guessed sequences.

### Role selection (start of game, after lobby fills)
1. Each player chooses whether they want to be Coder or Decoder. Voting has a
   **15s timer**. Not voting defaults to Decoder.
2. If exactly one player wants to be Coder, they become the Coder.
3. If more than one player wants to be Coder, the computer randomly picks one
   of them.
4. If no one wants to be Coder, a bot player is added as Coder.
5. A bot in the game can only ever be assigned the Coder role.

## 4. Names

- Every player (including the bot) has a name tag.
- Human players type their name tag before joining the host's lobby.
- Duplicate name tags are not allowed within the same lobby.
- Name tags are locked for the whole game once chosen — no changing mid-game.
- If a bot is added, its name is picked at random from: **Bob, Jeff, Smith,
  Adam**.

## 5. Lobby & Joining

- The **host** creates a lobby/room and chooses, before anyone joins:
  - **Difficulty** (see §7), which sets the round timer and max round count.
  - **Peg count** (4, 6, or 8 pegs — see §7).
- Creating the lobby generates a short, unique **room code**. The host shares
  this code with other players out-of-band (voice, chat, etc.).
- Other players join by entering the room code and typing their name tag.
- The lobby is a waiting room: joined players are listed, along with the
  chosen difficulty/peg count.
- The **host explicitly clicks "Start Game"** to begin — there's no auto-start.
- The host can kick a player from the lobby before the game starts.
- Once the game starts, the room code stops accepting **new** players, but
  remains valid for **reconnection** by players who already joined (see §9).

## 6. Game Structure

- The game consists of **multiple rounds**.
- The secret code is set **once per game** (not once per round) by the Coder.
- A **round** ends when either:
  - all Decoders have submitted a guess for that round, or
  - the round timer expires.
- If a Decoder doesn't submit a guess before the timer expires, their **guess
  from the previous round carries over** and the round is still counted for
  them (they get the same feedback as before, since the guess didn't change).
- Rounds always resolve on schedule — the timer is never paused or extended
  for anyone, connected or not.
- After a round fully resolves, the game checks whether anyone cracked the
  code. A crack does not cut the round short for other players; everyone
  finishes submitting for that round first.
- The **game ends** when either:
  - at least one Decoder has cracked the code (checked after each round
    resolves), or
  - the maximum number of rounds is reached.

## 7. Difficulty & Code Format

Chosen by the host when creating the lobby (not voted on by players).

| Difficulty  | Round Timer | Max Rounds |
|-------------|------------:|-----------:|
| Easy        | 60s         | 12         |
| Moderate    | 45s         | 10         |
| Impossible  | 20s         | 8          |

- Peg count: host also chooses **4, 6, or 8 pegs** for the secret code length.
- Colors: fixed at **6 colors** for now, regardless of peg count (duplicate
  colors within the code are allowed). See "Future Ideas" for a possible
  upgrade here.

## 8. Winning & Losing

- If one or more Decoders crack the code, the game ends and all crackers are
  **ranked by earliest submission timestamp** (1st, 2nd, 3rd, ...).
- If the maximum number of rounds is reached and no one has cracked the code,
  the game is a **loss for all Decoders** and a **win for the Coder**.

## 9. Disconnection & Reconnection

- Each player gets a persistent session token when they join, tied to their
  room + name tag.
- A dropped connection never pauses or extends round timers — active players
  are never kept waiting.
- A disconnected player shows a **"reconnecting…" status for 15s** (UI only);
  after that it flips to a **"left game"** label, but their seat is **never
  given away** — they can reconnect at any later point in the game.
- Reconnecting restores full state: guess history, feedback received, and any
  in-progress (not-yet-submitted) guess for the current round.
- If a disconnected Decoder doesn't return, their guess simply keeps carrying
  over round to round (per §6) — no disruption to other players.
- If the **Coder** disconnects, a bot immediately takes over the Coder seat
  (the Coder has no active duties beyond the initial code, so this is
  seamless). If the human Coder reconnects later, they **immediately resume**
  the Coder seat from the bot — this causes no disruption since the Coder
  never had any pending decisions to reconcile.

## 10. Platform & Scope

- **Initial version:** a **browser-based, responsive web app**. It must adapt
  appropriately to mobile, tablet, and desktop screen sizes/layouts.
- **Future expansion:** native **Android** and **iOS** apps are planned, but
  are out of scope for now — the current focus is the responsive web app
  only.

## 11. Future Ideas (not committed, for later brainstorming)

- Support for more than 6 peg colors, possibly configurable alongside peg
  count, for additional difficulty variety.
- Native Android and iOS apps (after the responsive web app is done).

## Not Yet Covered

The following topics still need to be brainstormed and are **not** part of
this document yet:
- Game layout / UX (screens, boards, visual design)
- Tech stack and architecture
- Distribution / deployment (hosting, etc. for the web app)
