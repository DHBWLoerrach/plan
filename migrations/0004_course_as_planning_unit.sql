-- The old model grouped editable data by technical block plans. A migration must never guess how
-- to represent an invalid old state: a term without a course or colliding public course codes
-- aborts the whole transaction before any schema object is replaced.
CREATE TABLE _course_model_guard (valid INTEGER NOT NULL CHECK (valid = 1));
INSERT INTO _course_model_guard (valid)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM draft_events event
  WHERE NOT EXISTS (SELECT 1 FROM draft_event_courses link WHERE link.event_id = event.id)
) OR EXISTS (
  SELECT 1 FROM published_events event
  WHERE NOT EXISTS (SELECT 1 FROM published_event_courses link WHERE link.event_id = event.id)
) OR EXISTS (
  SELECT normalized_code FROM published_course_search_keys GROUP BY normalized_code HAVING count(*) > 1
) OR EXISTS (
  SELECT 1 FROM courses course LEFT JOIN block_plans plan ON plan.id = course.block_plan_id
  WHERE plan.id IS NULL OR plan.draft_updated_by_account_id IS NULL
) THEN 0 ELSE 1 END;

ALTER TABLE courses RENAME TO _old_courses;
ALTER TABLE published_phases RENAME TO _old_published_phases;
ALTER TABLE published_events RENAME TO _old_published_events;
ALTER TABLE published_event_courses RENAME TO _old_published_event_courses;
ALTER TABLE published_course_search_keys RENAME TO _old_published_course_search_keys;

CREATE TABLE courses (
  id TEXT PRIMARY KEY NOT NULL,
  program_id TEXT NOT NULL REFERENCES programs(id),
  code TEXT NOT NULL,
  normalized_code TEXT NOT NULL UNIQUE,
  study_start TEXT NOT NULL,
  study_end TEXT NOT NULL,
  has_ever_been_published INTEGER NOT NULL DEFAULT 0,
  draft_updated_at TEXT NOT NULL,
  draft_updated_by_account_id TEXT NOT NULL REFERENCES user(id),
  CHECK (study_start < study_end)
);
INSERT INTO courses (id, program_id, code, normalized_code, study_start, study_end, has_ever_been_published, draft_updated_at, draft_updated_by_account_id)
SELECT course.id, course.program_id, course.code, course.normalized_code, course.study_start, course.study_end,
  plan.has_ever_been_published, plan.draft_updated_at, plan.draft_updated_by_account_id
FROM _old_courses course JOIN block_plans plan ON plan.id = course.block_plan_id;

CREATE TABLE course_phases (
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  semester INTEGER NOT NULL,
  phase_type TEXT NOT NULL CHECK (phase_type IN ('THEORY','PRACTICE')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  CHECK (start_date <= end_date)
);
INSERT INTO course_phases (id, course_id, semester, phase_type, start_date, end_date)
SELECT id, course_id, semester, phase_type, start_date, end_date FROM draft_phases;

CREATE TABLE course_events (
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('REGISTRATION','SUBMISSION','PRESENTATION','EXAM','OTHER')),
  start_date TEXT NOT NULL,
  end_date TEXT,
  provisional INTEGER NOT NULL DEFAULT 0,
  CHECK (end_date IS NULL OR start_date <= end_date)
);
INSERT INTO course_events (id, course_id, title, description, category, start_date, end_date, provisional)
SELECT event.id || ':' || link.course_id, link.course_id, event.title, event.description, event.category, event.start_date, event.end_date, event.provisional
FROM draft_events event JOIN draft_event_courses link ON link.event_id = event.id;

CREATE TABLE published_courses (
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL UNIQUE REFERENCES courses(id),
  published_at TEXT NOT NULL,
  area_name TEXT NOT NULL,
  program_name TEXT NOT NULL,
  program_abbreviation TEXT NOT NULL,
  code TEXT NOT NULL,
  study_start TEXT NOT NULL,
  study_end TEXT NOT NULL,
  semesters INTEGER NOT NULL
);
INSERT INTO published_courses (id, course_id, published_at, area_name, program_name, program_abbreviation, code, study_start, study_end, semesters)
SELECT snapshot.id, snapshot.source_course_id, version.published_at, version.area_name, snapshot.program_name, snapshot.program_abbreviation,
  snapshot.code, snapshot.study_start, snapshot.study_end, snapshot.semesters
FROM published_course_snapshots snapshot JOIN published_versions version ON version.id = snapshot.version_id;

CREATE TABLE published_phases (
  id TEXT PRIMARY KEY NOT NULL,
  published_course_id TEXT NOT NULL REFERENCES published_courses(id) ON DELETE CASCADE,
  semester INTEGER NOT NULL,
  phase_type TEXT NOT NULL CHECK (phase_type IN ('THEORY','PRACTICE')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  CHECK (start_date <= end_date)
);
INSERT INTO published_phases (id, published_course_id, semester, phase_type, start_date, end_date)
SELECT id, course_snapshot_id, semester, phase_type, start_date, end_date FROM _old_published_phases;

CREATE TABLE published_events (
  id TEXT PRIMARY KEY NOT NULL,
  published_course_id TEXT NOT NULL REFERENCES published_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('REGISTRATION','SUBMISSION','PRESENTATION','EXAM','OTHER')),
  start_date TEXT NOT NULL,
  end_date TEXT,
  provisional INTEGER NOT NULL DEFAULT 0,
  CHECK (end_date IS NULL OR start_date <= end_date)
);
-- The old event is copied once per affected course, just as draft events are above.
INSERT INTO published_events (id, published_course_id, title, description, category, start_date, end_date, provisional)
SELECT event.id || ':' || link.course_snapshot_id, link.course_snapshot_id, event.title, event.description, event.category, event.start_date, event.end_date, event.provisional
FROM _old_published_events event JOIN _old_published_event_courses link ON link.event_id = event.id;

CREATE TABLE published_course_search_keys (
  published_course_id TEXT PRIMARY KEY NOT NULL REFERENCES published_courses(id) ON DELETE CASCADE,
  normalized_code TEXT NOT NULL UNIQUE
);
INSERT INTO published_course_search_keys (published_course_id, normalized_code)
SELECT course_snapshot_id, normalized_code FROM _old_published_course_search_keys;

CREATE INDEX course_phases_by_course ON course_phases(course_id);
CREATE INDEX course_events_by_course ON course_events(course_id);
CREATE INDEX published_phases_by_course ON published_phases(published_course_id);
CREATE INDEX published_events_by_course ON published_events(published_course_id);

DROP TABLE draft_event_courses;
DROP TABLE draft_events;
DROP TABLE draft_phases;
DROP TABLE _old_published_event_courses;
DROP TABLE _old_published_events;
DROP TABLE _old_published_phases;
DROP TABLE _old_published_course_search_keys;
DROP TABLE published_course_snapshots;
DROP TABLE published_versions;
DROP TABLE _old_courses;
DROP TABLE block_plans;
DROP TABLE _course_model_guard;
