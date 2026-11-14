import { z } from "zod";

export type NewsEvent = {
  id: string; date: string; time: string; datetime_sast?: string;
  time_utc: string; day?: string; name: string; currency: string | null;
  impact: string; forecast: string | null; previous: string | null; actual: string | null;
};

const eventSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  ts: z.union([z.number(), z.string()]).optional(),
  timestamp: z.union([z.number(), z.string()]).optional(),
  time_utc: z.string().optional(), datetime_sast: z.string().optional(),
  title: z.string().optional(), name: z.string().optional(),
  currency: z.string().nullish(), impact: z.string().optional(),
  forecast: z.union([z.string(), z.number()]).nullish(),
  previous: z.union([z.string(), z.number()]).nullish(),
  actual: z.union([z.string(), z.number()]).nullish(),
});
const payloadSchema = z.object({
  success: z.literal(true),
  events: z.array(z.unknown()).optional(),
  groups: z.object({ today: z.array(z.unknown()).optional(), tomorrow: z.array(z.unknown()).optional(), next_week: z.array(z.unknown()).optional() }).optional(),
});
const value = (v: string | number | null | undefined) => v == null || String(v).trim() === "" ? null : String(v);
const localParts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).formatToParts(date).map(p => [p.type, p.value]));

export function normalizeCalendarEvent(input: unknown, now = Date.now()): NewsEvent | null {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return null;
  const e = parsed.data;
  const title = e.title || e.name;
  if (!title?.trim() || /api key|financecalendar\.com\/account/i.test(title)) return null;
  const sastTime = e.datetime_sast?.replace(" ", "T");
  const zonedSast = sastTime && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(sastTime) ? `${sastTime}+02:00` : sastTime;
  const rawTime = e.ts ?? e.timestamp ?? e.time_utc ?? zonedSast;
  if (rawTime == null) return null;
  const numeric = typeof rawTime === "number" || /^\d+(\.\d+)?$/.test(rawTime);
  const date = new Date(numeric ? Number(rawTime) * (Number(rawTime) < 1e12 ? 1000 : 1) : rawTime);
  if (!Number.isFinite(date.getTime())) return null;
  const p = localParts(date);
  const dayDate = `${p.year}-${p.month}-${p.day}`;
  const today = localParts(new Date(now));
  const tomorrow = localParts(new Date(now + 86400000));
  const day = dayDate === `${today.year}-${today.month}-${today.day}` ? "today" : dayDate === `${tomorrow.year}-${tomorrow.month}-${tomorrow.day}` ? "tomorrow" : "next_week";
  return {
    id: String(e.id ?? `${e.currency ?? ""}-${title}-${date.toISOString()}`),
    date: dayDate, time: `${p.hour}:${p.minute}`, datetime_sast: `${dayDate}T${p.hour}:${p.minute}:00+02:00`,
    time_utc: date.toISOString(), day, name: title, currency: e.currency?.toUpperCase() || null,
    impact: (e.impact ?? "unknown").toLowerCase(), forecast: value(e.forecast), previous: value(e.previous), actual: value(e.actual),
  };
}

export function parseCalendarPayload(input: unknown, now = Date.now()): NewsEvent[] {
  const payload = payloadSchema.parse(input);
  const raw = payload.events ?? Object.values(payload.groups ?? {}).flatMap(items => items ?? []);
  const events = raw.map(e => normalizeCalendarEvent(e, now)).filter((e): e is NewsEvent => e !== null);
  return [...new Map(events.map(e => [e.id, e])).values()].sort((a, b) => a.time_utc.localeCompare(b.time_utc));
}

export async function fetchPortalCalendar(fetcher: typeof fetch = fetch): Promise<NewsEvent[]> {
  const response = await fetcher("https://tradenestea.com/admin/api/news.php", {
    headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`News calendar HTTP ${response.status}`);
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new Error("News calendar feed is not valid JSON. The news.php host must return JSON only."); }
  return parseCalendarPayload(payload);
}