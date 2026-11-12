# Prntr's world board

A Cloudflare Worker with a D1 database: the ten best cleared runs of Prntr, the game hidden in PrintAnyway.
It is not part of the site's build; the site only calls it (`src/prntr/worldBoard.ts`).

| Request | Answer |
| --- | --- |
| `GET /top` | `{ "rows": [{ "name", "score", "at" }] }`, ten at most, best first |
| `POST /run` with `{ "name": "EDGAR 7", "score": 1346 }` | `{ "rank": 3, "rows": [...] }`; `rank` is 0-based, `-1` when the run is not on the ten |

A row is a name the player typed, a score and the UTC date it arrived. Nothing about the sender is stored or
logged. A score comes from the player's browser, so the board cannot prove a run was played; it keeps the
table well-formed and small, and keeps other websites and floods out.

## Rules

- A run is kept only when fewer than ten rows have its score or better. An equal score ranks below the earlier one.
- The name and score rules are the game's own, imported from `../src/prntr/boardRules.ts`.
- 30 rows are kept and ten are shown, so a row deleted by hand is replaced by a real run.
- Writes come from the site's origin only, and are limited per sender's address.
- Refused names are the secret `BLOCKED`, not in this repository (`src/blocked.ts` says how an entry is written).
  Until it is set, no run is accepted.
- The variable `ACCEPTING` set to anything but `1` closes the board to new runs without a new build of the game.

## Commands

```sh
npm install
npm run check      # types
npm test           # every rule once, against a local copy with an empty database
npm run dev        # the local copy the game's dev server calls (http://localhost:8787)
npm run deploy     # production
```

Before `npm run dev` the first time: `npx wrangler d1 migrations apply DB --local --env dev`.

Removing a row: `npx wrangler d1 execute prntr-board --remote --command "DELETE FROM runs WHERE id = 12"`
(`SELECT id, name, score, at FROM runs ORDER BY score DESC, id ASC` lists them).
