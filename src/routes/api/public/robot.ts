import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
// Caller is authorised by their personal MT5 gateway token, verified against the gateway on every action.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-mt5-token', 'access-control-allow-methods': 'POST, OPTIONS' };
const body = z.object({ action: z.enum(['status', 'start', 'stop']), config: z.unknown().optional() });
export const Route = createFileRoute('/api/public/robot')({ server: { handlers: {
  OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
  POST: async ({ request }) => {
    try {
      const token = request.headers.get('x-mt5-token') ?? '';
      if (!token || token.length > 4096) return Response.json({ error: 'Connect your MT5 account first.' }, { status: 401, headers: CORS });
      const input = body.parse(await request.json());
      const m = await import('@/lib/robot.server');
      const result = input.action === 'start' ? await m.startRobot(token, input.config) : input.action === 'stop' ? await m.stopRobot(token) : await m.robotStatus(token);
      return Response.json(result, { headers: CORS });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : 'Robot request failed' }, { status: 400, headers: CORS });
    }
  },
} } });
