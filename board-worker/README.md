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
npm run seed       # ten made-up winners on the local copy
npm run reset      # no rows on the local copy
npm run deploy     # production
```

## Working on it locally

`npm run dev:all` in the repository's root starts the site's dev server (http://localhost:5173) and the local copy
together, and Ctrl-C stops both. `npm run dev` there starts the site alone: its WORLD view then reads `NO ANSWER`.

The local copy is the same code as production with its own database on this machine (`.wrangler/state`, made by
`npm run dev` the first time), so nothing done locally reaches the real board. It differs in three settings
(`env.dev` in `wrangler.jsonc`): it answers `http://localhost:5173` only (not `127.0.0.1`, not another port), its
limits are higher, and its refused names are stand-ins (`BADWORD` anywhere in a name, `NOPE` or `42` as a whole
word). `npm run seed` and `npm run reset` work while it runs; the game reads the board again when its card next
opens. The seeded tenth scores 1338, one over a bare win: a win with any bonus points takes its place, and a bare
win is not sent.

## Changing the live board

A visitor's open tab keeps running the game it loaded, so a new Worker has to go on answering the game that is
already published. The order is always:

1. `npm run check` and `npm test` here.
2. A new migration, if the table changes: `npx wrangler d1 migrations apply prntr-board --remote`.
3. `npm run deploy`, then `curl https://board.printanyway.app/top`.
4. The site's release, if the game changed too.

A change the published game could not read (a renamed field, a new required one) is made in two releases: the
Worker answers both shapes, the site moves over, then the old shape is removed.

Removing a row: `npx wrangler d1 execute prntr-board --remote --command "DELETE FROM runs WHERE id = 12"`
(`SELECT id, name, score, at FROM runs ORDER BY score DESC, id ASC` lists them).
