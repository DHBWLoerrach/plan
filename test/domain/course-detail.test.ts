import { describe, expect, it } from "vitest";

import { buildCourseDetail, type DetailCourse } from "@/lib/domain/course-detail";
import type { CourseEvent, CoursePhase, CoursePlan } from "@/lib/domain/publication";

const course: DetailCourse = {
  id: "wwi25b", code: "WWI25B", studyStart: "2025-10-01", studyEnd: "2028-09-30", semesters: 6,
  program: "Wirtschaftsinformatik – Application Management", programAbbreviation: "WWI", area: "Wirtschaft", year: 2025,
};

function phase(courseId: string, semester: number, type: "THEORY" | "PRACTICE", startDate: string, endDate: string): CoursePhase {
  return { courseId, semester, type, startDate, endDate };
}

function progression(courseId: string): CoursePhase[] {
  return [
    phase(courseId, 1, "PRACTICE", "2025-10-01", "2026-01-06"), phase(courseId, 1, "THEORY", "2026-01-07", "2026-03-29"),
    phase(courseId, 1, "PRACTICE", "2026-03-30", "2026-04-12"), phase(courseId, 2, "THEORY", "2026-04-13", "2026-07-05"),
    phase(courseId, 2, "PRACTICE", "2026-07-06", "2026-09-27"), phase(courseId, 3, "THEORY", "2026-09-28", "2026-12-20"),
    phase(courseId, 3, "PRACTICE", "2026-12-21", "2027-03-28"), phase(courseId, 4, "THEORY", "2027-03-29", "2027-06-27"),
    phase(courseId, 4, "PRACTICE", "2027-06-28", "2027-09-26"), phase(courseId, 5, "THEORY", "2027-09-27", "2027-12-19"),
    phase(courseId, 5, "PRACTICE", "2027-12-20", "2028-01-09"), phase(courseId, 6, "THEORY", "2028-01-10", "2028-04-02"),
    phase(courseId, 6, "PRACTICE", "2028-04-03", "2028-09-30"),
  ];
}

function event(id: string, title: string, startDate: string, overrides: Partial<CourseEvent> = {}): CourseEvent {
  return { id, courseId: "wwi25b", title, description: null, category: "SUBMISSION", startDate, endDate: null, provisional: false, ...overrides };
}

const events = [
  event("e1", "Anmeldung 1. Projektarbeit", "2026-07-20", { description: "mit Mitteilung des gewünschten Schwerpunkts" }),
  event("e2", "Abgabe 1. Projektarbeit", "2026-09-28"),
  event("e3", "Anmeldung 2. Projektarbeit", "2027-07-05"),
  event("e4", "Kolloquium Bachelorarbeit", "2028-09-18", { endDate: "2028-09-21", provisional: true }),
];

function detail(overrides: { today?: string; parallels?: CoursePlan[]; phases?: CoursePhase[]; events?: CourseEvent[] } = {}) {
  return buildCourseDetail({
    course,
    parallels: overrides.parallels ?? [],
    phases: overrides.phases ?? progression("wwi25b"),
    events: overrides.events ?? events,
    updatedAt: "2026-11-08T23:30:00.000Z",
    today: overrides.today ?? "2026-11-20",
  });
}

