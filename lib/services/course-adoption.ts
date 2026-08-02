import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import { planAdoption, type AdoptionTemplate, type TemplateEvent, type TemplatePhase } from "@/lib/domain/course-adoption";

/** What the creation form needs to preview an adoption, and what the creation itself copies from. */
export type AdoptionTemplateCourse = AdoptionTemplate & { id: string; code: string; program: string; areaName: string; semesters: number };
export type AdoptionInput = { templateCourseId: string; withPhases: boolean; withEvents: boolean };
/** An entry of the template select: the course it stands for and the text that decides the choice. */
export type AdoptionTemplateChoice = { id: string; label: string };
/** Whose study programs decide which templates can be adopted at all. */
export type AdoptionAccount = { id: string; systemAdmin: boolean };

/**
 * Reads a template with everything an adoption copies. Any existing course may be a template, whatever its area and
 * study program: the template worth copying is usually the one of another area, and it is only ever read (ADR 0011).
 */
export function readAdoptionTemplate(sqlite: Database.Database, courseId: string): AdoptionTemplateCourse | undefined {
  const course = sqlite.prepare(`SELECT course.id, course.code, program.name AS program, program.semesters, area.name AS areaName,
      course.study_start AS studyStart, course.study_end AS studyEnd
    FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id
    WHERE course.id = ?`).get(courseId) as Omit<AdoptionTemplateCourse, "phases" | "events"> | undefined;
  if (!course) return undefined;
  return { ...course, phases: templatePhases(sqlite, courseId), events: templateEvents(sqlite, courseId) };
}

function templatePhases(sqlite: Database.Database, courseId: string): TemplatePhase[] {
  return sqlite.prepare(`SELECT semester, phase_type AS type, start_date AS startDate, end_date AS endDate
    FROM course_phases WHERE course_id = ? ORDER BY start_date, semester`).all(courseId) as TemplatePhase[];
}

function templateEvents(sqlite: Database.Database, courseId: string): TemplateEvent[] {
  const rows = sqlite.prepare(`SELECT title, description, category, start_date AS startDate, end_date AS endDate, provisional
    FROM course_events WHERE course_id = ? ORDER BY start_date, title COLLATE NOCASE`).all(courseId) as (Omit<TemplateEvent, "provisional"> & { provisional: number })[];
  return rows.map((event) => ({ ...event, provisional: Boolean(event.provisional) }));
}

/**
 * Copies the planning state of the template into the newly created course. It runs inside the transaction of the
 * creation, so a course and its adoption are written together or not at all. Afterwards the two
 * courses share nothing: no link, no reconciliation and no common change.
 */
export function adoptIntoCourse(sqlite: Database.Database, input: {
  courseId: string;
  studyStart: string;
  studyEnd: string;
  semesters: number;
  adoption: AdoptionInput;
}): void {
  const template = readAdoptionTemplate(sqlite, input.adoption.templateCourseId);
  if (!template) throw new Error("Die angegebene Vorlage wurde nicht gefunden.");
  if (template.semesters !== input.semesters) {
    throw new Error(`Die Vorlage ${template.code} hat ${template.semesters} Semester, der gewählte Studiengang ${input.semesters}. Eine Übernahme setzt dieselbe Anzahl Semester voraus.`);
  }
  const adopted = planAdoption(template, { studyStart: input.studyStart, studyEnd: input.studyEnd, ...input.adoption });
  const addPhase = sqlite.prepare("INSERT INTO course_phases (id, course_id, semester, phase_type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)");
  for (const phase of adopted.phases) addPhase.run(randomUUID(), input.courseId, phase.semester, phase.type, phase.startDate, phase.endDate);
  const addEvent = sqlite.prepare(`INSERT INTO course_events (id, course_id, title, description, category, start_date, end_date, provisional)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const event of adopted.events) addEvent.run(randomUUID(), input.courseId, event.title, event.description, event.category, event.startDate, event.endDate, event.provisional ? 1 : 0);
}

/**
 * The courses this account can actually adopt from. Area and study program do not narrow it — the adoption worth
 * having is usually the one across areas, and a template is only ever read (ADR 0011). The number of semesters does:
 * an adoption requires template and target to agree on it, so a template no study program of this account matches
 * could only ever lead into a refusal after it was chosen. The label carries what decides the choice.
 */
export function adoptionTemplateChoices(sqlite: Database.Database, account: AdoptionAccount): AdoptionTemplateChoice[] {
  const rows = sqlite.prepare(`SELECT course.id, course.code, program.abbreviation, program.semesters, area.name AS areaName, substr(course.study_start, 1, 4) AS year
    FROM courses course JOIN programs program ON program.id = course.program_id JOIN areas area ON area.id = program.area_id
    WHERE program.semesters IN (SELECT target.semesters FROM programs target
      WHERE ? = 1 OR target.area_id IN (SELECT area_id FROM area_assignments WHERE user_id = ?))
    ORDER BY area.name COLLATE NOCASE, course.code COLLATE NOCASE`)
    .all(account.systemAdmin ? 1 : 0, account.id) as { id: string; code: string; abbreviation: string; semesters: number; areaName: string; year: string }[];
  return rows.map((course) => ({ id: course.id, label: `${course.code} — ${course.abbreviation}, Jahrgang ${course.year}, ${course.semesters} Semester (${course.areaName})` }));
}
