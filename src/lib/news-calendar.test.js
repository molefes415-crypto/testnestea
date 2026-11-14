import { test, expect } from "bun:test";
import { parseCalendarPayload, fetchPortalCalendar } from "./news-calendar";

const now = Date.parse("2026-11-14T11:20:00Z");
test("documented provider ts fields preserve forecast, previous, actual and SAST release time", () => {
  const [e] = parseCalendarPayload({ success: true, events: [{ ts: 1794654000, title: "BoE speech", currency: "GBP", impact: "medium", forecast: "0.7%", previous: "1.2%", actual: 0 }] }, now);
  expect(e.time_utc).toBe("2026-11-14T11:00:00.000Z");
  expect(e.time).toBe("13:00");
  expect([e.forecast, e.previous, e.actual]).toEqual(["0.7%", "1.2%", "0"]);
  expect(e.day).toBe("today");
});
test("gateway today tomorrow next_week groups are supported", () => {
  const events = parseCalendarPayload({ success: true, groups: {
    today: [{ title: "Today", time_utc: "2026-11-14T11:00:00Z" }],
    tomorrow: [{ title: "Tomorrow", time_utc: "2026-11-15T11:00:00Z" }],
    next_week: [{ title: "Next week", time_utc: "2026-11-16T11:00:00Z" }],
  } }, now);
  expect(events.map(e => e.day)).toEqual(["today", "tomorrow", "next_week"]);
});
test("empty actual is pending and API-key notices are not economic releases", () => {
  const events = parseCalendarPayload({ success: true, events: [
    { title: "Finance Calendar API key needed to load events.", time_utc: "2026-11-14T00:00:00Z" },
    { title: "Retail sales", timestamp: 1794654000, actual: "" },
  ] }, now);
  expect(events.length).toBe(1);
  expect(events[0].actual).toBeNull();
});
test("malformed Python-wrapped response is rejected rather than reported as a live calendar", async () => {
  const fetcher = (async () => new Response(`from pathlib import Path\nphp = r'''{"success":true,"events":[]}'''`));
  await expect(fetchPortalCalendar(fetcher)).rejects.toThrow("not valid JSON");
});
test("unsuccessful upstream payload is rejected", () => {
  expect(() => parseCalendarPayload({ success: false, events: [] })).toThrow();
});