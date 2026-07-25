import type { EventCategory } from "@/lib/domain/event-category";
import { type PhaseType, phaseTypeLabel } from "@/lib/domain/phase-type";

export interface DraftCourse {
  id: string;
  code: string;
  studyStart: string;
  studyEnd: string;
  semesters: number;
}

export interface DraftPhase {
  courseId: string;
  semester: number;
  type: PhaseType;
  startDate: string;
  endDate: string;
}

export interface DraftEvent {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  startDate: string;
  endDate: string | null;
  provisional: boolean;
  courseIds: string[];
}

export interface PublicationIssue {
  code:
    | "coverage-gap"
    | "coverage-overlap"
    | "semester-missing"
    | "semester-out-of-range"
    | "semester-not-monotonic"
    | "semester-not-contiguous"
    | "event-outside-study-period"
    | "event-semester-not-derivable"
    | "event-without-course";
  courseId?: string;
  eventId?: string;
  message: string;
}

export interface MatrixRow {
  startDate: string;
  endDate: string;
  cells: string[];
}

function plusDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The semester an event belongs to for one affected course: the semester of the course phase covering its start day
 * (FACHLICHE_REGELN.md). An event spanning a semester change therefore belongs to the semester of its beginning.
 * In an incomplete draft such a phase may be missing; the semester is then not derivable and stays `null`.
 */
export function deriveEventSemester(phases: DraftPhase[], courseId: string, startDate: string): number | null {
  const covering = phases.find((phase) => phase.courseId === courseId && phase.startDate <= startDate && phase.endDate >= startDate);
  return covering?.semester ?? null;
}

export function validatePublication({
  courses,
  phases,
  events,
}: {
  courses: DraftCourse[];
  phases: DraftPhase[];
  events: DraftEvent[];
}): PublicationIssue[] {
  const issues: PublicationIssue[] = [];

  for (const course of courses) {
    const coursePhases = phases
      .filter((phase) => phase.courseId === course.id)
      .toSorted((left, right) => left.startDate.localeCompare(right.startDate));
    const seenSemesters = new Set<number>();
    let previous: DraftPhase | undefined;

    for (const phase of coursePhases) {
      if (phase.semester < 1 || phase.semester > course.semesters) {
        issues.push({ code: "semester-out-of-range", courseId: course.id, message: `Semester ${phase.semester} von ${course.code} liegt außerhalb der Studiendauer.` });
      }
      if (previous) {
        if (phase.startDate <= previous.endDate) {
          issues.push({
            code: "coverage-overlap",
            courseId: course.id,
            message: `Kursphasen von ${course.code} überlappen sich.`,
          });
        } else if (phase.startDate !== plusDays(previous.endDate, 1)) {
          issues.push({
            code: "coverage-gap",
            courseId: course.id,
            message: `Der Verlauf von ${course.code} enthält eine Lücke.`,
          });
        }
        if (phase.semester < previous.semester) {
          issues.push({
            code: "semester-not-monotonic",
            courseId: course.id,
            message: `Die Semester von ${course.code} fallen entlang der Zeitachse.`,
          });
        }
        if (phase.semester !== previous.semester && seenSemesters.has(phase.semester)) {
          issues.push({
            code: "semester-not-contiguous",
            courseId: course.id,
            message: `Semester ${phase.semester} von ${course.code} ist nicht zusammenhängend.`,
          });
        }
      }
      seenSemesters.add(phase.semester);
      previous = phase;
    }

    if (coursePhases.length === 0 || coursePhases[0].startDate !== course.studyStart) {
      issues.push({
        code: "coverage-gap",
        courseId: course.id,
        message: `Der Verlauf von ${course.code} beginnt nicht mit dem Studienbeginn.`,
      });
    }
    if (!previous || previous.endDate !== course.studyEnd) {
      issues.push({
        code: "coverage-gap",
        courseId: course.id,
        message: `Der Verlauf von ${course.code} endet nicht mit dem Studienende.`,
      });
    }
    for (let semester = 1; semester <= course.semesters; semester += 1) {
      if (!seenSemesters.has(semester)) {
        issues.push({
          code: "semester-missing",
          courseId: course.id,
          message: `Semester ${semester} fehlt im Verlauf von ${course.code}.`,
        });
      }
    }
  }

  const coursesById = new Map(courses.map((course) => [course.id, course]));
  for (const event of events) {
    if (event.courseIds.length === 0) {
      issues.push({
        code: "event-without-course",
        eventId: event.id,
        message: `Der Termin „${event.title}“ benötigt mindestens einen betroffenen Kurs.`,
      });
      continue;
    }
    for (const courseId of event.courseIds) {
      const course = coursesById.get(courseId);
      if (
        !course ||
        event.startDate < course.studyStart ||
        event.startDate > course.studyEnd ||
        (event.endDate && (event.endDate < course.studyStart || event.endDate > course.studyEnd))
      ) {
        issues.push({
          code: "event-outside-study-period",
          eventId: event.id,
          message: `Der Termin „${event.title}“ liegt außerhalb eines Studienzeitraums.`,
        });
      } else if (deriveEventSemester(phases, courseId, event.startDate) === null) {
        issues.push({
          code: "event-semester-not-derivable",
          eventId: event.id,
          message: `Für den Termin „${event.title}“ ist kein Semester ableitbar.`,
        });
      }
    }
  }

  return issues;
}

export function buildSemesterMatrix(courses: DraftCourse[], phases: DraftPhase[], semester: number): MatrixRow[] {
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
      return phase ? phaseTypeLabel(phase.type) : "Nicht in diesem Semester";
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

export function getPublicationState(hasEverBeenPublished: boolean, hasPublishedVersion: boolean):
  | "never-published"
  | "published"
  | "withdrawn" {
  if (hasPublishedVersion) return "published";
  return hasEverBeenPublished ? "withdrawn" : "never-published";
}
