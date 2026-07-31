PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (
    length(email) BETWEEN 1 AND 254
    AND instr(email, ' ') = 0
    AND instr(email, char(9)) = 0
    AND instr(email, char(10)) = 0
    AND instr(email, char(11)) = 0
    AND instr(email, char(12)) = 0
    AND instr(email, char(13)) = 0
  ),
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  image TEXT,
  role TEXT NOT NULL DEFAULT 'NONE' CHECK (role IN ('NONE', 'AREA_EDITOR')),
  system_admin INTEGER NOT NULL DEFAULT 0 CHECK (system_admin IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'PASSWORD_PENDING' CHECK (status IN ('PASSWORD_PENDING', 'ACTIVE', 'LOCKED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at INTEGER,
  refresh_token_expires_at INTEGER,
  scope TEXT,
  password TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider_id, account_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  normalized_name TEXT NOT NULL UNIQUE CHECK (length(trim(normalized_name)) > 0)
);
CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY NOT NULL,
  area_id TEXT NOT NULL REFERENCES areas(id),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  abbreviation TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(abbreviation)) BETWEEN 1 AND 20),
  semesters INTEGER NOT NULL CHECK (semesters IN (6, 7))
);
CREATE TABLE IF NOT EXISTS area_assignments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id TEXT NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, area_id)
);
CREATE TABLE IF NOT EXISTS password_links (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY NOT NULL,
  program_id TEXT NOT NULL REFERENCES programs(id),
  code TEXT NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 32),
  normalized_code TEXT NOT NULL UNIQUE CHECK (length(trim(normalized_code)) > 0),
  study_start TEXT NOT NULL CHECK (date(study_start) IS NOT NULL AND date(study_start) = study_start),
  study_end TEXT NOT NULL CHECK (date(study_end) IS NOT NULL AND date(study_end) = study_end),
  published_at TEXT,
  updated_at TEXT NOT NULL,
  updated_by_account_id TEXT NOT NULL REFERENCES users(id),
  CHECK (study_start < study_end)
);
CREATE TABLE IF NOT EXISTS course_phases (
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  semester INTEGER NOT NULL CHECK (typeof(semester) = 'integer' AND semester BETWEEN 1 AND 7),
  phase_type TEXT NOT NULL CHECK (phase_type IN ('THEORY', 'PRACTICE')),
  start_date TEXT NOT NULL CHECK (date(start_date) IS NOT NULL AND date(start_date) = start_date),
  end_date TEXT NOT NULL CHECK (date(end_date) IS NOT NULL AND date(end_date) = end_date),
  CHECK (start_date <= end_date)
);
CREATE TABLE IF NOT EXISTS course_events (
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) >= 1 AND length(title) <= 160),
  description TEXT CHECK (description IS NULL OR (length(trim(description)) >= 1 AND length(description) <= 2000)),
  category TEXT NOT NULL CHECK (category IN ('REGISTRATION', 'SUBMISSION', 'PRESENTATION', 'EXAM', 'OTHER')),
  start_date TEXT NOT NULL CHECK (date(start_date) IS NOT NULL AND date(start_date) = start_date),
  end_date TEXT CHECK (end_date IS NULL OR (date(end_date) IS NOT NULL AND date(end_date) = end_date)),
  provisional INTEGER NOT NULL DEFAULT 0 CHECK (provisional IN (0, 1)),
  CHECK (end_date IS NULL OR start_date <= end_date)
);
