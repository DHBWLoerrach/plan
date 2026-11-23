import { inclusiveDays, plusDays, weekdayIndex } from "@/lib/domain/calendar-day";
import { formatCalendarDay, formatCalendarPeriod, formatPeriodDuration } from "@/lib/domain/calendar-format";
import { phaseTypeLabel } from "@/lib/domain/phase-type";
import { deriveEventSemester, validatePublication, type CoursePlan, type PlanEvent, type PlanPhase } from "@/lib/domain/publication";

/** The planning state of the one course the board edits: what moves while someone drags, and what undo restores. */
export interface BoardPlan {
  phases: PlanPhase[];
  events: PlanEvent[];
}

/** The time axis of the board: day 0 is `origin`, and `days` days run from there to the last study end. */
export interface BoardAxis {
  origin: string;
  days: number;
}

/** The day a course changes from one phase into the adjoining next one — the first day of the later phase. */
export interface PhaseJunction {
  earlierId: string;
  laterId: string;
  day: string;
}

export interface BoardChange {
  key: string;
  text: string;
  consequences: string[];
}

/** The shortest a phase may become on the board: one day, as when a change is saved (`moveCoursePhaseChange`). */
export const minimumPhaseDays = 1;

/** The axis covers every study period and every loaded phase and date, since an unpublished course may hold dates outside its study period. */
export function boardAxis(courses: Pick<CoursePlan, "studyStart" | "studyEnd">[], periods: { startDate: string; endDate: string | null }[] = []): BoardAxis {
  const origin = [...courses.map((course) => course.studyStart), ...periods.map((period) => period.startDate)].toSorted()[0];
  const end = [...courses.map((course) => course.studyEnd), ...periods.map((period) => period.endDate ?? period.startDate)].toSorted().at(-1)!;
  return { origin, days: inclusiveDays(origin, end) };
}

export function dayIndex(axis: BoardAxis, day: string): number {
  return inclusiveDays(axis.origin, day) - 1;
}

export function dayAt(axis: BoardAxis, index: number): string {
  return plusDays(axis.origin, index);
}

/** Where a day begins on the axis, in percent of its length. */
export function axisPercent(axis: BoardAxis, index: number): number {
  return index / axis.days * 100;
}

/** The left edge and the width of an inclusive period, in percent of the axis. */
export function periodPlacement(axis: BoardAxis, startDate: string, endDate: string): { left: number; width: number } {
  const start = dayIndex(axis, startDate);
  return { left: axisPercent(axis, start), width: axisPercent(axis, dayIndex(axis, endDate) + 1 - start) };
}

/** The calendar years the axis touches, each with its share of the axis. */
export function axisYears(axis: BoardAxis): { year: number; left: number; width: number }[] {
  const last = dayAt(axis, axis.days - 1);
  const years: { year: number; left: number; width: number }[] = [];
  for (let year = Number(axis.origin.slice(0, 4)); year <= Number(last.slice(0, 4)); year += 1) {
    const start = `${year}-01-01` < axis.origin ? axis.origin : `${year}-01-01`;
    const end = `${year}-12-31` > last ? last : `${year}-12-31`;
    years.push({ year, ...periodPlacement(axis, start, end) });
  }
  return years;
}

/** The first day of every month on the axis after its origin, for the tick marks of a closer zoom. */
export function axisMonths(axis: BoardAxis): { day: string; left: number }[] {
  const last = dayAt(axis, axis.days - 1);
  const months: { day: string; left: number }[] = [];
  let [year, month] = axis.origin.split("-").map(Number);
  for (;;) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
    const day = `${year}-${String(month).padStart(2, "0")}-01`;
    if (day > last) return months;
    months.push({ day, left: axisPercent(axis, dayIndex(axis, day)) });
  }
}

export function coursePhases(phases: PlanPhase[], courseId: string): PlanPhase[] {
  return phases.filter((phase) => phase.courseId === courseId).toSorted((left, right) => left.startDate.localeCompare(right.startDate));
}

/** Every change between two phases that adjoin without gap or overlap. Only these are moved as one day on the board. */
export function phaseJunctions(phases: PlanPhase[]): PhaseJunction[] {
  const sorted = phases.toSorted((left, right) => left.startDate.localeCompare(right.startDate));
  return sorted.slice(1).flatMap((later, index) => {
    const earlier = sorted[index];
    return later.startDate === plusDays(earlier.endDate, 1) ? [{ earlierId: earlier.id, laterId: later.id, day: later.startDate }] : [];
  });
}

