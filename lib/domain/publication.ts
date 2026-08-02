import { plusDays } from "@/lib/domain/calendar-day";
import type { EventCategory } from "@/lib/domain/event-category";
import { type PhaseType, phaseTypeLabel } from "@/lib/domain/phase-type";

export interface CoursePlan {
  id: string;
  code: string;
  studyStart: string;
  studyEnd: string;
  semesters: number;
}

export interface CoursePhase {
  courseId: string;
  semester: number;
  type: PhaseType;
  startDate: string;
  endDate: string;
}

/** A saved phase as the editor lists it: the domain data plus its identity and the code of its course. */
export type PlanPhase = CoursePhase & { id: string; code: string };

export interface CourseEvent {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  startDate: string;
  endDate: string | null;
  provisional: boolean;
  courseIds: string[];
}

/** A saved event as the editor lists it: the domain data plus the code of the one course it belongs to. */
export type PlanEvent = CourseEvent & { code: string };

/** The editor field an issue points at; `null` when the correction is a missing or excess entry rather than a value. */
export type PublicationIssueField = "startDate" | "endDate" | "semester";

export interface PublicationIssue {
  code:
    | "coverage-gap"
    | "coverage-overlap"
    | "semester-missing"
    | "semester-out-of-range"
    | "semester-not-monotonic"
    | "semester-not-contiguous"
    | "event-outside-study-period"
    | "event-semester-not-derivable";
  /** The semester whose editor corrects the issue; `null` when it belongs to no single semester. */
  semester: number | null;
  field: PublicationIssueField | null;
  courseId?: string;
  eventId?: string;
  message: string;
}

export interface MatrixRow {
  startDate: string;
  endDate: string;
  cells: string[];
}

/**
 * The semester an event belongs to for one affected course: the semester of the course phase covering its start day.
 * An event spanning a semester change therefore belongs to the semester of its beginning.
 * In an incomplete unpublished course such a phase may be missing; the semester is then not derivable and stays `null`.
 */
export function deriveEventSemester(phases: CoursePhase[], courseId: string, startDate: string): number | null {
  const covering = phases.find((phase) => phase.courseId === courseId && phase.startDate <= startDate && phase.endDate >= startDate);
  return covering?.semester ?? null;
}

export function validatePublication({
  course,
  phases,
  events,
}: {
  course: CoursePlan;
  phases: CoursePhase[];
  events: Omit<CourseEvent, "courseIds">[];
}): PublicationIssue[] {
  const issues: PublicationIssue[] = [];
  const coursePhases = phases
    .filter((phase) => phase.courseId === course.id)
    .toSorted((left, right) => left.startDate.localeCompare(right.startDate));
  const seenSemesters = new Set<number>();
  let previous: CoursePhase | undefined;

  for (const phase of coursePhases) {
    if (phase.semester < 1 || phase.semester > course.semesters) {
      issues.push({ code: "semester-out-of-range", courseId: course.id, semester: phase.semester, field: "semester", message: `Semester ${phase.semester} von ${course.code} liegt außerhalb der Studiendauer.` });
    }
    if (previous) {
      if (phase.startDate <= previous.endDate) {
        issues.push({ code: "coverage-overlap", courseId: course.id, semester: phase.semester, field: "startDate", message: `Kursphasen von ${course.code} überlappen sich.` });
      } else if (phase.startDate !== plusDays(previous.endDate, 1)) {
        issues.push({ code: "coverage-gap", courseId: course.id, semester: phase.semester, field: "startDate", message: `Der Verlauf von ${course.code} enthält eine Lücke.` });
      }
      if (phase.semester < previous.semester) {
        issues.push({ code: "semester-not-monotonic", courseId: course.id, semester: phase.semester, field: "semester", message: `Die Semester von ${course.code} fallen entlang der Zeitachse.` });
      }
      if (phase.semester !== previous.semester && seenSemesters.has(phase.semester)) {
        issues.push({ code: "semester-not-contiguous", courseId: course.id, semester: phase.semester, field: "semester", message: `Semester ${phase.semester} von ${course.code} ist nicht zusammenhängend.` });
      }
    }
    seenSemesters.add(phase.semester);
    previous = phase;
  }

  if (coursePhases.length === 0 || coursePhases[0].startDate !== course.studyStart) {
    issues.push({ code: "coverage-gap", courseId: course.id, semester: coursePhases[0]?.semester ?? 1, field: "startDate", message: `Der Verlauf von ${course.code} beginnt nicht mit dem Studienbeginn.` });
  }
  if (!previous || previous.endDate !== course.studyEnd) {
    issues.push({ code: "coverage-gap", courseId: course.id, semester: previous?.semester ?? course.semesters, field: "endDate", message: `Der Verlauf von ${course.code} endet nicht mit dem Studienende.` });
  }
  for (let semester = 1; semester <= course.semesters; semester += 1) {
    if (!seenSemesters.has(semester)) {
      issues.push({ code: "semester-missing", courseId: course.id, semester, field: null, message: `Semester ${semester} fehlt im Verlauf von ${course.code}.` });
    }
  }

  for (const event of events) {
    const startOutside = event.startDate < course.studyStart || event.startDate > course.studyEnd;
    const endOutside = Boolean(event.endDate && (event.endDate < course.studyStart || event.endDate > course.studyEnd));
    if (startOutside || endOutside) {
      issues.push({ code: "event-outside-study-period", eventId: event.id, courseId: course.id, semester: null, field: startOutside ? "startDate" : "endDate", message: `Der Termin „${event.title}“ liegt außerhalb des Studienzeitraums von ${course.code}.` });
    } else if (deriveEventSemester(phases, course.id, event.startDate) === null) {
      issues.push({ code: "event-semester-not-derivable", eventId: event.id, courseId: course.id, semester: null, field: "startDate", message: `Für den Termin „${event.title}“ ist bei ${course.code} kein Semester ableitbar.` });
    }
  }

  return issues;
}

/** What a matrix cell says where a course has no phase covering the period of its row. */
export const noPhaseLabel = "Nicht in diesem Semester";

export function buildSemesterMatrix(courses: CoursePlan[], phases: CoursePhase[], semester: number): MatrixRow[] {
  const semesterPhases = phases.filter((phase) => phase.semester === semester);
  const boundaries = new Set<string>();
  for (const phase of semesterPhases) {
    boundaries.add(phase.startDate);
    boundaries.add(plusDays(phase.endDate, 1));
  }
  const orderedBoundaries = [...boundaries].toSorted();
  const rows: MatrixRow[] = [];

  for (let index = 0; index < orderedBoundaries.length - 1; index += 1) {
    const startDate = orderedBoundaries[index];
    const endDate = plusDays(orderedBoundaries[index + 1], -1);
    const cells = courses.map((course) => {
      const phase = semesterPhases.find(
        (candidate) => candidate.courseId === course.id && candidate.startDate <= startDate && candidate.endDate >= endDate,
      );
      return phase ? phaseTypeLabel(phase.type) : noPhaseLabel;
    });
    const previous = rows.at(-1);
    if (previous && previous.cells.every((cell, cellIndex) => cell === cells[cellIndex])) {
      previous.endDate = endDate;
    } else {
      rows.push({ startDate, endDate, cells });
    }
  }

  return rows;
}
