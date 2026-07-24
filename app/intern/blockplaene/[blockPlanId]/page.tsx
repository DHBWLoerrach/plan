import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { getActiveAccount } from "@/lib/internal-auth";

import { publishAction, withdrawAction } from "../../actions";

export default async function InternalBlockPlanPage({ params }: PageProps<"/intern/blockplaene/[blockPlanId]">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  const { blockPlanId } = await params;
  const plan = sqlite.prepare(`SELECT plan.id, plan.name, plan.area_id AS areaId, plan.draft_updated_at AS draftUpdatedAt, version.id AS versionId
    FROM block_plans plan LEFT JOIN published_versions version ON version.block_plan_id = plan.id WHERE plan.id = ?`).get(blockPlanId) as { id: string; name: string | null; areaId: string; draftUpdatedAt: string; versionId: string | null } | undefined;
  if (!plan) notFound();
  if (!account.systemAdmin && !account.areaIds.includes(plan.areaId)) notFound();
  const courses = sqlite.prepare("SELECT code FROM courses WHERE block_plan_id = ? ORDER BY code COLLATE NOCASE").all(plan.id) as { code: string }[];
  const phases = sqlite.prepare(`SELECT phase.semester, phase.phase_type AS type, phase.start_date AS startDate, phase.end_date AS endDate, course.code
    FROM draft_phases phase JOIN courses course ON course.id = phase.course_id WHERE phase.block_plan_id = ? ORDER BY phase.semester, phase.start_date`).all(plan.id) as { semester: number; type: string; startDate: string; endDate: string; code: string }[];
  return <SiteShell><article className="plan-detail"><p className="eyebrow">Interner Entwurf</p><h1>{plan.name ?? "Unbenannter Blockplan"}</h1>
    <p>{courses.map((course) => course.code).join(", ")}</p><p>Letzte Entwurfsänderung: {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(plan.draftUpdatedAt))}</p>
    <section aria-labelledby="draft-heading"><h2 id="draft-heading">Gespeicherter Entwurf</h2>
      {phases.length ? <table className="event-table"><thead><tr><th scope="col">Kurs</th><th scope="col">Semester</th><th scope="col">Zeitraum</th><th scope="col">Phasentyp</th></tr></thead><tbody>{phases.map((phase) => <tr key={`${phase.code}-${phase.semester}-${phase.startDate}`}><td>{phase.code}</td><td>{phase.semester}</td><td>{phase.startDate} – {phase.endDate}</td><td>{phase.type === "THEORY" ? "Theorie" : "Praxis"}</td></tr>)}</tbody></table> : <p className="empty-note">Noch keine Kursphasen gespeichert. Ein Entwurf kann erst nach vollständiger Verlaufserfassung veröffentlicht werden.</p>}
    </section>
    <section aria-labelledby="publication-heading"><h2 id="publication-heading">Veröffentlichung</h2>
      {plan.versionId ? <form action={withdrawAction}><input type="hidden" name="blockPlanId" value={plan.id} /><input type="hidden" name="publishedVersionId" value={plan.versionId} /><button className="button" type="submit">Veröffentlichung zurücknehmen</button></form> : null}
      <form action={publishAction}><input type="hidden" name="blockPlanId" value={plan.id} /><input type="hidden" name="draftUpdatedAt" value={plan.draftUpdatedAt} /><input type="hidden" name="publishedVersionId" value={plan.versionId ?? ""} /><button className="button" type="submit">Entwurf veröffentlichen</button></form>
      <p>Beim Veröffentlichen wird der gespeicherte Entwurf erneut geprüft und als eigenständige öffentliche Fassung kopiert.</p>
    </section><Link className="text-link" href="/intern">Zurück zu den Blockplänen</Link>
  </article></SiteShell>;
}
