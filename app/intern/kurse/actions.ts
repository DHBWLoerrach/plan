"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";
import { createCourse, deleteCourse, updateCourse } from "@/lib/services/course-admin";

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

/**
 * Every view a course change reaches: its own pages, and the block plan views — course codes and study periods feed
 * the derived block plan name and its year, and a block-plan-less course is what a new block plan starts from.
 */
function revalidateCourseViews(courseId: string) {
  revalidatePath("/intern");
  revalidatePath("/intern/kurse");
  revalidatePath(`/intern/kurse/${courseId}`);
  revalidatePath("/intern/blockplaene");
}

export async function createCourseAction(_: CourseFormState, formData: FormData): Promise<CourseFormState> {
  let courseId: string;
  try {
    courseId = createCourse(sqlite, { accountId: await requireAccountId(), createTechnicalPlan: true, ...courseInput(formData) });
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
