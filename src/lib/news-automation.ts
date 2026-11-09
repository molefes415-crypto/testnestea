import { z } from "zod";
export const automationSchema = z.object({
  eventId: z.string().min(1).max(240),
  symbols: z.array(z.string().regex(/^[A-Za-z0-9._+#-]{1,24}$/)).min(1).max(8),
  lot: z.number().positive().max(100),
  trades: z.number().int().min(1).max(100),
  leadSeconds: z.number().int().min(1).max(900),
}).strict();
export type AutomationInput = z.infer<typeof automationSchema>;
export type AutomationJob = { id: string; event_id: string; execute_at: string; symbols: string[]; lot: number; trades: number; status: string; detail: string | null };
export function executionTime(eventTime: string, seconds: number, now: number) {
  const time = Date.parse(eventTime) - seconds * 1000;
  if (!Number.isFinite(time) || time <= now) throw new Error("That execution moment has already passed.");
  return new Date(time).toISOString();
}
export function validNewsSignal(data: unknown, symbol: string, bid: number, ask: number) {
  const signal = z.object({ symbol:z.literal(symbol), direction:z.enum(["BUY","SELL"]), sl:z.number().positive(), tp:z.number().positive(), confidence:z.number().min(50).max(100) }).safeParse(data);
  if (!signal.success || bid <= 0 || ask < bid) return null;
  const s = signal.data;
  if (s.direction === "BUY" ? s.sl >= bid || s.tp <= ask : s.sl <= ask || s.tp >= bid) return null;
  return s;
}