// The public page of one course: where its students are today, its course progression drawn per study year and listed
// per semester, and its examination-relevant dates. Everything is reckoned from the Berlin calendar day the request is
// served on, so the page needs no clock of its own in the browser.
import { berlinCalendarDay, inclusiveDays, plusDays, plusMonths } from "@/lib/domain/calendar-day";
import { formatApproximateWeeks, formatCalendarDay, formatCalendarPeriod, formatPeriodDuration } from "@/lib/domain/calendar-format";
import { comparableEventKey, describeDeviations, type CourseDeviation } from "@/lib/domain/plan-comparison";
import { eventCategoryLabel } from "@/lib/domain/event-category";
import { phasePlaceLabel, type PhaseType } from "@/lib/domain/phase-type";
import { publicCutPath } from "@/lib/domain/public-cut";
import { deriveEventSemester, type CourseEvent, type CoursePhase, type CoursePlan } from "@/lib/domain/publication";

export type DetailCourse = CoursePlan & { program: string; programAbbreviation: string; area: string; year: number };
export type DetailPhase = "theory" | "practice";
export type Timing = "past" | "now" | "future";

export interface DetailParallel { code: string; href: string; note: string }

export interface StandingCard { label: string; main: string; detail: string | null; phase: DetailPhase | null }

export interface TimelineSegment { key: string; phase: DetailPhase; left: number; width: number; label: string | null; title: string }
// One piece of a date in one row. Only the first piece of a date carries its toggle; `level` is its lane from the top.
export interface TimelineMark {
  key: string;
  id: string;
  target: boolean;
  span: boolean;
  provisional: boolean;
  left: number;
  width: number;
  level: number;
  text: string;
}
export interface TimelineRow {
  label: string;
  detail: string;
  segments: TimelineSegment[];
  semesterStarts: Array<{ semester: number; left: number }>;
  marks: TimelineMark[];
  levels: number;
  today: number | null;
}
export interface CourseTimeline { months: Array<{ label: string; left: number }>; rows: TimelineRow[] }

export interface PhaseRow {
  key: string;
  semester: number;
  // How many rows the semester cell spans, on the first row of its semester; 0 on the rows it covers.
  semesterRows: number;
  period: string;
  place: string;
  phase: DetailPhase;
  duration: string;
  timing: Timing;
}
export interface PhaseYear { label: string; rows: PhaseRow[] }

export interface EventRow {
  id: string;
  date: string;
  title: string;
  // What the date is and the semester its start day falls into, as the planning names them.
  category: string;
  semester: string;
  description: string | null;
  provisional: boolean;
  timing: "past" | "next" | "future";
}

export interface CourseDetail {
  code: string;
  program: string;
  area: string;
  year: number;
  duration: string;
  stand: string;
  parallels: DetailParallel[];
  // The course beside its parallel courses in the plan matrix of its program, when it has any. Partners compare the
  // courses their students may be in; the year and the area are views of the university and too wide for them.
  comparison: { label: string; href: string } | null;
  standing: [StandingCard, StandingCard, StandingCard];
  timeline: CourseTimeline;
  phaseYears: PhaseYear[];
  events: EventRow[];
}

const shortMonths = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
/* A row starts two weeks before its study year, so that a semester mark on the very first day still has room. */
const rowLeadDays = 14;
/* The width of a date's target on the narrowest track, in percent of the track: 1.75rem of about 38rem. */
const markTargetShare = 5;

const phaseOf = (type: PhaseType): DetailPhase => (type === "THEORY" ? "theory" : "practice");
const weekdayDay = (day: string) => formatCalendarDay(day, { weekday: true });
const daysBetween = (from: string, to: string) => inclusiveDays(from, to) - 1;
const studyYearOf = (semester: number) => Math.ceil(semester / 2) - 1;
const round = (value: number) => Math.round(value * 1000) / 1000;

