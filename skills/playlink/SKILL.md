---
name: playlink
description: Observe and control a player's active 无尽巫师 session through the Playlink CLI, respecting player-known information and local cheat permissions.
---

# Playlink session skill

Use the Playlink CLI to observe or control the player's active 无尽巫师 session through the broker. The broker is a relay; the browser runtime remains the only game authority.

## Player-visible information

Only use information returned by `state`, `capabilities`, `content`, and `events`. These projections represent what the player currently knows. Do not infer or request undiscovered spells, recipes, or a complete catalog. Search `content` with `--q` when needed; an empty query may return only the broker's player-known subset.

## Connect and pair

The browser must first create a session and show its short-lived pair code. Pair with:

```sh
npm run playlink -- pair <pairCode> --url http://localhost:8787
```

Pair output includes `sessionId` and `agentToken`. Treat both as credentials: avoid pasting them into shared logs or chat, and keep them in a trusted secret manager. The CLI does not persist credentials. For subsequent calls, set `PLAYLINK_URL`, `PLAYLINK_SESSION`, and `PLAYLINK_TOKEN`, or pass `--url`, `--session`, and `--token` explicitly.

Keep the game open in the foreground on the browser or phone while connected. A phone can join the same session when it can reach the configured broker; background or locked-screen battle is not guaranteed. If the browser disconnects, retry after it reconnects using the same session and credentials.

## Observe

```sh
npm run playlink -- state
npm run playlink -- capabilities
npm run playlink -- content --q fire
npm run playlink -- events --after 0
npm run playlink -- events --after 12 --stream
```

Use the returned event cursor for later gap-free JSON reads. If the response says `gap: true`, older events have expired; fetch `state` to resynchronize first, then continue reading from `nextCursor`. SSE is a live subscription; use JSON event reads to recover after reconnecting.

## Send commands safely

Pass the original command object with its unique `id`:

```sh
npm run playlink -- command '{"id":"agent-001","type":"setPaused","paused":true}'
npm run playlink -- result agent-001
```

`accepted` means the broker received and queued the command; the game may not have received it yet, and it does not mean the action executed successfully. Check `result <commandId>` for the final `executed` or `rejected` status. If a request times out, retry the exact same command with the same id and identical payload. Never reuse an id for a different payload; the broker treats that as a conflict.

Cheats are controlled by the player in the local game UI. Never send `unlockCheats` over the network. Cheat actions are available only after the player has locally unlocked and enabled cheats; an agent must not claim or assume cheat access.

Territory upgrades are ordinary player actions, not cheats. Read `capabilities.territoryUpgrades` for each track’s current level, next cost, increase and availability, then send `{"id":"agent-upgrade-001","type":"upgradeTerritory","track":"wall"}` (or `shield`). Prices and phase restrictions belong to the game; do not hard-code them in an agent.
