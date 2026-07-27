import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth";
import { sqlite } from "@/lib/db";

export type ActiveAccount = { id: string; email: string; role: "NONE" | "AREA_EDITOR"; systemAdmin: boolean; areaIds: string[] };

/**
 * Whether the account may manage at least one area: system administration always, an area editor with at least one
 * assigned area. It mirrors what `assertAreaEditPermission` grants and only decides what to show — every target page
 * and every server operation checks the permission again (MVP-SPEZIFIKATION.md).
 */
export function managesAnyArea(account: ActiveAccount): boolean {
  return account.systemAdmin || (account.role === "AREA_EDITOR" && account.areaIds.length > 0);
}

export const getActiveAccount = cache(async (): Promise<ActiveAccount | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const account = sqlite.prepare("SELECT id, email, role, system_admin AS systemAdmin, status FROM user WHERE id = ?").get(session.user.id) as
    | { id: string; email: string; role: "NONE" | "AREA_EDITOR"; systemAdmin: number; status: string }
    | undefined;
  if (!account || account.status !== "ACTIVE") return null;
  const areaIds = (sqlite.prepare("SELECT area_id AS areaId FROM area_assignments WHERE user_id = ?").all(account.id) as { areaId: string }[]).map((assignment) => assignment.areaId);
  return { ...account, systemAdmin: Boolean(account.systemAdmin), areaIds };
});
