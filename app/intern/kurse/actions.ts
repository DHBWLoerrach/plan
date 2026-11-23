"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sqlite } from "@/lib/db";
import { createCourse, deleteCourse, updateCourse } from "@/lib/services/course-admin";
import { StaleStateError, publishCourse, withdrawCourse } from "@/lib/services/publication";

import { errorMessage, requireAccountId } from "../action-helpers";

function courseInput(formData: FormData) {
  return {
    code: String(formData.get("code") ?? ""),
    programId: String(formData.get("programId") ?? ""),
    studyStart: String(formData.get("studyStart") ?? ""),
    studyEnd: String(formData.get("studyEnd") ?? ""),
  };
}

/**
 * The adoption of the creation form, or nothing when the course is created empty. What is copied is recomputed here
 * from the template rather than taken from the form: the preview shows the outcome, it does not carry it.
 */
function adoptionInput(formData: FormData) {
  const templateCourseId = String(formData.get("templateCourseId") ?? "").trim();
  if (!templateCourseId) return undefined;
  return { templateCourseId, withPhases: formData.get("withPhases") !== null, withEvents: formData.get("withEvents") !== null };
}

/**
 * The generated course progression as the form submits it. The form serializes what it previewed — including any boundary
 * corrected by hand — as one field; the service checks it against the study period before writing it.
 */
function planInput(formData: FormData) {
  const raw = String(formData.get("plan") ?? "").trim();
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Der erzeugte Studienplan konnte nicht gelesen werden. Berechnen Sie ihn neu.");
  }
  if (!Array.isArray(parsed)) throw new Error("Der erzeugte Studienplan konnte nicht gelesen werden. Berechnen Sie ihn neu.");
  return parsed as { semester: unknown; type: unknown; startDate: unknown; endDate: unknown }[];
}

export type CourseFormState = { error?: string; success?: string };
export type CoursePublicationFormState = { error?: string };

/**
 * Every internal view that presents courses or their plans. The course page is named by its route pattern, because a
 * course appears not only on its own page but as a comparison on the pages of its parallel courses.
 */
function revalidateCourseViews(courseId: string) {
  revalidatePath("/intern");
  revalidatePath("/intern/kurse");
  revalidatePath(`/intern/kurse/${courseId}`);
  revalidatePath("/intern/kurse/[courseId]", "page");
}

/** Creating a course as an adoption from a template — one of the two ways into a new course, never combined with the other. */
export async function createCourseAction(_: CourseFormState, formData: FormData): Promise<CourseFormState> {
  let courseId: string;
  try {
    courseId = createCourse(sqlite, { accountId: await requireAccountId(), ...courseInput(formData), adoption: adoptionInput(formData) });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateCourseViews(courseId);
  redirect(`/intern/kurse/${courseId}?angelegt=1`);
}

/** Creating a course with a generated course progression — the other way, and the one that leaves a complete plan behind. */
export async function createGeneratedCourseAction(_: CourseFormState, formData: FormData): Promise<CourseFormState> {
  let courseId: string;
  try {
    courseId = createCourse(sqlite, { accountId: await requireAccountId(), ...courseInput(formData), plan: planInput(formData) });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateCourseViews(courseId);
  redirect(`/intern/kurse/${courseId}?angelegt=1`);
}

export async function updateCourseAction(_: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const courseId = String(formData.get("courseId") ?? "");
  try {
    updateCourse(sqlite, { accountId: await requireAccountId(), courseId, ...courseInput(formData) });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateCourseViews(courseId);
  return { success: "Die Kursangaben wurden gespeichert." };
}

export async function deleteCourseAction(_: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const courseId = String(formData.get("courseId") ?? "");
  try {
    deleteCourse(sqlite, { accountId: await requireAccountId(), courseId });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidateCourseViews(courseId);
  redirect("/intern/kurse?geloescht=1");
}

export async function publishCourseAction(_: CoursePublicationFormState, formData: FormData): Promise<CoursePublicationFormState> {
  const courseId = String(formData.get("courseId") ?? "");
  try {
    publishCourse(sqlite, { courseId, accountId: await requireAccountId(), seenUpdatedAt: String(formData.get("updatedAt") ?? ""), seenPublishedAt: String(formData.get("publishedAt") ?? "") || null });
  } catch (error) {
    if (error instanceof StaleStateError) return { error: "Der angezeigte Planungsstand hat sich geändert. Laden Sie die Seite neu." };
    return { error: errorMessage(error) };
  }
  revalidateCourseViews(courseId);
  return {};
}

export async function withdrawCourseAction(_: CoursePublicationFormState, formData: FormData): Promise<CoursePublicationFormState> {
  const courseId = String(formData.get("courseId") ?? "");
  try {
    withdrawCourse(sqlite, { courseId, accountId: await requireAccountId(), seenPublishedAt: String(formData.get("publishedAt") ?? "") });
  } catch (error) {
    if (error instanceof StaleStateError) return { error: "Die angezeigte Veröffentlichung hat sich geändert. Laden Sie die Seite neu." };
    return { error: errorMessage(error) };
  }
  revalidateCourseViews(courseId);
  return {};
}
