import "server-only";

import { cache } from "react";

import { sqlite } from "@/lib/db";
import {
  readPublicCut,
  readPublicFilterOptions,
  searchPublicPlans,
  type PublicCutDetail,
  type PublicFilters,
  type PublicSearchResult,
} from "@/lib/services/public-search";
import { berlinCalendarDay } from "@/lib/domain/calendar-day";
import type { PublicCut } from "@/lib/domain/public-cut";

export type { PublicCutDetail, PublicFilters, PublicSearchResult };

/** The filter options and the matching page of published plans, grouped for the current Berlin calendar day. */
export function publicSearchData(request: PublicFilters & { page?: string }) {
  return {
    options: readPublicFilterOptions(sqlite),
    result: searchPublicPlans(sqlite, request, berlinCalendarDay()),
  };
}

/**
 * The published snapshots of one public cut, or `null` when none is visible. Page and `generateMetadata` ask for the
 * same data, so the read is memoised per request — the Next.js guide names React `cache` for reads without `fetch`.
 */
export const publicCutData = cache((cut: PublicCut): PublicCutDetail | null => readPublicCut(sqlite, cut));

/** A single search parameter as the public URL carries it: a repeated parameter counts through its first value. */
export function searchParam(searchParams: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = searchParams[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first || undefined;
}
