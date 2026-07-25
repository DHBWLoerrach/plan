import Link from "next/link";
import type { ReactNode } from "react";

import { type PublicationIssue, publicationIssueFieldLabel } from "@/lib/domain/publication";

type IssueSubject = { courses: { id: string; code: string }[]; events: { id: string; title: string }[] };

/** The course and event an issue belongs to, so the overview names them apart from the sentence of the rule. */
function subjectOf(issue: PublicationIssue, { courses, events }: IssueSubject): string[] {
  const subjects: string[] = [];
  if (issue.eventId) subjects.push(`Termin „${events.find((event) => event.id === issue.eventId)?.title ?? issue.eventId}“`);
  if (issue.courseId) subjects.push(`Kurs ${courses.find((course) => course.id === issue.courseId)?.code ?? issue.courseId}`);
  return subjects;
}

function IssueList({ issues, subjects, children }: { issues: PublicationIssue[]; subjects: IssueSubject; children?: (issue: PublicationIssue) => ReactNode }) {
  return <ul className="issue-list">{issues.map((issue, index) => {
    const facts = [...subjectOf(issue, subjects), ...(issue.field ? [`Feld: ${publicationIssueFieldLabel(issue.field)}`] : [])];
    // Several courses can violate the same rule in the same semester, so neither code nor subject is unique here.
    return <li key={`${issue.code}-${issue.courseId ?? issue.eventId ?? ""}-${index}`}>
      <p>{issue.message}</p>
      {facts.length ? <p className="entry-meta">{facts.join(" · ")}</p> : null}
      {children?.(issue)}
    </li>;
  })}</ul>;
}

/**
 * Every rule a saved draft still violates, grouped the way it is corrected: by semester of the course phase editor,
 * by event and by the block plan itself. Each group links to the place that fixes it, and each entry names the
 * affected course or event and the field it belongs to (MVP-SPEZIFIKATION.md).
 */
export function PublicationIssueOverview({ blockPlanId, issues, courses, events, semesters }: {
  blockPlanId: string;
  issues: PublicationIssue[];
  courses: { id: string; code: string }[];
  events: { id: string; title: string }[];
  /** The semesters of the block plan; only those have an editor the overview can link to. */
  semesters: number;
}) {
  const subjects: IssueSubject = { courses, events };
  // One pass into the three places an issue is corrected: the plan itself, a semester of the course phase editor,
  // or the event section — an event carries no semester of its own (FACHLICHE_REGELN.md).
  const planIssues: PublicationIssue[] = [];
  const eventIssues: PublicationIssue[] = [];
  const bySemester = new Map<number, PublicationIssue[]>();
  for (const issue of issues) {
    if (issue.eventId) eventIssues.push(issue);
    else if (issue.semester === null) planIssues.push(issue);
    else {
      const group = bySemester.get(issue.semester) ?? [];
      group.push(issue);
      bySemester.set(issue.semester, group);
    }
  }
  const semesterNumbers = [...bySemester.keys()].toSorted((left, right) => left - right);

  return <section aria-labelledby="issues-heading">
    <h2 id="issues-heading">Fehlerübersicht</h2>
    <p>
      Der gespeicherte Entwurf verletzt {issues.length === 1 ? "eine Regel" : `${issues.length} Regeln`}. Die Vorschau der
      öffentlichen Fassung erscheint hier, sobald alle Struktur- und Veröffentlichungsregeln erfüllt sind.
    </p>

    {planIssues.length ? <div className="issue-group">
      <h3>Blockplan</h3>
      <IssueList issues={planIssues} subjects={subjects} />
      <Link className="text-link" href={`/intern/blockplaene/${blockPlanId}`}>Zu den Planeinstellungen</Link>
    </div> : null}

    {semesterNumbers.map((semester) => <div className="issue-group" key={semester}>
      <h3>Semester {semester}</h3>
      <IssueList issues={bySemester.get(semester) ?? []} subjects={subjects} />
      {semester >= 1 && semester <= semesters
        ? <Link className="text-link" href={`/intern/blockplaene/${blockPlanId}?semester=${semester}`}>Semester {semester} bearbeiten</Link>
        : <p className="entry-meta">Dieses Semester liegt außerhalb der Studiendauer und hat keinen eigenen Editor.</p>}
    </div>)}

    {eventIssues.length ? <div className="issue-group">
      <h3>Prüfungsrelevante Termine</h3>
      <IssueList issues={eventIssues} subjects={subjects}>
        {(issue) => <Link className="text-link" href={`/intern/blockplaene/${blockPlanId}#termin-${issue.eventId}`}>Zum Termin</Link>}
      </IssueList>
    </div> : null}
  </section>;
}
