-- Indexes on the foreign keys of the draft tables. SQLite indexes a primary key and a unique
-- constraint on its own, but never a foreign key, so every read of one block plan's draft scanned
-- the whole phase and event tables. The internal start page checks each of its plans that way, which
-- made it cost the square of the number of block plans.
CREATE INDEX IF NOT EXISTS courses_by_block_plan ON courses(block_plan_id);
CREATE INDEX IF NOT EXISTS draft_phases_by_block_plan ON draft_phases(block_plan_id);
CREATE INDEX IF NOT EXISTS draft_events_by_block_plan ON draft_events(block_plan_id);
-- The event link table is indexed by event through its primary key, but not by course: deleting a
-- course has SQLite look for referencing links, and removing one from a plan deletes them by course.
CREATE INDEX IF NOT EXISTS draft_event_courses_by_course ON draft_event_courses(course_id);
-- Same for the phases of a course, which are deleted whenever a course leaves a block plan.
CREATE INDEX IF NOT EXISTS draft_phases_by_course ON draft_phases(course_id);