function relativeDays(days: number): string {
  if (days <= 0) return "heute";
  if (days === 1) return "morgen";
  if (days < 14) return `in ${days} Tagen`;
  if (days < 60) return `in ${Math.round(days / 7)} Wochen`;
  return `in ${Math.round(days / 30.44)} Monaten`;
}

function eventSemester(phases: CoursePhase[], courseId: string, startDate: string): string {
  const semester = deriveEventSemester(phases, courseId, startDate);
  return semester === null ? "Semester nicht ableitbar" : `${semester}. Semester`;
}

// The category tells apart dates of one title on one day, like the registration and the submission of a project.
function markText(event: CourseEvent): string {
  const notes = [eventCategoryLabel(event.category), ...(event.provisional ? ["vorläufig"] : [])];
  return `${eventDate(event)}: ${event.title} (${notes.join(", ")})`;
}

function eventDate(event: Pick<CourseEvent, "startDate" | "endDate">): string {
  return formatCalendarPeriod(event.startDate, event.endDate ?? event.startDate, { weekday: true });
}

// A list in words, like „1., 2. und 5.“ or „WIN24A und WIN24B“.
const listInWords = new Intl.ListFormat("de-DE", { type: "conjunction" });

const codeOrder = new Intl.Collator("de-DE", { sensitivity: "base" });

// The dates of a course with their descriptions, which the comparison of dates leaves out, in a comparable order.
function describedEvents(events: CourseEvent[], courseId: string): string {
  return JSON.stringify(events.filter((event) => event.courseId === courseId)
    .map((event) => [comparableEventKey(event), event.description ?? ""]).toSorted());
}

function parallelNote(deviation: CourseDeviation, comparedSemesters: number, otherDescriptions: boolean): string {
  const otherEvents = deviation.eventsOnlyHere + deviation.eventsOnlyThere > 0;
  const dates = otherEvents ? "andere Termine" : otherDescriptions ? "andere Terminbeschreibungen" : null;
  if (!deviation.semesters.length) {
    if (otherEvents) return "gleicher Kursverlauf, andere Termine";
    return dates ? "gleicher Kursverlauf und gleiche Termine, andere Terminbeschreibungen" : "gleicher Plan";
  }
  const semesters = deviation.semesters.map((entry) => entry.semester);
  const where = semesters.length >= comparedSemesters ? "durchgehend abweichend" : `im ${listInWords.format(semesters.map((semester) => `${semester}.`))} Semester abweichend`;
  return `Kursverlauf ${where}${dates ? `, ${dates}` : ""}`;
}

// Phases of one type that follow each other without a day between are one stay in one place.
function stays(phases: CoursePhase[]): Array<{ type: PhaseType; startDate: string; endDate: string }> {
  const result: Array<{ type: PhaseType; startDate: string; endDate: string }> = [];
  for (const phase of phases) {
    const last = result.at(-1);
    if (last && last.type === phase.type && phase.startDate === plusDays(last.endDate, 1)) last.endDate = phase.endDate;
    else result.push({ type: phase.type, startDate: phase.startDate, endDate: phase.endDate });
  }
  return result;
}

