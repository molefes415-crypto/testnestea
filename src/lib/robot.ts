import { z } from "zod";
export const robotSymbolSchema = z.object({ symbol: z.string().regex(/^[A-Za-z0-9._+#-]{1,24}$/), lot: z.number().positive().max(100), trades: z.number().int().min(1).max(50), style: z.enum(['scalp','day','swing']).default('day') });
export const robotStartSchema = z.object({ symbols: z.array(robotSymbolSchema).min(1).max(8), news: z.boolean(), botName: z.string().trim().min(1).max(40).optional() }).strict();
export type RobotSymbol = z.infer<typeof robotSymbolSchema>;
/** News currencies a broker symbol reacts to; indices/metals/crypto follow USD. */
export function symbolCurrencies(symbol: string) {
  const s = symbol.toUpperCase(); const out = new Set<string>();
  for (const c of ["USD","EUR","GBP","JPY","AUD","NZD","CAD","CHF"]) if (s.includes(c)) out.add(c);
  if (/XAU|XAG|GOLD|US30|NAS|SPX|US500|US100|DJ|BTC|ETH|OIL|WTI/.test(s)) out.add("USD");
  if (/GER|DE40|DAX/.test(s)) out.add("EUR"); if (/UK100|FTSE/.test(s)) out.add("GBP"); if (/JP225|NIK/.test(s)) out.add("JPY");
  return [...out];
}
/** One trade batch per symbol per 15-minute window prevents duplicate entries when ticks overlap. */
export function signalKey(symbol: string, now: number) { return `${symbol}:${Math.floor(now / 900000)}`; }
/** Swing closes only on a confident opposite AI read; scalp/day exits are handled by their SL/TP. */
export function shouldCloseSwing(positionSide: 'BUY' | 'SELL', aiDirection: string, confidence: number) {
  const d = aiDirection.toUpperCase();
  return confidence >= 72 && (d === 'BUY' || d === 'SELL') && d !== positionSide;
}