/** Moves a change to `day`: the earlier phase then ends the day before, the later one begins on it. */
export function moveJunction(phases: PlanPhase[], junction: Pick<PhaseJunction, "earlierId" | "laterId">, day: string): PlanPhase[] {
  return phases.map((phase) => {
    if (phase.id === junction.earlierId) return { ...phase, endDate: plusDays(day, -1) };
    if (phase.id === junction.laterId) return { ...phase, startDate: day };
    return phase;
  });
}

/** The changes in runs of adjoining phases: a gap in the progression ends one run, since no change moves across it. */
export function junctionBlocks(phases: PlanPhase[]): PhaseJunction[][] {
  const blocks: PhaseJunction[][] = [];
  for (const junction of phaseJunctions(phases)) {
    const block = blocks.at(-1);
    if (block && block.at(-1)!.laterId === junction.earlierId) block.push(junction);
    else blocks.push([junction]);
  }
  return blocks;
}

/** The earliest and latest day a change can move to and still leave both of its phases `minimumPhaseDays` long. */
export function junctionRange(phases: PlanPhase[], junction: Pick<PhaseJunction, "earlierId" | "laterId">): { earliest: string; latest: string } | null {
  const earlier = phases.find((phase) => phase.id === junction.earlierId);
  const later = phases.find((phase) => phase.id === junction.laterId);
  if (!earlier || !later) return null;
  return { earliest: plusDays(earlier.startDate, minimumPhaseDays), latest: plusDays(later.endDate, 1 - minimumPhaseDays) };
}

function junctionPairs(phases: PlanPhase[]): string {
  return phaseJunctions(phases).map((junction) => `${junction.earlierId}>${junction.laterId}`).join();
}

/**
 * Whether moving a change to `day` leaves both of its phases at least `minimumPhaseDays` long, and leaves the same
 * phases adjoining: in a draft with overlapping phases, a move past another phase's start would end or create changes.
 */
export function junctionFits(phases: PlanPhase[], junction: Pick<PhaseJunction, "earlierId" | "laterId">, day: string): boolean {
  const earlier = phases.find((phase) => phase.id === junction.earlierId);
  const later = phases.find((phase) => phase.id === junction.laterId);
  if (!earlier || !later) return false;
  if (inclusiveDays(earlier.startDate, plusDays(day, -1)) < minimumPhaseDays || inclusiveDays(day, later.endDate) < minimumPhaseDays) return false;
  return junctionPairs(moveJunction(phases, junction, day)) === junctionPairs(phases);
}

/**
 * Several changes moved at once, as one step: every phase keeps `minimumPhaseDays` and the same phases keep adjoining,
 * judged on the result rather than one move after another. `null` when the result breaks either.
 */
export function moveJunctions(phases: PlanPhase[], moves: { junction: Pick<PhaseJunction, "earlierId" | "laterId">; day: string }[]): PlanPhase[] | null {
  const moved = moves.reduce((current, { junction, day }) => moveJunction(current, junction, day), phases);
  const long = moved.every((phase) => phase.endDate >= phase.startDate && inclusiveDays(phase.startDate, phase.endDate) >= minimumPhaseDays);
  return long && junctionPairs(moved) === junctionPairs(phases) ? moved : null;
}

/** The day nearest to `day`, going back towards the change's current day, that the change can move to. */
export function reachableDay(phases: PlanPhase[], junction: PhaseJunction, day: string): string {
  const range = junctionRange(phases, junction);
  let candidate = !range ? day : day < range.earliest ? range.earliest : day > range.latest ? range.latest : day;
  const step = candidate < junction.day ? 1 : -1;
  while (candidate !== junction.day && !junctionFits(phases, junction, candidate)) candidate = plusDays(candidate, step);
  return candidate;
}

/** The Monday nearest to a day. Phases practically always change on a Monday, so a drag lands there. */
export function nearestMonday(day: string): string {
  const offset = (weekdayIndex(day) + 6) % 7;
  return plusDays(day, offset <= 3 ? -offset : 7 - offset);
}

/** The last day of an event; a single-day event has no end date of its own. */
export function eventEnd(event: Pick<PlanEvent, "startDate" | "endDate">): string {
  return event.endDate ?? event.startDate;
}

export function eventPeriod(event: Pick<PlanEvent, "startDate" | "endDate">): string {
  return formatCalendarPeriod(event.startDate, eventEnd(event), { weekday: true });
}

function coveringPhase(phases: PlanPhase[], day: string): PlanPhase | undefined {
  return phases.find((phase) => phase.startDate <= day && phase.endDate >= day);
}

