-- SQLite does not create indexes for foreign keys. These indexes keep course reads and cascading deletes bounded.
CREATE INDEX IF NOT EXISTS course_phases_by_course ON course_phases(course_id);
CREATE INDEX IF NOT EXISTS course_events_by_course ON course_events(course_id);
