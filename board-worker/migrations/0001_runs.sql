-- The world board's rows: a name the player typed, a score and the UTC date the server received it.
-- Nothing about the sender is kept: no address, no user agent, no cookie.
CREATE TABLE runs (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT    NOT NULL,
  score INTEGER NOT NULL,
  at    TEXT    NOT NULL
);
-- Rank order: the higher score first, and of two equal scores the earlier one (the lower id) first.
CREATE INDEX runs_rank ON runs (score DESC, id ASC);
