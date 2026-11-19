import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sqlite } from "@/lib/db";
import { berlinCalendarDay } from "@/lib/domain/calendar-day";
import { getActiveAccount, managesAnyArea, type ActiveAccount } from "@/lib/internal-auth";

import { managedCourseAreaCounts } from "./kurse/data";

type CourseAreaView = "overview" | "today";
const areaSelectionCourseThreshold = 12;

function courseAreaCookieName(view: CourseAreaView, accountId: string): string {
  return `${view}-area-${Buffer.from(accountId).toString("base64url")}`;
}

function courseAreaOptions(account: ActiveAccount, view: CourseAreaView, today: string) {
  const areas = managedCourseAreaCounts(sqlite, account, view === "today" ? today : undefined);
  const courseCount = areas.reduce((total, area) => total + area.courseCount, 0);
  return areas.length > 1 && courseCount >= areaSelectionCourseThreshold ? areas : [];
}

export async function readCourseAreaSelection(account: ActiveAccount, view: CourseAreaView, today: string) {
  const savedAreaId = (await cookies()).get(courseAreaCookieName(view, account.id))?.value;
  const areas = courseAreaOptions(account, view, today);
  return { areas, selectedArea: areas.find((area) => area.id === savedAreaId) };
}

export async function selectCourseAreaAction(view: CourseAreaView, formData: FormData) {
  "use server";

  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (view !== "overview" && view !== "today") redirect("/intern");

  const areaId = formData.get("areaId");
  if (managesAnyArea(account) && typeof areaId === "string" &&
    ((view === "today" && areaId === "") || courseAreaOptions(account, view, berlinCalendarDay()).some((area) => area.id === areaId))) {
    (await cookies()).set(courseAreaCookieName(view, account.id), areaId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/intern",
      maxAge: areaId ? 365 * 24 * 60 * 60 : 0,
    });
  }

  redirect(view === "today" ? "/intern/heute" : "/intern");
}
