-- Published course codes need the same Unicode-aware comparison key as draft courses. SQLite cannot calculate the
-- application's German locale lower case itself, so new public snapshots write their key in the publication service.
-- Existing course codes were written as course identifiers and are backfilled with SQLite's compatible ASCII mapping.
CREATE TABLE IF NOT EXISTS published_course_search_keys (
  course_snapshot_id TEXT PRIMARY KEY NOT NULL REFERENCES published_course_snapshots(id) ON DELETE CASCADE,
  normalized_code TEXT NOT NULL
);
INSERT INTO published_course_search_keys (course_snapshot_id, normalized_code)
  SELECT id, lower(code) FROM published_course_snapshots;
CREATE INDEX IF NOT EXISTS published_course_search_keys_by_normalized_code
  ON published_course_search_keys(normalized_code);
