import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { sqlite } from "@/lib/db";

export type ActiveAccount = { id: string; email: string; role: "NONE" | "AREA_EDITOR"; systemAdmin: boolean; areaIds: string[] };

export async function getActiveAccount(): Promise<ActiveAccount | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const account = sqlite.prepare("SELECT id, email, role, system_admin AS systemAdmin, status FROM user WHERE id = ?").get(session.user.id) as
    | { id: string; email: string; role: "NONE" | "AREA_EDITOR"; systemAdmin: number; status: string }
    | undefined;
  if (!account || account.status !== "ACTIVE") return null;
  const areaIds = (sqlite.prepare("SELECT area_id AS areaId FROM area_assignments WHERE user_id = ?").all(account.id) as { areaId: string }[]).map((assignment) => assignment.areaId);
  return { ...account, systemAdmin: Boolean(account.systemAdmin), areaIds };
}
