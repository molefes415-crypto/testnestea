import { z } from 'zod';
import { automationSchema, type AutomationInput } from './news-automation';

type Services = {
  listAutomation: (token: string) => Promise<unknown>;
  scheduleAutomation: (token: string, input: AutomationInput) => Promise<unknown>;
  cancelAutomation: (token: string, id: string) => Promise<unknown>;
};
const payload = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }).strict(),
  z.object({ action: z.literal('arm'), input: automationSchema }).strict(),
  z.object({ action: z.literal('cancel'), id: z.string().uuid() }).strict(),
]);
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
// Each delegated operation verifies the bearer personal MT5 token before reading or writing schedules.
export async function handleNewsAutomation(request: Request, load: () => Promise<Services>) {
  const token = request.headers.get('x-mt5-token')?.trim();
  if (!token || token.length > 4096) return reply({ success: false, error: 'A personal MT5 token is required.' }, 401);
  if (Number(request.headers.get('content-length') || 0) > 16384) return reply({ success: false, error: 'Request too large.' }, 413);
  let raw: unknown;
  try { const text = await request.text(); if (text.length > 16384) return reply({ success: false, error: 'Request too large.' }, 413); raw = JSON.parse(text); }
  catch { return reply({ success: false, error: 'Invalid JSON.' }, 400); }
  const parsed = payload.safeParse(raw);
  if (!parsed.success) return reply({ success: false, error: 'Invalid automation settings.' }, 400);
  try {
    const services = await load();
    const input = parsed.data;
    const data = input.action === 'list' ? await services.listAutomation(token) : input.action === 'arm'
      ? await services.scheduleAutomation(token, input.input) : await services.cancelAutomation(token, input.id);
    return reply({ success: true, data });
  } catch {
    // Do not echo upstream bodies or exception messages, which can contain credentials.
    return reply({ success: false, error: 'Account verification or scheduling failed. Refresh schedules before retrying; an unconfirmed schedule must not be submitted again blindly.' }, 502);
  }
}