import type { CoursePlan } from "@/lib/domain/publication";

export type TransferSelection = { sourceCourseId: string; targetCourseIds: string[] };
export type TransferKind = "phase" | "event";
export type TransferCourse = Pick<CoursePlan, "id" | "code" | "semesters" | "studyStart" | "studyEnd"> & { publishedAt: string | null };

export function transferRefusal(source: TransferCourse, target: TransferCourse, kind: TransferKind): string | null {
  const targetYear = target.studyStart.slice(0, 4);
  if (targetYear !== source.studyStart.slice(0, 4)) return `${target.code} gehört zu Jahrgang ${targetYear} und steht damit nicht im Vergleich von ${source.code}`;
  if (kind === "event") return null;
  if (target.publishedAt) return `${target.code} ist veröffentlicht; in einen lückenlosen veröffentlichten Verlauf wird keine einzelne Kursphase ergänzt`;
  if (target.semesters !== source.semesters) return `${target.code} hat eine andere Anzahl Semester als ${source.code}`;
  if (target.studyStart !== source.studyStart || target.studyEnd !== source.studyEnd) return `${target.code} hat einen anderen Studienzeitraum als ${source.code}`;
  return null;
}
