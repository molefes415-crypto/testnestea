// Economic calendar (fundamentals) + AI news prediction helpers. Server-only.

export type NewsEvent = {
  id: string;
  date: string;
  time: string;
  datetime_sast?: string;
  time_utc: string;
  day?: string;
  name: string;
  currency: string | null;
  impact: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
};

const PORTAL_NEWS = "https://tradenestea.com/admin/api/news.php";
const FC_BASE = "https://www.financecalendar.com/wp-json/fc/v1/calendar";

let cache: { at: number; events: NewsEvent[] } | null = null;

function guessCurrency(n: string): string | null {
  const s = n.toUpperCase();
  const map: [RegExp, string][] = [
    [/\b(US|FED|FOMC|NFP|NONFARM|POWELL|ISM|JOLTS)\b/, "USD"], [/\b(RBA|AUSTRALIA|AUD)\b/, "AUD"],
    [/\b(ECB|EURO|EUROZONE|GERMAN|FRANCE|SPAIN|ITALY|EUR)\b/, "EUR"], [/\b(BOE|UK|BRITAIN|GBP)\b/, "GBP"],
    [/\b(BOJ|JAPAN|JPY|TOKYO)\b/, "JPY"], [/\b(BOC|CANADA|CAD)\b/, "CAD"], [/\b(SNB|SWISS|CHF)\b/, "CHF"],
    [/\b(RBNZ|NEW ZEALAND|NZD)\b/, "NZD"], [/\b(CHINA|PBOC|CNY)\b/, "CNY"], [/\b(SARB|SOUTH AFRICA|ZAR)\b/, "ZAR"],
  ];
  for (const [re, c] of map) if (re.test(s)) return c;
  return null;
}

function norm(e: any): NewsEvent | null {
  const t = e?.time_utc || e?.date;
  if (!t) return null;
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  return {
    id: String(e.id ?? `${e.name ?? e.title}-${d.toISOString()}`),
    date: e.date?.length === 10 ? e.date : d.toISOString().slice(0, 10),
    time: e.time ?? d.toISOString().slice(11, 16),
    datetime_sast: e.datetime_sast,
    time_utc: d.toISOString(),
    day: e.day,
    name: e.name ?? e.title ?? "Economic Event",
    currency: e.currency ?? e.country ?? guessCurrency(String(e.name ?? e.title ?? "")),
    impact: String(e.impact ?? "unknown").toLowerCase(),
    forecast: e.forecast ?? e.consensus ?? null,
    previous: e.previous ?? e.prior ?? null,
    actual: e.actual ?? null,
  };
}

/** Portal news.php first, FinanceCalendar direct as fallback. Cached 5 min. */
export async function getNewsEvents(): Promise<NewsEvent[]> {
  if (cache && Date.now() - cache.at < 300_000) return cache.events;
  let raw: any[] = [];
  // 1) ForexFactory weekly feed — has forecast + previous for every event.
  try {
    const r = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      headers: { "user-agent": "TradeNest News Calendar" },
    });
    if (r.ok) {
      const j: any = await r.json();
      if (Array.isArray(j))
        raw = j.map((e: any) => ({
          ...e,
          currency: e.country,
          forecast: e.forecast || null,
          previous: e.previous || null,
          actual: e.actual || null,
        }));
    }
  } catch {}
  if (!raw.length) try {
    const r = await fetch(`${PORTAL_NEWS}?_=${Date.now()}`, { headers: { accept: "application/json" } });
    if (r.ok) {
      const j: any = await r.json();
      if (Array.isArray(j?.events)) raw = j.events;
    }
  } catch {}
  if (!raw.length) {
    try {
      const from = new Date().toISOString().slice(0, 10);
      const to = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      const r = await fetch(`${FC_BASE}?from=${from}&to=${to}&limit=500`, {
        headers: { "user-agent": "TradeNest News Calendar" },
      });
      if (r.ok) {
        const j: any = await r.json();
        raw = Array.isArray(j?.events) ? j.events : Array.isArray(j) ? j : [];
      }
    } catch {}
  }
  const events = raw.map(norm).filter(Boolean) as NewsEvent[];
  events.sort((a, b) => a.time_utc.localeCompare(b.time_utc));
  cache = { at: Date.now(), events };
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
Only include a signal when confidence >= ${minConf}. When forecast/previous numbers are missing, use your own macro knowledge (recent trend, central-bank stance) to estimate the likely outcome and still give an honest confidence. Always give sl_pips and tp_pips (tp >= 1.5x sl). Never force signals below the threshold.`;
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
