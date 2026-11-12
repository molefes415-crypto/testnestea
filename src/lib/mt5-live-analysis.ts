import { z } from "zod";

const sample = z.object({ bid: z.number().positive().finite(), ask: z.number().positive().finite(), observedAt: z.number().int().positive() });
export const liveMarketSchema = sample.extend({
  source: z.literal("mt5_gateway"), symbol: z.string().min(1).max(24), server: z.string().min(1).max(150),
  spread: z.number().nonnegative().finite(), digits: z.number().int().min(0).max(12).optional(),
  samples: z.array(sample).min(1).max(120),
});
export type LiveMarket = z.infer<typeof liveMarketSchema>;

export function validateLiveMarket(input: unknown, symbol: string, now = Date.now()): LiveMarket {
  const market = liveMarketSchema.parse(input);
  if (market.symbol !== symbol) throw new Error("Live quote symbol does not match the requested exact broker symbol.");
  if (market.ask < market.bid || market.samples.some(p => p.ask < p.bid)) throw new Error("Invalid broker bid/ask spread.");
  if (now - market.observedAt > 30000 || market.observedAt > now + 5000) throw new Error("Live broker quote is stale. Refresh prices before scanning.");
  if (market.samples.some((p, i) => p.observedAt > market.observedAt || market.observedAt - p.observedAt > 600000 || (i > 0 && p.observedAt < market.samples[i - 1].observedAt))) throw new Error("Invalid quote sample timeline.");
  return market;
}

export function hasLivePriceHistory(market: LiveMarket): boolean {
  const first = market.samples[0];
  const last = market.samples.at(-1);
  return market.samples.length >= 20 && Boolean(first && last && last.observedAt - first.observedAt >= 60000);
}

export function guardLiveAnalysis(result: Record<string, unknown>, market: LiveMarket, swing = false) {
  // Swing mode is explicitly stop-free; only direction and symbol must match the live quote.
  if (swing) { const d = String(result.direction).toUpperCase(); return (d === 'BUY' || d === 'SELL') && result.symbol !== market.symbol ? { ...result, direction: 'NEUTRAL', confidence: 0 } : result; }
  const direction = String(result.direction).toUpperCase();
  const sl = Number(result.sl ?? result.stopLoss);
  const tp = Number(result.tp ?? (Array.isArray(result.takeProfit) ? result.takeProfit[0] : undefined));
  const entry = Number(result.entry);
  const valid = result.symbol === market.symbol && Number.isFinite(entry) && entry > 0 &&
    Number.isFinite(sl) && sl > 0 && Number.isFinite(tp) && tp > 0 &&
    (direction === "BUY" ? sl < market.bid && tp > market.ask : direction === "SELL" ? sl > market.ask && tp < market.bid : false);
  if ((direction === "BUY" || direction === "SELL") && !valid) {
    return { ...result, direction: "NEUTRAL", confidence: 0, accurate: false, reason: "AI setup did not match the exact broker symbol or valid SL/TP relative to the live quote." };
  }
  return result;
}