function placeOf(phases: PlanPhase[], day: string): string {
  const phase = coveringPhase(phases, day);
  return phase ? `in der ${phaseTypeLabel(phase.type)}phase von Semester ${phase.semester}` : "außerhalb jeder Kursphase";
}

/** What an event's move or a moved change does to where the event lies: another phase type or another semester. */
function placementConsequence(event: PlanEvent, before: PlanPhase[], after: PlanPhase[], beforeDay: string, afterDay: string): string | null {
  const was = placeOf(before, beforeDay);
  const is = placeOf(after, afterDay);
  return was === is ? null : `„${event.title}“ liegt jetzt ${is} statt ${was}.`;
}

/**
 * The difference between the saved and the current plan, told the way someone would say it: each moved change with the
 * phases' new lengths, and each moved event with where it lies now.
 */
export function describeChanges(saved: BoardPlan, current: BoardPlan): BoardChange[] {
  const changes: BoardChange[] = [];
  for (const junction of phaseJunctions(saved.phases)) {
    const later = current.phases.find((phase) => phase.id === junction.laterId);
    if (!later || later.startDate === junction.day) continue;
    const savedEarlier = saved.phases.find((phase) => phase.id === junction.earlierId)!;
    const savedLater = saved.phases.find((phase) => phase.id === junction.laterId)!;
    const earlier = current.phases.find((phase) => phase.id === junction.earlierId)!;
    const transition = later.semester === savedEarlier.semester ? "Wechsel" : "Semesterwechsel";
    const consequences = [
      `${phaseTypeLabel(earlier.type)} (Semester ${earlier.semester}): ${formatPeriodDuration(savedEarlier.startDate, savedEarlier.endDate)} → ${formatPeriodDuration(earlier.startDate, earlier.endDate)}`,
      `${phaseTypeLabel(later.type)} (Semester ${later.semester}): ${formatPeriodDuration(savedLater.startDate, savedLater.endDate)} → ${formatPeriodDuration(later.startDate, later.endDate)}`,
    ];
    changes.push({
      key: `junction:${junction.laterId}`,
      text: `${transition} ${phaseTypeLabel(savedEarlier.type)} → ${phaseTypeLabel(savedLater.type)} von ${formatCalendarDay(junction.day, { weekday: true })} auf ${formatCalendarDay(later.startDate, { weekday: true })} verschoben`,
      consequences,
    });
  }
  for (const event of current.events) {
    const savedEvent = saved.events.find((candidate) => candidate.id === event.id);
    if (!savedEvent || (savedEvent.startDate === event.startDate && eventEnd(savedEvent) === eventEnd(event))) continue;
    const consequence = placementConsequence(event, saved.phases, current.phases, savedEvent.startDate, event.startDate);
    const savedSemester = deriveEventSemester(saved.phases, event.courseIds[0], savedEvent.startDate);
    const semester = deriveEventSemester(current.phases, event.courseIds[0], event.startDate);
    const lengthened = savedEvent.startDate === event.startDate;
    changes.push({
      key: `event:${event.id}`,
      text: lengthened
        ? `„${event.title}“ dauert jetzt ${eventPeriod(event)} statt ${eventPeriod(savedEvent)}`
        : `„${event.title}“ von ${eventPeriod(savedEvent)} auf ${eventPeriod(event)} verschoben`,
      consequences: consequence ? [consequence] : savedSemester !== semester ? [`„${event.title}“ gehört jetzt zu Semester ${semester ?? "–"} statt ${savedSemester ?? "–"}.`] : [],
    });
  }
  return changes;
}

/**
 * The events that stayed on their dates but lie in another phase or semester now, each once: one or several moved
 * changes can do that together, so it belongs to none of them alone.
 */
export function affectedEvents(saved: BoardPlan, current: BoardPlan): string[] {
  return current.events.flatMap((event) => {
    const savedEvent = saved.events.find((candidate) => candidate.id === event.id);
    if (!savedEvent || savedEvent.startDate !== event.startDate || eventEnd(savedEvent) !== eventEnd(event)) return [];
    const consequence = placementConsequence(event, saved.phases, current.phases, event.startDate, event.startDate);
    return consequence ? [consequence] : [];
  });
}

export interface OpenPoint {
  key: string;
  message: string;
}

/**
 * The open points the current plan has and the saved one did not: what the changes would newly stand in the way of.
 * Points are told apart by what they concern, not by their text, which two dates of the same title share.
 */
