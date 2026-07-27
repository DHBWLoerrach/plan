-- A published Kurskennung addresses exactly one course, so the database says so instead of the publication check
-- alone. Applying this fails on a database that still holds two published snapshots of one code; withdraw or
-- republish one of the two block plans involved, then migrate again.
DROP INDEX IF EXISTS published_course_search_keys_by_normalized_code;
CREATE UNIQUE INDEX IF NOT EXISTS published_course_search_keys_by_normalized_code
  ON published_course_search_keys(normalized_code);
