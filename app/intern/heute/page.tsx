import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { CalendarLocation } from "@/components/calendar-location";
import { InternalNav } from "@/components/internal-nav";
import { SiteShell } from "@/components/site-shell";
import { sqlite } from "@/lib/db";
import { berlinCalendarDay } from "@/lib/domain/calendar-day";
import { formatLongCalendarDay } from "@/lib/domain/calendar-format";
import { calendarDescriptionParts, calendarEventTimeOnDay, eventsOnCalendarDay, type CalendarEvent } from "@/lib/domain/course-calendar";
import { getActiveAccount, managesAnyArea } from "@/lib/internal-auth";
import { readCourseCalendar } from "@/lib/services/course-calendar-feed";

import { studyingPrograms } from "../kurse/data";

export const metadata: Metadata = { title: "Heute" };

/**
 * The machine-readable moment an entry begins. The stored value is Berlin wall time carried in UTC fields, so its
 * zone marker would be a lie: the local date and time are written without one, an all-day entry as the day alone.
 */
function eventDateTime(event: CalendarEvent, day: string): string {
  return event.allDay ? day : event.start.slice(0, 16);
}

function EventLocation({ value }: { value: string }) {
  if (!value) return null;
  return <p className="today-event__detail"><CalendarLocation value={value} linkClassName="text-link" /></p>;
}

/**
 * A description that may run to a whole pasted meeting invitation. Closed, its first line stands for it, cut to one
 * line; opened, that line is shown whole and the rest follows below it, so nothing is shown twice. The control is the
 * browser's own disclosure: operable without a pointer and without JavaScript, and it reports its state itself.
 */
function EventDescription({ value }: { value: string }) {
  const { firstLine, rest, collapsible } = calendarDescriptionParts(value);
  if (!collapsible) return <p className="today-event__detail">{firstLine}</p>;
  return <details className="today-description">
    <summary><span className="today-description__first">{firstLine}</span></summary>
    {rest ? <p className="today-description__rest">{rest}</p> : null}
  </details>;
}

/**
 * The calendar entries of one course on one day, read from the external lecture calendar (ADR 0015). Each course
 * streams in on its own, so one slow or unreachable feed holds up its own row and not the page.
 */
async function CourseDay({ courseCode, day }: { courseCode: string; day: string }) {
  const result = await readCourseCalendar(courseCode);
  if (result.kind === "not-found") return <p className="today-course__note">Kein Vorlesungskalender gefunden.</p>;
  if (result.kind === "unavailable") return <p className="today-course__note">Vorlesungskalender zurzeit nicht erreichbar.</p>;
  const events = eventsOnCalendarDay(result.events, day);
  if (!events.length) return <p className="today-course__note">Heute keine Kalendertermine.</p>;
  return <ol className="today-events">{events.map((event, index) => <li className="today-event" key={`${event.uid}-${event.start}-${index}`}>
    <time className="today-event__time" dateTime={eventDateTime(event, day)}>{calendarEventTimeOnDay(event)}</time>
    <div>
      <p className="today-event__title">{event.title}</p>
      <EventLocation value={event.location} />
      {event.description ? <EventDescription value={event.description} /> : null}
    </div>
  </li>)}</ol>;
}

/**
 * The entry page after signing in: what every course of the own areas has in its lecture calendar today. It reads
 * only the courses studying today — before its study start or after its study end a course has no lectures — and
 * stays inside the own areas like the overview, since it is the way into one's own day rather than a system wide view.
 */
export default async function TodayPage() {
  await connection();
  const account = await getActiveAccount();
  if (!account) redirect("/intern/anmelden");
  // Without an area there are no own courses, and the overview is where that is explained.
  if (!managesAnyArea(account)) redirect("/intern");
  const today = berlinCalendarDay();
  const programs = studyingPrograms(sqlite, account, today);
  /* As on the overview: the area is named only once more than one is shown, since only then can a study program name
     occur twice. */
  const namesAreas = new Set(programs.map((program) => program.areaName)).size > 1;

  return <SiteShell nav={<InternalNav account={account} current="heute" />}><section className="today" aria-labelledby="today-heading">
    <header className="course-overview__header">
      <div className="course-overview__title"><h1 id="today-heading">Heute</h1><span className="course-overview__separator" aria-hidden="true">·</span>
        <p className="course-overview__count"><time dateTime={today}>{formatLongCalendarDay(today)}</time></p></div>
    </header>
    {programs.length
      ? programs.map((program) => <section className="program-group" key={program.id}>
        <h2 className="program-group__name">
          <span className="program-group__abbreviation">{program.abbreviation}</span> {program.name}
          {/* An area bearing the name of its study program would only repeat it, as in the course list. */}
          {namesAreas && program.areaName !== program.name ? <span className="program-group__area"> {program.areaName}</span> : null}
        </h2>
        <ul className="today-courses">{program.years.flatMap((year) => year.courses).map((course) => <li className="today-course" key={course.id}>
          <div>
            {/* The course leads to its week in the lecture calendar, the view this page is a one-day excerpt of. */}
            <h3 className="today-course__code"><Link href={`/intern/kurse/${course.id}?kalender=woche`}>{course.code}</Link></h3>
            <p className="today-course__standing">{course.currentPhase}</p>
          </div>
          <Suspense fallback={<p className="today-course__note">Kalendertermine werden geladen…</p>}>
            <CourseDay courseCode={course.code} day={today} />
          </Suspense>
        </li>)}</ul>
      </section>)
      : <p className="empty-note">In Ihren Bereichen studiert heute kein Kurs.</p>}
  </section></SiteShell>;
}
