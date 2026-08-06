import "server-only";

import { parseCourseCalendar, type CalendarEvent } from "@/lib/domain/course-calendar";

export type CourseCalendarReadResult =
  | { kind: "available"; events: CalendarEvent[] }
  | { kind: "not-found" }
  | { kind: "unavailable" };

type ReaderOptions = {
  fetcher?: typeof fetch;
  now?: () => number;
  urlForCourse?: (courseCode: string) => string;
};

const courseCodePattern = /^[a-z]{3,6}\d{2}[a-z]?(?:-[a-z]{1,20})?$/u;
const cacheTtl = 10 * 60 * 1_000;
const maxCalendarBytes = 5 * 1024 * 1024;
const maxCachedCourses = 100;
const defaultUrlTemplate = "https://webmail.dhbw-loerrach.de/owa/calendar/kal-{course}@dhbw-loerrach.de/Kalender/calendar.ics";

/**
 * The configured address, read and checked once. A template without its placeholder — or with more than one — is a
 * misconfiguration that no request will ever get past, so it is rejected where the reader is built rather than inside
 * the request: there its error would have been caught along with a refused connection and reached the reading account
 * as „zurzeit nicht erreichbar“, the one sentence that says it will pass by itself.
 */
function configuredUrlForCourse(): (courseCode: string) => string {
  const template = process.env.DHBW_CALENDAR_URL_TEMPLATE ?? defaultUrlTemplate;
  if (template.split("{course}").length !== 2) {
    throw new Error("DHBW_CALENDAR_URL_TEMPLATE muss den Platzhalter {course} genau einmal enthalten.");
  }
  return (courseCode) => template.replace("{course}", encodeURIComponent(courseCode));
}

async function limitedText(response: Response): Promise<string | null> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxCalendarBytes) return null;
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    bytes += value.byteLength;
    if (bytes > maxCalendarBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

/** A bounded process-local cache mirrors the single-container deployment and deduplicates concurrent upstream reads. */
export function createCourseCalendarReader(options: ReaderOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const urlForCourse = options.urlForCourse ?? configuredUrlForCourse();
  const cache = new Map<string, { expiresAt: number; promise: Promise<CourseCalendarReadResult> }>();

  return async function read(courseCode: string): Promise<CourseCalendarReadResult> {
    const normalizedCode = courseCode.trim().toLocaleLowerCase("de-DE");
    if (!courseCodePattern.test(normalizedCode)) return { kind: "not-found" };

    const cached = cache.get(normalizedCode);
    if (cached && cached.expiresAt > now()) return cached.promise;
    if (cached) cache.delete(normalizedCode);

    const promise = (async (): Promise<CourseCalendarReadResult> => {
      try {
        const response = await fetcher(urlForCourse(normalizedCode), {
          cache: "no-store",
          headers: { accept: "text/calendar" },
          signal: AbortSignal.timeout(20_000),
        });
        if (response.status === 404) return { kind: "not-found" };
        if (!response.ok) return { kind: "unavailable" };
        if (!response.headers.get("content-type")?.toLocaleLowerCase("en-US").includes("text/calendar")) {
          return { kind: "not-found" };
        }
        const text = await limitedText(response);
        return text === null ? { kind: "unavailable" } : { kind: "available", events: parseCourseCalendar(text) };
      } catch {
        return { kind: "unavailable" };
      }
    })();

    cache.set(normalizedCode, { expiresAt: now() + cacheTtl, promise });
    if (cache.size > maxCachedCourses) cache.delete(cache.keys().next().value!);
    const result = await promise;
    if (result.kind !== "available" && cache.get(normalizedCode)?.promise === promise) cache.delete(normalizedCode);
    return result;
  };
}

export const readCourseCalendar = createCourseCalendarReader();
