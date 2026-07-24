import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("NONE"),
  systemAdmin: integer("system_admin", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("PASSWORD_PENDING"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

export const accounts = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"), refreshToken: text("refreshToken"), idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
  scope: text("scope"), password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId)]);

export const sessions = sqliteTable("session", {
  id: text("id").primaryKey(), token: text("token").notNull().unique(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(), ipAddress: text("ipAddress"), userAgent: text("userAgent"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

export const verifications = sqliteTable("verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(), createdAt: integer("createdAt", { mode: "timestamp_ms" }), updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
});

export const areas = sqliteTable("areas", {
  id: text("id").primaryKey(), name: text("name").notNull(), normalizedName: text("normalized_name").notNull(),
}, (table) => [uniqueIndex("areas_normalized_name_unique").on(table.normalizedName)]);

export const programs = sqliteTable("programs", {
  id: text("id").primaryKey(), areaId: text("area_id").notNull().references(() => areas.id), name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(), semesters: integer("semesters").notNull(),
}, (table) => [uniqueIndex("programs_abbreviation_unique").on(table.abbreviation)]);

export const areaAssignments = sqliteTable("area_assignments", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  areaId: text("area_id").notNull().references(() => areas.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.userId, table.areaId] })]);

export const passwordLinks = sqliteTable("password_links", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(), expiresAt: text("expires_at").notNull(), createdAt: text("created_at").notNull(),
});

export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(), programId: text("program_id").notNull().references(() => programs.id), blockPlanId: text("block_plan_id"),
  code: text("code").notNull(), normalizedCode: text("normalized_code").notNull(),
  studyStart: text("study_start").notNull(), studyEnd: text("study_end").notNull(),
}, (table) => [uniqueIndex("courses_normalized_code_unique").on(table.normalizedCode)]);

export const blockPlans = sqliteTable("block_plans", {
  id: text("id").primaryKey(), areaId: text("area_id").notNull().references(() => areas.id), name: text("name"), normalizedName: text("normalized_name"),
  hasEverBeenPublished: integer("has_ever_been_published", { mode: "boolean" }).notNull().default(false),
  draftUpdatedAt: text("draft_updated_at").notNull(), draftUpdatedByAccountId: text("draft_updated_by_account_id").references(() => users.id),
});
