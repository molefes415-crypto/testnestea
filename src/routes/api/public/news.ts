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
            return json({ success: true, predictions: out?.predictions ?? [], signals, summary: out?.summary ?? "" });
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
