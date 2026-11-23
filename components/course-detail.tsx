import Link from "next/link";

import { CopyLinkButton } from "@/components/copy-link-button";
import { CourseTimelineView } from "@/components/course-timeline";
import type { CourseDetail, EventRow, PhaseRow } from "@/lib/domain/course-detail";
import { publicCutPath } from "@/lib/domain/public-cut";

import styles from "./course-detail.module.css";

const pastNote = <span className="sr-only"> (vorbei)</span>;

function PhaseTableRow({ row }: { row: PhaseRow }) {
  return <tr data-timing={row.timing}>
    {row.semesterRows ? <th scope="row" rowSpan={row.semesterRows > 1 ? row.semesterRows : undefined}>{row.semester}. Semester</th> : null}
    <td>{row.period}{row.timing === "now" ? <span className={styles.badge}>jetzt</span> : row.timing === "past" ? pastNote : null}</td>
    <td><span className={styles.place}><span className={styles.swatch} data-phase={row.phase} aria-hidden="true" />{row.place}</span></td>
    <td>{row.duration}</td>
  </tr>;
}

function EventTableRow({ event }: { event: EventRow }) {
  return <tr data-timing={event.timing}>
    <td><span className={styles.dateCell}>
      {event.date}
      {event.timing === "next" ? <span className={styles.badge}>nächster Termin</span> : event.timing === "past" ? pastNote : null}
      {event.provisional ? <span className="provisional">Vorläufig</span> : null}
    </span></td>
    <td>
      <span className={styles.eventTitle}>{event.title}</span>
      <span className={styles.eventMeta}>{event.category} · {event.semester}</span>
      {event.description ? <span className={styles.eventDescription}>{event.description}</span> : null}
    </td>
  </tr>;
}

export function CourseDetailView({ detail }: { detail: CourseDetail }) {
  const marks = detail.timeline.rows.flatMap((row) => row.marks);

  return <article className={styles.page}>
    <header className={styles.head}>
      <Link className={styles.back} href="/">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
        Alle Blockpläne
      </Link>
      <p className="eyebrow">Blockplan</p>
      <h1>{detail.program}</h1>
      <p className={styles.facts}>
        <span>Kurs <strong>{detail.code}</strong></span>
        <span>Studienbeginn {detail.year}</span>
        <span>{detail.duration}</span>
        <span>{detail.area}</span>
      </p>
      {detail.parallels.length ? <div className={styles.parallels}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7h11l-3-3M17 17H6l3 3" /></svg>
        <span>{detail.parallels.length > 1 ? "Parallelkurse:" : "Parallelkurs:"}</span>
        <ul>{detail.parallels.map((parallel) => <li key={parallel.code}>
          <Link href={parallel.href}>{parallel.code}</Link>, {parallel.note}
        </li>)}</ul>
      </div> : null}
      <nav className={styles.comparisons} aria-label="Vergleich mit anderen Kursen">
        <span>Mit anderen Kursen des Jahrgangs {detail.year} vergleichen:</span>
        <ul>{detail.comparisons.map((comparison) => <li key={comparison.href}><Link href={comparison.href}>{comparison.label}</Link></li>)}</ul>
      </nav>
      <div className={styles.actions}>
        <CopyLinkButton path={publicCutPath({ kind: "course", code: detail.code })} />
      </div>
      <p className={styles.stand}><strong>Stand {detail.stand}</strong> · Fehler und Änderungen vorbehalten</p>
    </header>

    <section aria-labelledby="standing-heading">
      <h2 id="standing-heading">Wo stehen die Studierenden gerade?</h2>
      <div className={styles.cards}>{detail.standing.map((card, index) => <div key={card.label} className={styles.card}
        data-current={index === 0 ? "" : undefined} data-phase={card.phase ?? undefined}>
        <p className={styles.cardLabel}>{card.label}</p>
        <p className={styles.cardMain}>{card.main}</p>
        {card.detail ? <p className={styles.cardDetail}>{card.detail}</p> : null}
      </div>)}</div>
    </section>

    <section aria-labelledby="timeline-heading">
      <h2 id="timeline-heading">Zeitleiste</h2>
      <ul className={styles.legend} aria-hidden="true">
        <li><span className={styles.swatch} data-phase="practice" />Im Unternehmen</li>
        <li><span className={styles.swatch} data-phase="theory" />An der DHBW</li>
        <li><span className={styles.semesterSwatch} />Semesterbeginn</li>
        <li><span className={styles.todayBadge}>heute</span></li>
        {marks.some((mark) => !mark.span) ? <li><span className={styles.mark} />Termin</li> : null}
        {marks.some((mark) => mark.span) ? <li><span className={styles.mark} data-span="" />mehrtägiger Termin</li> : null}
        {marks.some((mark) => mark.provisional) ? <li><span className={styles.mark} data-provisional="" />vorläufig</li> : null}
      </ul>
      <CourseTimelineView timeline={detail.timeline} />
      <p className={styles.note}>Alle Angaben der Zeitleiste stehen auch in den Tabellen darunter.</p>
    </section>

    <section aria-labelledby="phases-heading">
      <h2 id="phases-heading">Alle Phasen</h2>
      <div className={styles.tableWrap} role="region" aria-label="Alle Phasen, seitlich scrollbar" tabIndex={0}>
        <table className={styles.table} aria-labelledby="phases-heading">
          <thead><tr><th scope="col">Semester</th><th scope="col">Zeitraum</th><th scope="col">Ort</th><th scope="col">Dauer</th></tr></thead>
          {detail.phaseYears.map((year) => <tbody key={year.label}>
            <tr className={styles.yearRow}><th scope="rowgroup" colSpan={4}>{year.label}</th></tr>
            {year.rows.map((row) => <PhaseTableRow key={row.key} row={row} />)}
          </tbody>)}
        </table>
      </div>
    </section>

    <section aria-labelledby="events-heading">
      <h2 id="events-heading">Prüfungsrelevante Termine</h2>
      {detail.events.length
        ? <div className={styles.tableWrap} role="region" aria-label="Prüfungsrelevante Termine, seitlich scrollbar" tabIndex={0}>
          <table className={`${styles.table} ${styles.eventsTable}`} aria-labelledby="events-heading">
            <thead><tr><th scope="col">Datum</th><th scope="col">Termin</th></tr></thead>
            <tbody>{detail.events.map((event) => <EventTableRow key={event.id} event={event} />)}</tbody>
          </table>
        </div>
        : <p className={styles.empty}>Dieser Blockplan enthält keine Prüfungstermine.</p>}
    </section>
  </article>;
}
