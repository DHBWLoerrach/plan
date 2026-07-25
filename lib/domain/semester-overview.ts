import { type PhaseType, phaseTypes } from "@/lib/domain/phase-type";
import type { DraftPhase } from "@/lib/domain/publication";

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
  codesWithOverlap: string[];
  phasesPerCourse: PhaseTypeSpread[];
}

/**
 * The state of every semester for the semester navigation of the editor (MVP-SPEZIFIKATION.md): how many course
 * phases it holds, how they are composed, which courses have none there yet and which ones already contradict
 * themselves. Overlapping phases of one course are the error the editor can name semester by semester; the complete
 * publication check belongs to the preview. Phases of the same kind may follow one another directly
 * (FACHLICHE_REGELN.md), so only real overlaps count.
 */
export function semesterOverview(courses: { id: string; code: string }[], phases: DraftPhase[], semesters: number): SemesterEntry[] {
  return Array.from({ length: semesters }, (_, index) => {
    const semester = index + 1;
    const ofSemester = phases.filter((phase) => phase.semester === semester);
    return {
      semester,
      phaseCount: ofSemester.length,
      codesWithoutPhase: courses.filter((course) => !ofSemester.some((phase) => phase.courseId === course.id)).map((course) => course.code),
      codesWithOverlap: courses.filter((course) => overlaps(ofSemester.filter((phase) => phase.courseId === course.id))).map((course) => course.code),
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

function overlaps(phases: DraftPhase[]): boolean {
  const ordered = phases.toSorted((left, right) => left.startDate.localeCompare(right.startDate));
  return ordered.some((phase, index) => index > 0 && phase.startDate <= ordered[index - 1].endDate);
}
