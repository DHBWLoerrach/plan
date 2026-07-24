import type Database from "better-sqlite3";

export type AssignableCourse = { id: string; areaId: string; semesters: number; studyStart: string };

/**
 * The structural rule behind every course assignment (FACHLICHE_REGELN.md): the study program belongs to the area of
 * the block plan, and year and number of semesters match all courses already assigned. It guards both assigning a
 * course and changing a course that is already assigned, so the course itself never compares against itself.
 */
export function assertCourseFitsBlockPlan(sqlite: Database.Database, blockPlanId: string, course: AssignableCourse): void {
  const plan = sqlite.prepare("SELECT area_id AS areaId FROM block_plans WHERE id = ?").get(blockPlanId) as { areaId: string } | undefined;
  if (!plan || course.areaId !== plan.areaId) throw new Error("Der Studiengang gehört nicht zum Bereich des zugeordneten Blockplans.");
  const others = sqlite.prepare(`SELECT other.study_start AS studyStart, program.semesters FROM courses other
    JOIN programs program ON program.id = other.program_id WHERE other.block_plan_id = ? AND other.id <> ?`).all(blockPlanId, course.id) as
    { studyStart: string; semesters: number }[];
  for (const other of others) {
    if (other.semesters !== course.semesters) throw new Error("Die Semesteranzahl passt nicht zu den anderen Kursen des zugeordneten Blockplans.");
    if (year(other.studyStart) !== year(course.studyStart)) throw new Error("Der Jahrgang passt nicht zu den anderen Kursen des zugeordneten Blockplans.");
  }
}

function year(isoDate: string): string {
  return isoDate.slice(0, 4);
}
