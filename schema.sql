CREATE TABLE IF NOT EXISTS weekly_scores (
  week TEXT NOT NULL,
  ruleset INTEGER NOT NULL,
  player TEXT NOT NULL,
  name TEXT NOT NULL,
  ticks INTEGER NOT NULL,
  recorded INTEGER NOT NULL,
  PRIMARY KEY (week, ruleset, player)
);

CREATE INDEX IF NOT EXISTS weekly_scores_order
  ON weekly_scores (week, ruleset, ticks, recorded, player);