function buildStanding(course: CoursePlan, phases: CoursePhase[], events: CourseEvent[], today: string): CourseDetail["standing"] {
  // The page marks this card „jetzt“ as it marks the current phase and today, so its label is the day alone.
  const label = weekdayDay(today);
  const runs = stays(phases);
  let now: StandingCard;
  if (today < course.studyStart) now = { label, main: "Noch nicht begonnen", detail: `Studienbeginn ${weekdayDay(course.studyStart)}`, phase: null };
  else if (today > course.studyEnd) now = { label, main: "Studium beendet", detail: `Studienende ${weekdayDay(course.studyEnd)}`, phase: null };
  else {
    const stay = runs.find((run) => run.startDate <= today && today <= run.endDate);
    const phase = phases.find((candidate) => candidate.startDate <= today && today <= candidate.endDate);
    now = stay && phase
      ? { label, main: phasePlaceLabel(stay.type), detail: `seit ${weekdayDay(stay.startDate)} · ${phase.semester}. Semester`, phase: phaseOf(stay.type) }
      : { label, main: "Zurzeit keine Kursphase", detail: null, phase: null };
  }

  const nextStay = runs.find((run) => run.startDate > today);
  const next: StandingCard = nextStay
    ? { label: "Als Nächstes", main: phasePlaceLabel(nextStay.type), detail: `ab ${weekdayDay(nextStay.startDate)} · ${relativeDays(daysBetween(today, nextStay.startDate))}`, phase: phaseOf(nextStay.type) }
    : { label: "Als Nächstes", main: "Keine weitere Phase", detail: today <= course.studyEnd ? `Studienende ${weekdayDay(course.studyEnd)}` : null, phase: null };

  const nextEvent = events.find((event) => (event.endDate ?? event.startDate) >= today);
  let third: StandingCard;
  if (nextEvent) {
    const when = nextEvent.startDate > today ? relativeDays(daysBetween(today, nextEvent.startDate)) : nextEvent.endDate && nextEvent.endDate > today ? "läuft" : "heute";
    third = { label: "Nächster Termin", main: nextEvent.title, detail: `${eventDate(nextEvent)}${nextEvent.provisional ? " (vorläufig)" : ""} · ${when}`, phase: null };
  } else {
    const parts = [today <= course.studyEnd ? relativeDays(daysBetween(today, course.studyEnd)) : "vorbei"];
    if (!events.length) parts.push("keine Prüfungstermine im Plan");
    third = { label: "Studienende", main: weekdayDay(course.studyEnd), detail: parts.join(" · "), phase: null };
  }
  return [now, next, third];
}

interface MarkPiece { event: CourseEvent; from: string; to: string; first: boolean }

// A multi-day date is cut where its days change rows, so that each row draws the part that falls into it.
function markPieces(event: CourseEvent, rowOfDay: (day: string) => number): Array<MarkPiece & { row: number }> {
  const pieces: Array<MarkPiece & { row: number }> = [];
  const last = event.endDate ?? event.startDate;
  for (let day = event.startDate; day <= last; day = plusDays(day, 1)) {
    const row = rowOfDay(day);
    const piece = pieces.at(-1);
    if (piece && piece.row === row) piece.to = day;
    else pieces.push({ event, row, from: day, to: day, first: !pieces.length });
  }
  return pieces;
}

// Marks whose targets would overlap move to a lane of their own below, so that each of them stays reachable.
function assignLevels(intervals: Array<{ start: number; end: number }>): { levels: number[]; count: number } {
  const ends: number[] = [];
  const order = intervals.map((_, index) => index).toSorted((left, right) => intervals[left].start - intervals[right].start);
  const levels: number[] = new Array(intervals.length);
  for (const index of order) {
    let level = ends.findIndex((end) => end <= intervals[index].start);
    if (level < 0) level = ends.length;
    ends[level] = intervals[index].end;
    levels[index] = level;
  }
  return { levels, count: Math.max(ends.length, 1) };
}

