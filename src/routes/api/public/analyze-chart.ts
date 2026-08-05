import { createFileRoute } from "@tanstack/react-router";

const MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5-mini",
];


type AnalyzeBody = {
  imageBase64?: string | null;
  symbol?: string;
  strategy?: string;
  vaultStrategies?: string[];
  tradeStyle?: string; // scalp | day | swing
  session?: string;
  timeframe?: string;
  userPrompt?: string;
  dataSource?: string;
  confidenceThreshold?: number;
  orderType?: string; // instant | buy_limit | sell_limit | buy_stop | sell_stop
  trailStop?: boolean;
  licenseKey?: string | null;
};

const FOCUS_ASSETS = ["XAUUSD (Gold)", "US30 (Dow)", "NAS100 (Nasdaq)", "BTCUSD (Bitcoin)"];

function styleRules(style: string | undefined) {
  const s = (style || "day").toLowerCase();
  if (s === "scalp") {
    return `SCALP MODE — DIRECT SNIPER + REVERSAL HUNTER on M1–M5. Prioritise catching the EXACT reversal candle after a liquidity sweep (stop-hunt) into an HTF POI (FVG / OB / equilibrium). Fire the moment CHoCH + displacement confirms — do not wait for retest if momentum is explosive.
    Also catch DIRECT SNIPERS: instant continuation entries at unmitigated OB / breaker after BOS with volume expansion.
    Use TIGHT stops (5–15 pips gold / 20–80 pts indices / 60–200$ BTC) placed just beyond the sweep wick. TP1 = 1R, TP2 = 2R, TP3 = 3R. Confidence >= 78 or return NEUTRAL.`;
  }
  if (s === "swing") {
    return `SWING MODE — Multi-day reversal + continuation sniper on H4/D1 structure. Catch major reversals at weekly/daily liquidity + HTF OB mitigation. Return "tp": null and "takeProfit": [] — swing uses stop-loss ONLY.
    Provide a "closeSignal" describing the exact market condition that means CLOSE (e.g. "Close on H4 CHoCH against position" or "Close when price closes below 21EMA on D1"). Wider SL (2–4% of price). Confidence >= 70.`;
  }
  return `DAY MODE — Full session bias from London/NY open with DIRECT SNIPER + REVERSAL detection. Identify the day's manipulation leg (Asia sweep / London judas) and fire the reversal at the distribution/accumulation POI. Also flag direct continuation snipers off unmitigated intraday OB after BOS. ONE clear directional call with sniper entry, SL and 3 TPs (1R/2R/3R). Confidence >= 72.`;
}


function buildPrompt(b: AnalyzeBody) {
  const focused = FOCUS_ASSETS.includes(b.symbol || "") || /XAU|GOLD|US30|NAS100|BTC/i.test(b.symbol || "");
  return `You are TradeNest EA — an elite multi-strategy sniper analyst optimised for South African retail brokers (JustMarkets, Exness, HFM, FBS). Low drawdown, high R:R, big-profit setups only. NEVER blow the account.

PRIMARY FOCUS ASSETS: ${FOCUS_ASSETS.join(", ")}.
${focused ? "This symbol IS a focus asset — apply maximum sniper filtering." : "This is a secondary symbol — only trade if setup is textbook."}

CONTEXT:
- Symbol: ${b.symbol || "XAUUSD"}
- Strategy fusion: ${b.strategy || "all"} (fuse SMC + ICT + CRT + Wyckoff + Price Action + Math)
- Vault strategies: ${(b.vaultStrategies || []).join(", ") || "(none)"}
- Trade style: ${b.tradeStyle || "day"}
- Session: ${b.session || "any"}
- Timeframe: ${b.timeframe || "auto"}
- Order type requested: ${b.orderType || "instant"} (instant | buy_limit | sell_limit | buy_stop | sell_stop)
- Trailing stop: ${b.trailStop ? "YES — include trailStart & trailStep" : "no"}
- User note: ${b.userPrompt || "(none)"}

${styleRules(b.tradeStyle)}

RULES:
1. Low drawdown mandate: SL distance must be smaller than TP1 distance (R:R >= 1.5).
2. HUNT BOTH: (a) DIRECT SNIPERS — continuation entries at unmitigated OB / breaker after BOS + displacement; (b) REVERSALS — entries at HTF POI right after a liquidity sweep + CHoCH on LTF. Never miss a clean reversal candle.
3. Classify the setup in "reason": start with "[REVERSAL]" or "[DIRECT SNIPER]" so the client knows the play type.
4. If no valid setup, return direction: "NEUTRAL" with reason — never force a trade.
5. Numbers must be realistic current-price-adjacent quotes.


Return STRICT JSON only, no prose, matching this schema:
{
  "direction": "BUY" | "SELL" | "NEUTRAL",
  "confidence": 0-100,
  "entry": number,
  "sl": number,
  "tp": number,
  "stopLoss": number,
  "takeProfit": [number, number, number],
  "orderType": "instant"|"buy_limit"|"sell_limit"|"buy_stop"|"sell_stop",
  "trailStart": number|null,
  "trailStep": number|null,
  "closeSignal": string|null,
  "riskReward": number,
  "timeframe": string,
  "symbol": string,
  "lotSize": number,
  "reason": string,
  "analysis": string,
  "reasoning": string,
  "volatility": "Low"|"Medium"|"High",
  "structure": string,
  "momentum": string,
  "sources": [
    { "name": "SMC", "signal": "BUY|SELL|NEUTRAL", "confidence": 0-100, "note": string },
    { "name": "ICT", "signal": "BUY|SELL|NEUTRAL", "confidence": 0-100, "note": string },
    { "name": "CRT", "signal": "BUY|SELL|NEUTRAL", "confidence": 0-100, "note": string },
    { "name": "Price Action", "signal": "BUY|SELL|NEUTRAL", "confidence": 0-100, "note": string },
    { "name": "Mathematical", "signal": "BUY|SELL|NEUTRAL", "confidence": 0-100, "note": string }
  ],
  "keyLevels": { "support": [number], "resistance": [number] },
  "invalidations": [string],
  "voiceSummary": string,
  "annotations": {
    "trendLine": { "x1": 0-1, "y1": 0-1, "x2": 0-1, "y2": 0-1, "label": string } | null,
    "fvgs": [ { "x": 0-1, "y": 0-1, "w": 0-1, "h": 0-1, "type": "bullish"|"bearish", "label": string } ],
    "orderBlocks": [ { "x": 0-1, "y": 0-1, "w": 0-1, "h": 0-1, "type": "bullish"|"bearish", "label": string } ],
    "liquidityZones": [ { "y": 0-1, "label": string, "side": "buy"|"sell" } ],
    "entryLine": 0-1,
    "slLine": 0-1,
    "tpLines": [0-1, 0-1, 0-1]
  }
}
ANNOTATIONS: All coords are NORMALIZED 0..1 relative to the uploaded chart image (x from left, y from top). If no chart image was uploaded, still return best-effort normalized positions using recent price structure so the client can overlay a schematic. Keep 0-4 FVGs, 0-3 order blocks, 0-3 liquidity zones. "voiceSummary" is ONE crisp spoken sentence (<= 220 chars) that names the direction, entry, SL and TP naturally (e.g. say "gold" for XAUUSD) — this is read aloud by a voice assistant.
"tp" MUST equal takeProfit[0]. "sl" MUST equal stopLoss. For swing mode set tp=null and takeProfit=[]. Only emit JSON.`;
}

