// Economic calendar (fundamentals) + AI news prediction helpers. Server-only.

import { fetchPortalCalendar, normalizeCalendarEvent, type NewsEvent } from "./news-calendar";
export type { NewsEvent } from "./news-calendar";

let cache: { at: number; events: NewsEvent[] } | null = null;

/** Portal calendar only, with a validated shared last-good cache. */
export async function getNewsEvents(): Promise<NewsEvent[]> {
  if (cache && Date.now() - cache.at < 300_000) return cache.events;
  // Shared cache across workers: the free calendar feed rate-limits aggressively.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let stored: NewsEvent[] = [];
  try {
    const { data } = await supabaseAdmin.from("news_calendar_cache").select("events, fetched_at").eq("id", 1).maybeSingle();
    if (data) {
      // Version the cached envelope so retired-provider rows cannot masquerade as portal data.
      const envelope = data.events as unknown as { source?: string; events?: unknown[] } | null;
      stored = envelope?.source === "tradenest-portal-v1" && Array.isArray(envelope.events)
        ? envelope.events.map(e => normalizeCalendarEvent(e)).filter((e): e is NewsEvent => e !== null) : [];
      if (stored.length && Date.now() - new Date(data.fetched_at).getTime() < 30 * 60_000) {
        cache = { at: Date.now(), events: stored };
        return stored;
      }
    }
  } catch (e) { console.error("News cache read failed", e); }
  let events: NewsEvent[] = [];
  let feedError: unknown;
  try { events = await fetchPortalCalendar(); } catch (e) { feedError = e; }
  if (!events.length) {
    // A valid empty calendar is not a feed failure and must not resurrect old releases.
    if (!feedError) { cache = { at: Date.now(), events: [] }; return []; }
    // Never cache an empty result; serve the last good calendar if we have one.
    if (cache?.events.length) return cache.events;
    if (stored.length) { cache = { at: Date.now(), events: stored }; return stored; }
    throw feedError ?? new Error("News calendar is temporarily unavailable. Tap refresh to try again.");
  }
  cache = { at: Date.now(), events };
  try {
    await supabaseAdmin.from("news_calendar_cache").upsert({ id: 1, events: { source: "tradenest-portal-v1", events } as any, fetched_at: new Date().toISOString() });
  } catch (e) { console.error("News cache write failed", e); }
  return events;
}

/** Currencies that move a symbol (XAUUSD -> USD, US30 -> USD, EURJPY -> EUR,JPY). */
export function currenciesFor(symbol: string): string[] {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/XAU|XAG|GOLD|US30|NAS|SPX|US500|DOW|BTC|ETH|OIL|WTI/.test(s)) return ["USD"];
  if (/GER|DAX|DE40/.test(s)) return ["EUR"];
  if (/UK100|FTSE/.test(s)) return ["GBP"];
  const m = s.match(/^([A-Z]{3})([A-Z]{3})/);
  return m ? [m[1], m[2]] : ["USD"];
}

export function relevantEvents(events: NewsEvent[], symbol: string, hoursAhead = 24) {
  const cur = currenciesFor(symbol);
  const now = Date.now();
  return events.filter((e) => {
    const t = new Date(e.time_utc).getTime();
    return (
      e.currency && cur.includes(e.currency.toUpperCase()) &&
      (e.impact === "high" || e.impact === "medium") &&
      t > now - 6 * 3600e3 && t < now + hoursAhead * 3600e3
    );
  });
}

export function fundamentalsText(events: NewsEvent[]) {
  if (!events.length) return "No high/medium-impact news for this symbol's currencies in the next 24h.";
  return events
    .slice(0, 15)
    .map((e) => `- ${e.time_utc} ${e.currency} [${e.impact}] ${e.name} | forecast ${e.forecast ?? "?"} | previous ${e.previous ?? "?"} | actual ${e.actual ?? "pending"}`)
    .join("\n");
}

/** Ask the AI to predict fundamentals (forecast vs previous/actual) and emit trade signals. */
export async function predictNews(symbols: string[], events: NewsEvent[], minConf = 75) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI not configured");
  const blocks = symbols
    .map((s) => `SYMBOL ${s}:\n${fundamentalsText(relevantEvents(events, s, 48))}`)
    .join("\n\n");
  const prompt = `You are TradeNest EA's fundamentals desk. For each event below predict the likely outcome versus forecast (beat / miss / inline), using forecast vs previous trend, actual if released, and macro context (rates, inflation, employment, central-bank tone). Then derive the directional impact on each symbol (USD strong => XAUUSD down, US30 depends on risk tone, etc).

${blocks}

Return STRICT JSON:
{
  "predictions": [ { "event_id": string, "event": string, "currency": string, "time_utc": string, "impact": string, "expected": "beat"|"miss"|"inline", "predicted_value": string, "currency_bias": "bullish"|"bearish"|"neutral", "confidence": 0-100, "reason": string } ],
  "signals": [ { "symbol": string, "type": "news"|"fundamental", "direction": "BUY"|"SELL", "event": string, "event_time_utc": string, "confidence": 0-100, "entry_mode": "pre_release"|"post_release"|"market", "sl_pips": number, "tp_pips": number, "reason": string } ],
  "summary": string
}
CONFIDENCE for a signal = probability the SYMBOL moves in your direction in the hours around the release, driven mainly by the forecast-vs-previous change (e.g. a rate hike forecast 4.35%->4.60% is AUD-bullish; NFP forecast 90K vs 162K prior is USD-bearish => XAUUSD BUY). It is NOT the probability of a surprise. Include a signal when confidence >= ${minConf}. When forecast/previous numbers are missing, use your own macro knowledge (recent trend, central-bank stance) to estimate the likely outcome and still give an honest confidence. Always give sl_pips and tp_pips (tp >= 1.5x sl). Never force signals below the threshold.`;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      reasoning_effort: "low",
      messages: [
        { role: "system", content: "Return strict JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j: any = await r.json();
  const text: string = j?.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { predictions: [], signals: [] };
  }
}