function buildTimeline(course: CoursePlan, phases: CoursePhase[], events: CourseEvent[], today: string, years: number): CourseTimeline {
  const yearStart = (row: number) => plusMonths(course.studyStart, 12 * row);
  const rowOfDay = (day: string) => {
    const phase = phases.find((candidate) => candidate.startDate <= day && day <= candidate.endDate);
    if (phase) return studyYearOf(phase.semester);
    let row = 0;
    while (row < years - 1 && day >= yearStart(row + 1)) row += 1;
    return row;
  };
  const pieces = events.flatMap((event) => markPieces(event, rowOfDay));

  // Every row spans the same stretch around its study year, wide enough for whatever any row holds, so that the months
  // stand above one another and no phase is cut off at the end of the calendar year of study.
  let lead = rowLeadDays;
  let trail = 0;
  for (let row = 0; row < years; row += 1) {
    const days = [
      ...phases.filter((phase) => studyYearOf(phase.semester) === row).flatMap((phase) => [phase.startDate, phase.endDate]),
      ...pieces.filter((piece) => piece.row === row).flatMap((piece) => [piece.from, piece.to]),
    ].toSorted();
    if (!days.length) continue;
    lead = Math.max(lead, daysBetween(days[0], yearStart(row)) + rowLeadDays);
    trail = Math.max(trail, daysBetween(yearStart(row + 1), plusDays(days.at(-1)!, 1)));
  }
  const rowStart = (row: number) => plusDays(yearStart(row), -lead);
  const rowEnd = (row: number) => plusDays(yearStart(row + 1), trail);
  const position = (day: string, row: number) => {
    const share = daysBetween(rowStart(row), day) / daysBetween(rowStart(row), rowEnd(row));
    return round(Math.min(Math.max(share, 0), 1) * 100);
  };

  const months: CourseTimeline["months"] = [];
  for (let day = plusMonths(rowStart(0).slice(0, 8) + "01", 1); day < rowEnd(0); day = plusMonths(day, 1)) {
    months.push({ label: shortMonths[Number(day.slice(5, 7)) - 1], left: position(day, 0) });
  }

  const rows = Array.from({ length: years }, (_, row): TimelineRow => {
    const rowPhases = phases.filter((phase) => studyYearOf(phase.semester) === row);
    const semesters = [...new Set(rowPhases.map((phase) => phase.semester))];
    const first = Number(yearStart(row).slice(0, 4));
    const span = semesters.length > 1 ? `Semester ${semesters[0]}–${semesters.at(-1)}` : semesters.length ? `Semester ${semesters[0]}` : "Keine Kursphase";
    const rowPieces = pieces.filter((piece) => piece.row === row).map((piece) => {
      const left = position(piece.from, row);
      return { ...piece, left, width: round(position(plusDays(piece.to, 1), row) - left) };
    });
    const { levels, count } = assignLevels(rowPieces.map((piece) => {
      // The target as the stylesheet places it: centred on the mark, but pushed back inside the track at either edge.
      const width = Math.min(Math.max(piece.width, markTargetShare), 100);
      const start = Math.min(Math.max(piece.left + piece.width / 2 - width / 2, 0), 100 - width);
      return { start, end: start + width };
    }));
    return {
      label: `${row + 1}. Studienjahr`,
      detail: `${span} · ${first}/${String(first + 1).slice(2)}`,
      segments: rowPhases.map((phase) => {
        const left = position(phase.startDate, row);
        const width = round(position(plusDays(phase.endDate, 1), row) - left);
        const label = formatApproximateWeeks(phase.startDate, phase.endDate);
        return {
          key: `${phase.semester}-${phase.startDate}`,
          phase: phaseOf(phase.type),
          left,
          width,
          // About one percent of the narrowest track per character, and some room for the padding.
          label: width >= label.length * 1.1 + 1.5 ? label : null,
          title: `${formatCalendarPeriod(phase.startDate, phase.endDate)} · ${phasePlaceLabel(phase.type)} · ${formatPeriodDuration(phase.startDate, phase.endDate)}`,
        };
      }),
      semesterStarts: semesters.map((semester) => ({ semester, left: position(rowPhases.find((phase) => phase.semester === semester)!.startDate, row) })),
      levels: count,
      marks: rowPieces.map((piece, index) => ({
        key: `${piece.event.id}-${piece.from}`,
        id: piece.event.id,
        target: piece.first,
        span: Boolean(piece.event.endDate && piece.event.endDate !== piece.event.startDate),
        provisional: piece.event.provisional,
        left: piece.left,
        width: piece.width,
        level: levels[index],
        text: markText(piece.event),
      })),
      today: today >= course.studyStart && today <= course.studyEnd && rowOfDay(today) === row
        ? round((position(today, row) + position(plusDays(today, 1), row)) / 2)
        : null,
    };
  });
  return { months, rows };
}

