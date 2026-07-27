import { connection } from "next/server";

import { sqlite } from "@/lib/db";
import { readPublicCourseBlockPlan } from "@/lib/services/public-course-api";

type RouteContext = { params: Promise<{ courseCode: string }> };

const publicApiHeaders = {
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
};

/** A read-only, cross-origin public representation of the published phases of one course. */
export async function GET(_: Request, { params }: RouteContext): Promise<Response> {
  // Synchronous SQLite reads must start at request time rather than during the production build.
  await connection();
  const { courseCode } = await params;
  const result = readPublicCourseBlockPlan(sqlite, courseCode);
  if (result.kind === "not-found") return Response.json({ error: "not_found" }, { status: 404, headers: publicApiHeaders });
  if (result.kind === "ambiguous") return Response.json({ error: "ambiguous_course_code" }, { status: 409, headers: publicApiHeaders });
  return Response.json(result.data, { headers: publicApiHeaders });
}
