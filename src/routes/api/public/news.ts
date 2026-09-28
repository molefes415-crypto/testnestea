import { createFileRoute } from "@tanstack/react-router";
import { getNewsEvents, predictNews, relevantEvents } from "@/lib/news.server";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, x-api-key, authorization",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json", ...CORS } });

// GET /api/public/news?action=calendar&impact=high
// GET /api/public/news?action=predict&symbols=XAUUSD,US30&min_confidence=80   (x-api-key required)
export const Route = createFileRoute("/api/public/news")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action") || "calendar";
        try {
          const events = await getNewsEvents();
          if (action === "calendar") {
            const impact = url.searchParams.get("impact")?.toLowerCase();
            const list = impact ? events.filter((e) => e.impact === impact) : events;
            return json({ success: true, source: "FinanceCalendar.com", count: list.length, events: list });
          }
          if (action === "predict") {
            const required = process.env["SCANNER_API_KEY"];
            const auth = request.headers.get("authorization") || "";
            const provided = request.headers.get("x-api-key") || (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "");
            if (required && provided !== required) return json({ success: false, error: "Invalid API key" }, 401);
            const symbols = (url.searchParams.get("symbols") || "XAUUSD")
              .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 8);
            const min = Math.max(30, Math.min(100, Number(url.searchParams.get("min_confidence")) || 75));
            const hasEvents = symbols.some((s) => relevantEvents(events, s, 48).length);
            if (!hasEvents) return json({ success: true, predictions: [], signals: [], summary: "No relevant news." });
            const out = await predictNews(symbols, events, min);
            const signals = (Array.isArray(out?.signals) ? out.signals : []).filter(
              (s: any) => (s.direction === "BUY" || s.direction === "SELL") && Number(s.confidence) >= min,
            );
            // Turn confident currency-bias predictions into symbol signals (deterministic, so trades actually fire).
            const preds: any[] = Array.isArray(out?.predictions) ? out.predictions : [];
            const seen = new Set(signals.map((s: any) => `${s.symbol}|${s.event}`));
            const now = Date.now();
            for (const p of preds) {
              const bias = String(p.currency_bias || "").toLowerCase();
              const cur = String(p.currency || "").toUpperCase();
              if ((bias !== "bullish" && bias !== "bearish") || Number(p.confidence) < min) continue;
              if (p.time_utc && new Date(p.time_utc).getTime() < now - 3600e3) continue;
              for (const sym of symbols) {
                const s = sym.replace(/[^A-Z]/g, "");
                let dir: "BUY" | "SELL" | null = null;
                if (/XAU|XAG|GOLD|BTC|ETH|US30|NAS|SPX|US500/.test(s)) { if (cur === "USD") dir = bias === "bullish" ? "SELL" : "BUY"; }
                else if (s.slice(0, 3) === cur) dir = bias === "bullish" ? "BUY" : "SELL";
                else if (s.slice(3, 6) === cur) dir = bias === "bullish" ? "SELL" : "BUY";
                if (!dir || seen.has(`${sym}|${p.event}`)) continue;
                seen.add(`${sym}|${p.event}`);
                const [sl, tp] = /XAU|GOLD/.test(s) ? [150, 300] : /US30|NAS|SPX|US500|BTC|ETH/.test(s) ? [80, 160] : [20, 40];
                signals.push({ symbol: sym, type: "news", direction: dir, event: p.event, event_time_utc: p.time_utc,
                  confidence: Number(p.confidence), entry_mode: "pre_release", sl_pips: sl, tp_pips: tp,
                  reason: `${cur} ${bias} (${p.expected}): ${p.reason}` });
              }
            }
            return json({ success: true, predictions: preds, signals, summary: out?.summary ?? "" });
          }
          return json({ success: false, error: "Unknown action" }, 400);
        } catch (e) {
          return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 502);
        }
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
    },
  },
});
