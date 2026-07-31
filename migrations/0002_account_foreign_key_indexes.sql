-- The same rule as 0001, applied to the tables that hang off an internal account: SQLite creates no index for a
-- foreign key, and these are read by it on every sign-in, password change and lock, and walked by the cascading
-- delete of the account itself. `password_links.user_id` needs none, its UNIQUE constraint already indexes it.
CREATE INDEX IF NOT EXISTS accounts_by_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions(user_id);
-- Area assignments are read by account, which the primary key covers; this is the other direction, which the
-- cascading delete of an area takes.
CREATE INDEX IF NOT EXISTS area_assignments_by_area ON area_assignments(area_id);
