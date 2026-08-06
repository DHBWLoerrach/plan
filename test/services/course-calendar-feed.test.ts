import { describe, expect, it, vi } from "vitest";

import { createCourseCalendarReader } from "@/lib/services/course-calendar-feed";

const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:one\r\nSUMMARY:Analysis\r\nDTSTART:20260513T070000Z\r\nDTEND:20260513T101500Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;

function reader(fetcher: typeof fetch, now = () => 1_000) {
  return createCourseCalendarReader({
    fetcher,
    now,
    urlForCourse: (courseCode) => `https://calendar.test/${courseCode}.ics`,
  });
}

describe("course calendar feed", () => {
  it("reads, validates and caches one DHBW feed per course for ten minutes", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(ics, { headers: { "content-type": "text/calendar" } }));
    const read = reader(fetcher);

    const first = await read("TIF25A");
    const second = await read("tif25a");

    expect(first).toEqual({ kind: "available", events: [expect.objectContaining({ title: "Analysis" })] });
    expect(second).toEqual(first);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("https://calendar.test/tif25a.ics", expect.objectContaining({ cache: "no-store" }));
  });

  it("deduplicates concurrent requests and does not cache failures", async () => {
    let resolve!: (response: Response) => void;
    const firstResponse = new Promise<Response>((done) => { resolve = done; });
    const fetcher = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => firstResponse)
      .mockResolvedValueOnce(new Response(ics, { headers: { "content-type": "text/calendar" } }));
    const read = reader(fetcher);

    const first = read("TIF25A");
    const concurrent = read("TIF25A");
    resolve(new Response("nicht erreichbar", { status: 503 }));

    await expect(first).resolves.toEqual({ kind: "unavailable" });
    await expect(concurrent).resolves.toEqual({ kind: "unavailable" });
    await expect(read("TIF25A")).resolves.toEqual({ kind: "available", events: expect.any(Array) });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not request unsupported course codes or accept an HTML error page as a calendar", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("<html>nicht gefunden</html>", { headers: { "content-type": "text/html" } }));
    const read = reader(fetcher);

    await expect(read("TIF 25 A")).resolves.toEqual({ kind: "not-found" });
    expect(fetcher).not.toHaveBeenCalled();
    await expect(read("TIF25A")).resolves.toEqual({ kind: "not-found" });
  });

  it("refuses calendar files larger than five megabytes", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("x", {
      headers: { "content-type": "text/calendar", "content-length": String(5 * 1024 * 1024 + 1) },
    }));

    await expect(reader(fetcher)("TIF25A")).resolves.toEqual({ kind: "unavailable" });
  });
});