async function callGateway(body: AnalyzeBody) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI gateway not configured");

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: buildPrompt(body) },
  ];
  if (body.imageBase64) {
    const url = body.imageBase64.startsWith("data:")
      ? body.imageBase64
      : `data:image/png;base64,${body.imageBase64}`;
    content.push({ type: "image_url", image_url: { url } });
  }

  let lastErr = "";
  for (const model of MODELS) {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are TradeNest EA, an elite sniper trading RAG analyst. Return strict JSON only." },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      lastErr = `Gateway ${resp.status}: ${t.slice(0, 200)}`;
      // Retry next model on rate-limit / model errors; abort on auth issues.
      if (resp.status === 401 || resp.status === 403) throw new Error(lastErr);
      continue;
    }

    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }
    if (!parsed || Object.keys(parsed).length === 0) {
      lastErr = "Empty model output";
      continue;
    }
    // Normalise: mirror stopLoss/takeProfit into sl/tp so the UI (which reads .tp and .sl) works
    const p = parsed as any;
    const tps = Array.isArray(p.takeProfit) ? p.takeProfit : [];
    if (p.sl == null && p.stopLoss != null) p.sl = p.stopLoss;
    if (p.tp == null && tps.length) p.tp = tps[0];
    if (p.stopLoss == null && p.sl != null) p.stopLoss = p.sl;

    // Enforce SL/TP for non-swing setups — fabricate sane defaults from entry if the model omitted them.
    const style = String(body.tradeStyle || "day").toLowerCase();
    const dir = String(p.direction || "").toUpperCase();
    const entry = parseFloat(p.entry) || 0;
    if (style !== "swing" && entry > 0 && (dir === "BUY" || dir === "SELL")) {
      const pct = style === "scalp" ? 0.0025 : 0.006; // 0.25% scalp, 0.6% day
      if (!p.sl || parseFloat(p.sl) <= 0) {
        p.sl = dir === "BUY" ? entry * (1 - pct) : entry * (1 + pct);
        p.stopLoss = p.sl;
      }
      if (!p.tp || parseFloat(p.tp) <= 0) {
        p.tp = dir === "BUY" ? entry * (1 + pct * 2) : entry * (1 - pct * 2);
      }
      if (!Array.isArray(p.takeProfit) || p.takeProfit.length === 0) {
        p.takeProfit = dir === "BUY"
          ? [entry * (1 + pct * 2), entry * (1 + pct * 3), entry * (1 + pct * 4)]
          : [entry * (1 - pct * 2), entry * (1 - pct * 3), entry * (1 - pct * 4)];
      }
    }
    if (!p.lotSize) p.lotSize = 0.01;
    if (!p.orderType) p.orderType = body.orderType || "instant";
    return parsed;
  }
  throw new Error(lastErr || "All models failed");
}


const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-api-key, authorization",
};

export const Route = createFileRoute("/api/public/analyze-chart")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const required = process.env["SCANNER_API_KEY"];
          if (required) {
            const auth = request.headers.get("authorization") || "";
            const provided =
              request.headers.get("x-api-key") ||
              (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "");
            if (provided !== required) {
              return new Response(JSON.stringify({ error: "Invalid API key" }), {
                status: 401,
                headers: { "content-type": "application/json", ...CORS },
              });
            }
          }
          const body = (await request.json()) as AnalyzeBody;
          const result = await callGateway(body);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "content-type": "application/json", ...CORS },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ error: msg, fallback: true }), {
            status: 200,
            headers: { "content-type": "application/json", ...CORS },
          });
        }
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
    },
  },
});
