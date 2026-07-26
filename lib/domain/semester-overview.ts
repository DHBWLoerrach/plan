import { type PhaseType, phaseTypes } from "@/lib/domain/phase-type";
import type { DraftPhase, PublicationIssue } from "@/lib/domain/publication";

/** How often a phase type occurs per course, as the range over all courses of the block plan. */
export interface PhaseTypeSpread {
  type: PhaseType;
  min: number;
  max: number;
}

export interface SemesterEntry {
  semester: number;
  phaseCount: number;
  codesWithoutPhase: string[];
  phasesPerCourse: PhaseTypeSpread[];
}

export type SemesterWorkState = {
  kind: "not-started" | "issues" | "ready";
  label: string;
  issueCount: number;
};

/**
 * The action-oriented state shown in the editor's semester navigation. The release check is the canonical source for
 * work that remains; phase composition is useful context but must not imply that a semester can already be released.
 */
export function semesterWorkState(entry: SemesterEntry, issues: PublicationIssue[]): SemesterWorkState {
  const issueCount = issues.filter((issue) => !issue.eventId && issue.semester === entry.semester).length;
  if (!entry.phaseCount) return { kind: "not-started", label: "Nicht begonnen", issueCount };
  if (issueCount) {
    return {
      kind: "issues",
      label: issueCount === 1 ? "1 offener Punkt" : `${issueCount} offene Punkte`,
      issueCount,
    };
  }
  return { kind: "ready", label: "Bereit", issueCount: 0 };
}

/**
 * The state of every semester for the semester navigation of the editor (MVP-SPEZIFIKATION.md): how many course
 * phases it holds, how they are composed, and which courses have none there yet. Actionable errors come from the
 * canonical publication check rather than being calculated a second time here.
 */
export function semesterOverview(courses: { id: string; code: string }[], phases: DraftPhase[], semesters: number): SemesterEntry[] {
  return Array.from({ length: semesters }, (_, index) => {
    const semester = index + 1;
    const ofSemester = phases.filter((phase) => phase.semester === semester);
    return {
      semester,
      phaseCount: ofSemester.length,
      codesWithoutPhase: courses.filter((course) => !ofSemester.some((phase) => phase.courseId === course.id)).map((course) => course.code),
      phasesPerCourse: spreadPerCourse(courses, ofSemester),
    };
  });
}

/**
 * A semester usually holds one theory and one practice phase per course, but deviations are legitimate, so the editor
 * states the composition instead of judging it. Counting per course keeps the numbers small no matter how many courses
 * the block plan carries, and a min below the max is precisely where the courses drift apart.
 */
function spreadPerCourse(courses: { id: string }[], ofSemester: DraftPhase[]): PhaseTypeSpread[] {
  if (!courses.length) return [];
  return phaseTypes.flatMap(({ value }) => {
    const counts = courses.map((course) =>
      ofSemester.filter((phase) => phase.courseId === course.id && phase.type === value).length);
    const max = Math.max(...counts);
    return max ? [{ type: value, min: Math.min(...counts), max }] : [];
  });
}
