import "server-only";

import { cache } from "react";

import { sqlite } from "@/lib/db";
import {
  berlinCalendarDay,
  readPublicFilterOptions,
  readPublicPlan,
  searchPublicPlans,
  type PublicFilters,
  type PublicPlanDetail,
  type PublicSearchResult,
} from "@/lib/services/public-search";

export type { PublicFilters, PublicPlanDetail, PublicSearchResult };

/** The filter options and the matching page of published plans, grouped for the current Berlin calendar day. */
export function publicSearchData(request: PublicFilters & { page?: string }) {
  return {
    options: readPublicFilterOptions(sqlite),
    result: searchPublicPlans(sqlite, request, berlinCalendarDay()),
  };
}

/**
 * The published version of a block plan, or `null` when none is publicly visible. Page and `generateMetadata` ask for
 * the same plan, so the read is memoised per request — the Next.js guide names React `cache` for reads without `fetch`.
 */
export const publicPlanData = cache((blockPlanId: string): PublicPlanDetail | null => readPublicPlan(sqlite, blockPlanId));

/** A single search parameter as the public URL carries it: a repeated parameter counts through its first value. */
export function searchParam(searchParams: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = searchParams[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first || undefined;
}
