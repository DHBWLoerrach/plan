import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { CreateBlockPlanForm } from "@/components/block-plan-forms";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { formatTimestamp } from "@/lib/domain/calendar-format";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";

import { courseListData } from "../kurse/data";
import { searchParam } from "../search-params";
import {
  blockPlanListData,
  blockPlanSortLabels,
  blockPlanStateLabels,
  isBlockPlanSort,
  isBlockPlanState,
} from "./data";

export default async function BlockPlansPage({ searchParams }: PageProps<"/intern/blockplaene">) {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  if (!managesAnyArea(account)) redirect("/intern");
  const raw = await searchParams;
  const area = searchParam(raw, "area");
  const year = searchParam(raw, "year");
  const course = searchParam(raw, "course");
  const stateFilter = searchParam(raw, "state");
  const state = isBlockPlanState(stateFilter) ? stateFilter : null;
  const requestedSort = searchParam(raw, "sort");
  const sort = isBlockPlanSort(requestedSort) ? requestedSort : "draft";
  const deleted = searchParam(raw, "blockplan-geloescht") === "1";

  const { areas, years, plans } = blockPlanListData(sqlite, account, { area, year, course, state }, sort);
  // Creation and the first course assignment are one operation, so the list offers exactly the block-plan-less
  // courses of the manageable areas as a starting point (FACHLICHE_REGELN.md).
  const availableCourses = courseListData(sqlite, account, { area: null, program: null, year: null, assignment: "unassigned" }, "code").courses;

  return <SiteShell nav={<InternalNav account={account} current="blockplaene" />}><section className="search-panel" aria-labelledby="block-plans-heading">
    <p className="eyebrow">Interner Bereich</p>
    <h1 id="block-plans-heading">Blockpläne</h1>
    {deleted ? <p role="status">Der Blockplan wurde gelöscht. Seine Kurse bestehen blockplanlos weiter.</p> : null}

    <form className="filter-grid" role="search" aria-label="Blockpläne filtern">
      <label>Bereich<select name="area" defaultValue={area ?? ""}><option value="">Alle Bereiche</option>{areas.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
      <label>Jahrgang<select name="year" defaultValue={year ?? ""}><option value="">Alle Jahrgänge</option>{years.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      <label>Kurskennung<input name="course" type="search" defaultValue={course ?? ""} autoComplete="off" placeholder="z. B. TIF24" /></label>
      <label>Veröffentlichungszustand<select name="state" defaultValue={state ?? ""}><option value="">Alle Zustände</option>{Object.entries(blockPlanStateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Sortierung<select name="sort" defaultValue={sort}>{Object.entries(blockPlanSortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="filter-actions"><button className="button" type="submit">Filtern</button><Link href="/intern/blockplaene">Filter zurücksetzen</Link></div>
    </form>

    {plans.length ? <div className="matrix-wrap" tabIndex={0}><table className="event-table">
      <thead><tr><th scope="col">Blockplan</th><th scope="col">Bereich</th><th scope="col">Jahrgang</th><th scope="col">Kurse</th><th scope="col">Veröffentlichungszustand</th><th scope="col">Letzte Entwurfsänderung</th></tr></thead>
      <tbody>{plans.map((plan) => <tr key={plan.id}>
        <th scope="row"><Link className="text-link" href={`/intern/blockplaene/${plan.id}`}>{plan.displayName}</Link></th>
        <td>{plan.areaName}</td>
        <td>{plan.year ?? "—"}</td>
        <td>{plan.courseCodes.join(", ") || "—"}</td>
        <td>{blockPlanStateLabels[plan.state]}</td>
        <td>{formatTimestamp(plan.draftUpdatedAt)}{plan.draftUpdatedBy ? ` durch ${plan.draftUpdatedBy}` : ""}</td>
      </tr>)}</tbody>
    </table></div> : <p className="empty-note">Für diese Filter gibt es keine Blockpläne.</p>}

    <h2>Blockplan anlegen</h2>
    {availableCourses.length
      ? <CreateBlockPlanForm courses={availableCourses} />
      : <p className="empty-note">Alle Kurse Ihrer Bereiche sind bereits einem Blockplan zugeordnet. Ein Blockplan entsteht immer aus einem blockplanlosen Kurs — <Link className="text-link" href="/intern/kurse/neu">legen Sie zuerst einen Kurs an</Link>.</p>}
  </section></SiteShell>;
}
