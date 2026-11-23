import "server-only";

import { cache } from "react";

import { sqlite } from "@/lib/db";
import { readPublicCut, readPublicOverview, type PublicCutDetail } from "@/lib/services/public-search";
import { berlinCalendarDay } from "@/lib/domain/calendar-day";
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

/** A single search parameter as the public URL carries it: a repeated parameter counts through its first value. */
export function searchParam(searchParams: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = searchParams[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first || undefined;
}