function timingOf(startDate: string, endDate: string, today: string): Timing {
  if (endDate < today) return "past";
  return startDate <= today ? "now" : "future";
}

function buildPhaseYears(course: CoursePlan, phases: CoursePhase[], today: string, years: number): PhaseYear[] {
  return Array.from({ length: years }, (_, row) => {
    const first = Number(plusMonths(course.studyStart, 12 * row).slice(0, 4));
    const rowPhases = phases.filter((phase) => studyYearOf(phase.semester) === row);
    return {
      label: `${row + 1}. Studienjahr · ${first}/${String(first + 1).slice(2)}`,
      rows: rowPhases.map((phase, index) => ({
        key: `${phase.semester}-${phase.startDate}`,
        semester: phase.semester,
        semesterRows: rowPhases[index - 1]?.semester === phase.semester ? 0 : rowPhases.filter((other) => other.semester === phase.semester).length,
        period: formatCalendarPeriod(phase.startDate, phase.endDate),
        place: phasePlaceLabel(phase.type),
        phase: phaseOf(phase.type),
        duration: formatPeriodDuration(phase.startDate, phase.endDate),
        timing: timingOf(phase.startDate, phase.endDate, today),
      })),
    };
  }).filter((year) => year.rows.length);
}

// `phases` and `events` may hold those of the parallel courses too: they are what the page compares the course with.
// `updatedAt` is the instant of the last change, of which the page names the Berlin calendar day.
export function buildCourseDetail({ course, parallels, phases, events, updatedAt, today }: {
  course: DetailCourse;
  parallels: CoursePlan[];
  phases: CoursePhase[];
  events: CourseEvent[];
  updatedAt: string;
  today: string;
}): CourseDetail {
  const ownPhases = phases.filter((phase) => phase.courseId === course.id).toSorted((left, right) => left.startDate.localeCompare(right.startDate));
  const ownEvents = events.filter((event) => event.courseId === course.id)
    .toSorted((left, right) => left.startDate.localeCompare(right.startDate) || left.title.localeCompare(right.title, "de-DE"));
  const years = Math.max(Math.ceil(course.semesters / 2), ...ownPhases.map((phase) => studyYearOf(phase.semester) + 1));
  const nextEvent = ownEvents.find((event) => (event.endDate ?? event.startDate) >= today);

  return {
    code: course.code,
    program: course.program,
    area: course.area,
    year: course.year,
    duration: `${course.semesters} Semester, bis ${formatCalendarDay(course.studyEnd)}`,
    stand: formatCalendarDay(berlinCalendarDay(new Date(updatedAt))),
    parallels: describeDeviations(course, parallels, phases, events).map((deviation) => {
      const other = parallels.find((candidate) => candidate.id === deviation.courseId)!;
      return {
        code: deviation.code,
        href: publicCutPath({ kind: "course", code: deviation.code }),
        note: parallelNote(deviation, Math.max(course.semesters, other.semesters),
          describedEvents(events, course.id) !== describedEvents(events, other.id)),
      };
    }),
    comparison: parallels.length ? {
      label: `${listInWords.format([course, ...parallels].map((entry) => entry.code).toSorted(codeOrder.compare))} vergleichen`,
      href: publicCutPath({ kind: "program", year: course.year, abbreviation: course.programAbbreviation }),
    } : null,
    standing: buildStanding(course, ownPhases, ownEvents, today),
    timeline: buildTimeline(course, ownPhases, ownEvents, today, years),
    phaseYears: buildPhaseYears(course, ownPhases, today, years),
    events: ownEvents.map((event) => ({
      id: event.id,
      date: eventDate(event),
      title: event.title,
      category: eventCategoryLabel(event.category),
      semester: eventSemester(ownPhases, course.id, event.startDate),
      description: event.description,
      provisional: event.provisional,
      timing: event === nextEvent ? "next" : (event.endDate ?? event.startDate) < today ? "past" : "future",
    })),
  };
}
