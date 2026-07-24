import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const areas = sqliteTable("areas", {
  id: text("id").primaryKey(), name: text("name").notNull(), normalizedName: text("normalized_name").notNull(),
}, (table) => [uniqueIndex("areas_normalized_name_unique").on(table.normalizedName)]);

export const programs = sqliteTable("programs", {
  id: text("id").primaryKey(), areaId: text("area_id").notNull(), name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(), semesters: integer("semesters").notNull(),
}, (table) => [uniqueIndex("programs_abbreviation_unique").on(table.abbreviation)]);

export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(), programId: text("program_id").notNull(), blockPlanId: text("block_plan_id"),
  code: text("code").notNull(), normalizedCode: text("normalized_code").notNull(),
  studyStart: text("study_start").notNull(), studyEnd: text("study_end").notNull(),
}, (table) => [uniqueIndex("courses_normalized_code_unique").on(table.normalizedCode)]);

export const blockPlans = sqliteTable("block_plans", {
  id: text("id").primaryKey(), areaId: text("area_id").notNull(), name: text("name"), normalizedName: text("normalized_name"),
  hasEverBeenPublished: integer("has_ever_been_published", { mode: "boolean" }).notNull().default(false),
  draftUpdatedAt: text("draft_updated_at").notNull(), draftUpdatedByAccountId: text("draft_updated_by_account_id"),
});