describe("buildCourseDetail", () => {
  it("names the course, its duration and the Berlin day of its last change", () => {
    const { code, program, year, duration, stand } = detail();

    expect({ code, program, year, duration, stand }).toEqual({
      code: "WWI25B", program: "Wirtschaftsinformatik – Application Management", year: 2025,
      duration: "6 Semester, bis 30.09.2028", stand: "09.11.2026",
    });
  });

  it("says where the students are, where they go next and which date comes", () => {
    expect(detail().standing).toEqual([
      { label: "Jetzt · Fr 20.11.2026", main: "An der DHBW", detail: "seit Mo 28.09.2026 · 3. Semester", phase: "theory" },
      { label: "Als Nächstes", main: "Im Unternehmen", detail: "ab Mo 21.12.2026 · in 4 Wochen", phase: "practice" },
      { label: "Nächster Termin", main: "Anmeldung 2. Projektarbeit", detail: "Mo 05.07.2027 · in 7 Monaten", phase: null },
    ]);
  });

  it("marks a provisional next date as such right beside its date", () => {
    const [, , card] = detail({ today: "2028-09-19" }).standing;

    expect(card).toEqual({ label: "Nächster Termin", main: "Kolloquium Bachelorarbeit", detail: "Mo 18.09.2028 – Do 21.09.2028 (vorläufig) · läuft", phase: null });
  });

  it("counts a stay over a semester change as one, from its first day", () => {
    const [now, next] = detail({ today: "2026-04-01" }).standing;

    expect(now.detail).toBe("seit Mo 30.03.2026 · 1. Semester");
    expect(next).toMatchObject({ main: "An der DHBW", detail: "ab Mo 13.04.2026 · in 12 Tagen" });
  });

  it("names the study start before it and the study end without dates", () => {
    const standing = detail({ today: "2025-09-01", events: [] }).standing;

    expect(standing[0]).toEqual({ label: "Jetzt · Mo 01.09.2025", main: "Noch nicht begonnen", detail: "Studienbeginn Mi 01.10.2025", phase: null });
    expect(standing[2]).toEqual({ label: "Studienende", main: "Sa 30.09.2028", detail: "in 37 Monaten · keine Prüfungstermine im Plan", phase: null });
  });

  it("draws one row per study year, with the phases, semester starts and today", () => {
    const { months, rows } = detail().timeline;

    expect(months.map((month) => month.label)).toEqual(["Okt", "Nov", "Dez", "Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep"]);
    expect(rows.map((row) => [row.label, row.detail])).toEqual([
      ["1. Studienjahr", "Semester 1–2 · 2025/26"],
      ["2. Studienjahr", "Semester 3–4 · 2026/27"],
      ["3. Studienjahr", "Semester 5–6 · 2027/28"],
    ]);
    expect(rows.map((row) => row.today === null)).toEqual([true, false, true]);
    expect(rows[1].semesterStarts.map((start) => start.semester)).toEqual([3, 4]);
    expect(rows[0].segments[0]).toMatchObject({ phase: "practice", label: "14 Wo." });
    expect(rows[0].segments[2]).toMatchObject({ phase: "practice", label: null, title: "30.03.2026 – 12.04.2026 · Im Unternehmen · 2 Wochen" });
    const last = rows[2].segments.at(-1)!;
    expect(last.left + last.width).toBeLessThanOrEqual(100);
  });

  it("puts each date into the row of the phase it falls in", () => {
    const { rows } = detail().timeline;

    expect(rows.map((row) => row.marks.map((mark) => mark.id))).toEqual([["e1"], ["e2", "e3"], ["e4"]]);
    expect(rows[2].marks[0]).toMatchObject({ span: true, provisional: true, text: "Mo 18.09.2028 – Do 21.09.2028: Kolloquium Bachelorarbeit (Abgabe, vorläufig)" });
    expect(rows[0].marks[0]).toMatchObject({ span: false, provisional: false });
  });

  it("widens every row to hold a phase that runs past the anniversary of the study start", () => {
    const longer = { ...course, studyEnd: "2028-10-28" };
    const phases = [...progression("wwi25b"), phase("wwi25b", 6, "THEORY", "2028-10-01", "2028-10-28")];
    const { months, rows } = buildCourseDetail({ course: longer, parallels: [], phases, events: [], updatedAt: "2026-01-01T00:00:00Z", today: "2026-11-20" }).timeline;

    const closing = rows[2].segments.at(-1)!;
    expect(closing.width).toBeGreaterThan(2);
    expect(closing.left + closing.width).toBeLessThanOrEqual(100);
    expect(months.map((month) => month.label)).toEqual(["Okt", "Nov", "Dez", "Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt"]);
    // The same date stands at the same place in every row.
    const october = (row: number) => rows[row].semesterStarts[0].left;
    expect(Math.abs(october(1) - october(2))).toBeLessThan(0.5);
  });

  it("draws a date across two rows in both of them, with one toggle on its first part", () => {
    const across = event("x", "Projektwoche", "2026-09-21", { endDate: "2026-10-02" });
    const { rows } = detail({ events: [across] }).timeline;

    expect(rows[0].marks.map((mark) => [mark.key, mark.target])).toEqual([["x-2026-09-21", true]]);
    expect(rows[1].marks.map((mark) => [mark.key, mark.target])).toEqual([["x-2026-09-28", false]]);
    expect(rows[1].marks[0].width).toBeGreaterThan(0);
  });

  it("tells apart dates of one title on one day by their category", () => {
    const { rows } = detail({ events: [
      event("r", "Projektarbeit", "2026-10-05", { category: "REGISTRATION" }),
      event("s", "Projektarbeit", "2026-10-05"),
    ] }).timeline;

    expect(rows[1].marks.map((mark) => mark.text)).toEqual([
      "Mo 05.10.2026: Projektarbeit (Anmeldung)",
      "Mo 05.10.2026: Projektarbeit (Abgabe)",
    ]);
  });

  it("puts dates whose targets would overlap onto lanes of their own", () => {
    const { rows } = detail({ events: [
      event("a", "Abgabe", "2026-09-28"),
      event("b", "Anmeldung", "2026-09-28"),
      event("c", "Präsentation", "2026-10-02"),
      event("d", "Klausur", "2027-02-15"),
    ] }).timeline;

    expect(rows[1].marks.map((mark) => [mark.id, mark.level])).toEqual([["a", 0], ["b", 1], ["c", 2], ["d", 0]]);
    expect(rows[1].levels).toBe(3);
    expect(rows[0].levels).toBe(1);
  });

  it("lays out the targets as they stand at the edge of the track, pushed back inside it", () => {
    // Apart where centred, but the last target moves left at the edge and onto the one before it.
    const { rows } = detail({ events: [
      event("bar", "Präsentation", "2028-09-07", { endDate: "2028-09-08" }),
      event("end", "Schlussprüfung", "2028-09-30"),
    ] }).timeline;

    expect(rows[2].marks.map((mark) => [mark.id, mark.level])).toEqual([["bar", 0], ["end", 1]]);
  });

  it("leads on to the program, the area and the whole year for comparison", () => {
    expect(detail().comparisons).toEqual([
      { label: "Studiengang Wirtschaftsinformatik – Application Management", href: "/jahrgang/2025/studiengang/WWI" },
      { label: "Bereich Wirtschaft", href: "/jahrgang/2025/bereich/Wirtschaft" },
      { label: "ganzer Jahrgang", href: "/jahrgang/2025" },
    ]);
  });

  it("lists the phases per study year, the semester once over its rows", () => {
    const [first, second] = detail().phaseYears;

    expect(first.label).toBe("1. Studienjahr · 2025/26");
    expect(first.rows.map((row) => [row.semester, row.semesterRows, row.place, row.duration, row.timing])).toEqual([
      [1, 3, "Im Unternehmen", "14 Wochen", "past"],
      [1, 0, "An der DHBW", "11 Wochen, 5 Tage", "past"],
      [1, 0, "Im Unternehmen", "2 Wochen", "past"],
      [2, 2, "An der DHBW", "12 Wochen", "past"],
      [2, 0, "Im Unternehmen", "12 Wochen", "past"],
    ]);
    expect(second.rows.map((row) => row.timing)).toEqual(["now", "future", "future", "future"]);
    expect(second.rows[0].period).toBe("28.09.2026 – 20.12.2026");
  });

  it("names the category of each date and the semester its start day falls into", () => {
    const rows = detail({ events: [...events, event("e5", "Projektarbeit", "2027-09-26", { category: "REGISTRATION" })] }).events;

    expect(rows.map((row) => [row.id, row.category, row.semester])).toEqual([
      ["e1", "Abgabe", "2. Semester"],
      ["e2", "Abgabe", "3. Semester"],
      ["e3", "Abgabe", "4. Semester"],
      ["e5", "Anmeldung", "4. Semester"],
      ["e4", "Abgabe", "6. Semester"],
    ]);
  });

  it("marks the next date and the ones that have passed", () => {
    expect(detail().events.map((row) => [row.id, row.date, row.timing])).toEqual([
      ["e1", "Mo 20.07.2026", "past"],
      ["e2", "Mo 28.09.2026", "past"],
      ["e3", "Mo 05.07.2027", "next"],
      ["e4", "Mo 18.09.2028 – Do 21.09.2028", "future"],
    ]);
  });

  it("names other descriptions of otherwise equal dates instead of an equal plan", () => {
    const parallel: CoursePlan = { id: "wwi25a", code: "WWI25A", studyStart: course.studyStart, studyEnd: course.studyEnd, semesters: 6 };
    const { parallels } = detail({
      parallels: [parallel],
      phases: [...progression("wwi25b"), ...progression("wwi25a")],
      events: [
        event("own", "Klausur", "2027-02-15", { description: "Raum A 101" }),
        event("other", "Klausur", "2027-02-15", { courseId: "wwi25a", description: "Raum B 202" }),
      ],
    });

    expect(parallels[0].note).toBe("gleicher Kursverlauf und gleiche Termine, andere Terminbeschreibungen");
  });

  it("says how each parallel course differs", () => {
    const parallel = (id: string, code: string): CoursePlan => ({ id, code, studyStart: course.studyStart, studyEnd: course.studyEnd, semesters: 6 });
    const firstSemesterOther = progression("wwi25a").map((entry, index) => index === 0 ? { ...entry, endDate: "2026-01-04" } : index === 1 ? { ...entry, startDate: "2026-01-05" } : entry);
    const allOther = progression("wwi25c").map((entry) => ({ ...entry, type: entry.type === "THEORY" ? "PRACTICE" as const : "THEORY" as const }));

    const { parallels } = detail({
      parallels: [parallel("wwi25a", "WWI25A"), parallel("wwi25c", "WWI25C"), parallel("wwi25d", "WWI25D")],
      phases: [...progression("wwi25b"), ...firstSemesterOther, ...allOther, ...progression("wwi25d")],
      events: [...events, ...events.map((entry) => ({ ...entry, id: `${entry.id}-d`, courseId: "wwi25d" }))],
    });

    expect(parallels).toEqual([
      { code: "WWI25A", href: "/WWI25A", note: "Kursverlauf im 1. Semester abweichend, andere Termine" },
      { code: "WWI25C", href: "/WWI25C", note: "Kursverlauf durchgehend abweichend, andere Termine" },
      { code: "WWI25D", href: "/WWI25D", note: "gleicher Plan" },
    ]);
  });
});