export function newOpenPoints(course: CoursePlan, saved: BoardPlan, current: BoardPlan): OpenPoint[] {
  const points = (plan: BoardPlan) => validatePublication({ course, phases: plan.phases, events: plan.events }).map((issue) => ({
    key: [issue.code, issue.courseId ?? "", issue.eventId ?? "", issue.semester ?? "", issue.field ?? ""].join("|"),
    message: issue.message,
  }));
  const before = new Set(points(saved).map((point) => point.key));
  const seen = new Set<string>();
  return points(current).filter((point) => !before.has(point.key) && !seen.has(point.key) && seen.add(point.key));
}

/** Whether a phase of a parallel course has no phase of the same type, semester and period in the edited course's current plan. */
export function phaseDiffers(phase: PlanPhase, edited: PlanPhase[]): boolean {
  return !edited.some((candidate) => candidate.type === phase.type && candidate.semester === phase.semester && candidate.startDate === phase.startDate && candidate.endDate === phase.endDate);
}

function phaseName(phase: PlanPhase): string {
  return `${phaseTypeLabel(phase.type)}, Semester ${phase.semester}`;
}

function phaseSpan(phase: PlanPhase): string {
  return `${formatCalendarPeriod(phase.startDate, phase.endDate, { weekday: true })}, ${formatPeriodDuration(phase.startDate, phase.endDate)}`;
}

export interface ParallelDeviations {
  /** Set when the order of theory and practice differs; phase by phase, such a course would differ everywhere. */
  summary: string | null;
  /** The remaining differing phases, outside the semesters the summary already covers. */
  phases: string[];
}

const semesterList = new Intl.ListFormat("de-DE", { type: "conjunction" });

function phaseOrder(phases: PlanPhase[], semester: number): PlanPhase["type"][] {
  return phases.filter((phase) => phase.semester === semester).sort((a, b) => a.startDate.localeCompare(b.startDate)).map((phase) => phase.type);
}

/** How a parallel course's progression departs from the edited course's current one, in words. */
export function parallelDeviations(editedCode: string, edited: PlanPhase[], parallel: PlanPhase[]): ParallelDeviations {
  const editedSemesters = new Set(edited.map((phase) => phase.semester));
  const shared = [...new Set(parallel.map((phase) => phase.semester))].filter((semester) => editedSemesters.has(semester)).sort((a, b) => a - b);
  const reordered = shared.filter((semester) => {
    const theirs = phaseOrder(parallel, semester);
    const ours = phaseOrder(edited, semester);
    return theirs.join() !== ours.join() && [...theirs].sort().join() === [...ours].sort().join();
  });
  const parallelFirsts = new Set(reordered.map((semester) => phaseOrder(parallel, semester)[0]));
  const editedFirsts = new Set(reordered.map((semester) => phaseOrder(edited, semester)[0]));
  let summary: string | null = null;
  if (reordered.length && reordered.length === shared.length && parallelFirsts.size === 1 && editedFirsts.size === 1 && [...parallelFirsts][0] !== [...editedFirsts][0]) {
    summary = `anderes Studienmodell, jedes Semester beginnt mit ${phaseTypeLabel([...parallelFirsts][0])} statt mit ${phaseTypeLabel([...editedFirsts][0])}`;
  } else if (reordered.length) {
    summary = `andere Reihenfolge von Theorie und Praxis in Semester ${semesterList.format(reordered.map(String))}`;
  }

  // Each phase counts as a counterpart once: exact matches pair first, then the rest pair by semester and type in order.
  const byStart = (left: PlanPhase, right: PlanPhase) => left.startDate.localeCompare(right.startDate);
  const covered = (phase: PlanPhase) => reordered.includes(phase.semester);
  const ours = edited.filter((phase) => !covered(phase)).toSorted(byStart);
  const take = (matches: (own: PlanPhase) => boolean) => {
    const index = ours.findIndex(matches);
    return index < 0 ? undefined : ours.splice(index, 1)[0];
  };
  const unmatched = parallel.filter((phase) => !covered(phase)).toSorted(byStart)
    .filter((phase) => !take((own) => !phaseDiffers(phase, [own])));
  const differing = unmatched.map((phase) => {
    const own = take((candidate) => candidate.semester === phase.semester && candidate.type === phase.type);
    return own ? `${phaseName(phase)}: ${phaseSpan(phase)} (${editedCode}: ${phaseSpan(own)})` : `${phaseName(phase)}: ${phaseSpan(phase)} (bei ${editedCode} nicht vorhanden)`;
  });
  const missing = ours.map((phase) => `${phaseName(phase)}: nicht vorhanden (${editedCode}: ${phaseSpan(phase)})`);
  return { summary, phases: [...differing, ...missing] };
}
