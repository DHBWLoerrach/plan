import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const user = sqliteTable("user", {
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

const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"), refreshToken: text("refreshToken"), idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
  scope: text("scope"), password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId)]);

const session = sqliteTable("session", {
  id: text("id").primaryKey(), token: text("token").notNull().unique(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(), ipAddress: text("ipAddress"), userAgent: text("userAgent"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

const verification = sqliteTable("verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(), createdAt: integer("createdAt", { mode: "timestamp_ms" }), updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
});

export const authSchema = { user, account, session, verification };
