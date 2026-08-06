import { berlinCalendarDay } from "@/lib/domain/calendar-day";
import { calendarEventsForView, courseCalendarView, normalizeCalendarAnchor } from "@/lib/domain/course-calendar";
import { sqlite } from "@/lib/db";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";
import { findCourseCalendarReference } from "@/lib/services/course-calendar-access";
import { readCourseCalendar } from "@/lib/services/course-calendar-feed";

type RouteContext = { params: Promise<{ courseId: string }> };

const privateHeaders = { "cache-control": "private, no-store" };

/** Current calendar entries for one managed course; authentication is repeated here because the route is callable directly. */
export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const account = await getActiveAccount();
  if (!account) return Response.json({ error: "unauthorized" }, { status: 401, headers: privateHeaders });
  if (!managesAnyArea(account)) return Response.json({ error: "forbidden" }, { status: 403, headers: privateHeaders });

  const { courseId } = await params;
  const course = findCourseCalendarReference(sqlite, courseId);
  if (!course) return Response.json({ error: "not_found" }, { status: 404, headers: privateHeaders });

  const result = await readCourseCalendar(course.code);
  if (result.kind === "not-found") return Response.json({ error: "calendar_not_found" }, { status: 404, headers: privateHeaders });
  if (result.kind === "unavailable") return Response.json({ error: "calendar_unavailable" }, { status: 502, headers: privateHeaders });
  const searchParams = new URL(request.url).searchParams;
  const requestedAnchor = searchParams.get("datum") ?? undefined;
  const anchor = normalizeCalendarAnchor(requestedAnchor, berlinCalendarDay());
  const view = courseCalendarView(searchParams.get("ansicht")) ?? "list";
  return Response.json({ events: calendarEventsForView(result.events, anchor, view) }, { headers: privateHeaders });
}
