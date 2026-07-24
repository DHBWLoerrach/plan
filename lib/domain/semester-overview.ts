import type { DraftPhase } from "@/lib/domain/publication";

export interface SemesterEntry {
  semester: number;
  phaseCount: number;
  codesWithoutPhase: string[];
  codesWithOverlap: string[];
}

/**
 * The state of every semester for the semester navigation of the editor (MVP-SPEZIFIKATION.md): how many course
 * phases it holds, which courses have none there yet and which ones already contradict themselves. Overlapping phases
 * of one course are the error the editor can name semester by semester; the complete publication check belongs to the
 * preview. Phases of the same kind may follow one another directly (FACHLICHE_REGELN.md), so only real overlaps count.
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
    };
  });
}

function overlaps(phases: DraftPhase[]): boolean {
  const ordered = phases.toSorted((left, right) => left.startDate.localeCompare(right.startDate));
  return ordered.some((phase, index) => index > 0 && phase.startDate <= ordered[index - 1].endDate);
}
