import "server-only";

import { cache } from "react";

import { sqlite } from "@/lib/db";
import { readPublicCut, readPublicOverview, type PublicCutDetail } from "@/lib/services/public-search";
import { berlinCalendarDay } from "@/lib/domain/calendar-day";
import { buildPublicOverview } from "@/lib/domain/public-overview";
import type { PublicCut } from "@/lib/domain/public-cut";

export type { PublicCutDetail };

/** The landing page's table of every published course that has not ended on the current Berlin calendar day. */
export function publicOverviewData() {
  const today = berlinCalendarDay();
  const { courses, phases, cutSizes } = readPublicOverview(sqlite, today);
  return buildPublicOverview(courses, phases, today, cutSizes);
}

/**
 * The current data of the published courses in one public cut, or `null` when none is visible. Page and `generateMetadata` ask for the
 * same data, so the read is memoised per request — the Next.js guide names React `cache` for reads without `fetch`.
 */
export const publicCutData = cache((cut: PublicCut): PublicCutDetail | null => readPublicCut(sqlite, cut));

/** A single search parameter as the public URL carries it: a repeated parameter counts through its first value. */
export function searchParam(searchParams: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = searchParams[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first || undefined;
}
