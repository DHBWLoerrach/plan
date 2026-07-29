"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";
import { createCourse, deleteCourse, updateCourse } from "@/lib/services/course-admin";
import { StaleStateError, publishCourse, withdrawCourse } from "@/lib/services/publication";

async function requireAccountId() {
  const account = await getActiveAccount();
  if (!account) throw new Error("Ihre Sitzung ist nicht mehr gültig.");
  return account.id;
}

function courseInput(formData: FormData) {
  return {
    code: String(formData.get("code") ?? ""),
    programId: String(formData.get("programId") ?? ""),
    studyStart: String(formData.get("studyStart") ?? ""),
    studyEnd: String(formData.get("studyEnd") ?? ""),
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Die Aktion konnte nicht ausgeführt werden.";
}

export type CourseFormState = { error?: string; success?: string };
export type CoursePublicationFormState = { error?: string };

/**
 * Every internal view that presents courses or their selected planning cut.
 */
function revalidateCourseViews(courseId: string) {
  revalidatePath("/intern");
  revalidatePath("/intern/kurse");
  revalidatePath(`/intern/kurse/${courseId}`);
  revalidatePath("/intern/kurse/zuschnitt");
}

export async function createCourseAction(_: CourseFormState, formData: FormData): Promise<CourseFormState> {
  let courseId: string;
  try {
    courseId = createCourse(sqlite, { accountId: await requireAccountId(), ...courseInput(formData) });
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
    publishCourse(sqlite, { courseId, accountId: await requireAccountId(), seenDraftUpdatedAt: String(formData.get("draftUpdatedAt") ?? ""), seenPublishedCourseId: String(formData.get("publishedCourseId") ?? "") || null });
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
    withdrawCourse(sqlite, { courseId, accountId: await requireAccountId(), seenPublishedCourseId: String(formData.get("publishedCourseId") ?? "") });
  } catch (error) {
    if (error instanceof StaleStateError) return { error: "Die angezeigte Veröffentlichung hat sich geändert. Laden Sie die Seite neu." };
    return { error: errorMessage(error) };
  }
  revalidateCourseViews(courseId);
  return {};
}
