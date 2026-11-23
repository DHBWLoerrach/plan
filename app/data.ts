import "server-only";

import { cache } from "react";

import { sqlite } from "@/lib/db";
import { readPublicCourse, readPublicCut, readPublicOverview, type PublicCutDetail } from "@/lib/services/public-search";
import { berlinCalendarDay } from "@/lib/domain/calendar-day";
import { buildCourseDetail, type CourseDetail } from "@/lib/domain/course-detail";
import { buildPublicOverview } from "@/lib/domain/public-overview";
import { publicCutPath, type PublicCut } from "@/lib/domain/public-cut";

export type { PublicCutDetail };

/** The landing page's table of every published course that has not ended on the current Berlin calendar day. */
export function publicOverviewData() {
  const today = berlinCalendarDay();
  const { courses, phases, cutSizes, endedCourses } = readPublicOverview(sqlite, today);
  return buildPublicOverview(courses, phases, today, cutSizes, endedCourses);
}

const publicCutsForRequest = cache(() => new Map<string, PublicCutDetail | null>());

export function publicCutData(cut: PublicCut): PublicCutDetail | null {
  const cuts = publicCutsForRequest();
  // The page and its metadata create separate cut objects for the same path.
  const path = publicCutPath(cut);
  const cached = cuts.get(path);
  if (cached !== undefined) return cached;
  const detail = readPublicCut(sqlite, cut);
  cuts.set(path, detail);
  return detail;
}

const publicCoursesForRequest = cache(() => new Map<string, CourseDetail | null>());

/** The page of one published course and its metadata read it once per request, by the code as the address writes it. */
export function publicCourseData(code: string): CourseDetail | null {
  const courses = publicCoursesForRequest();
  const cached = courses.get(code);
  if (cached !== undefined) return cached;
  const read = readPublicCourse(sqlite, code);
  const detail = read && buildCourseDetail({ ...read, today: berlinCalendarDay() });
  courses.set(code, detail);
  return detail;
}

/** A single search parameter as the public URL carries it: a repeated parameter counts through its first value. */
export function searchParam(searchParams: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = searchParams[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first || undefined;
}
