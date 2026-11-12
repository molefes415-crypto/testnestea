import { createMT5Service } from './mt5-service';
import { owner, encrypt, decrypt, jobsDB, verifyAutomationOwner, scheduleAutomation } from './news-automation.server';
import { getNewsEvents } from './news.server';
import { robotStartSchema, symbolCurrencies, signalKey, type RobotSymbol } from './robot';
import { confirmedOrder } from './news-automation';

export async function robotStatus(token: string) {
  const { key } = await verifyAutomationOwner(token); const db = await jobsDB();
  const { data } = await db.from('auto_robots').select('id,running,symbols,news_enabled,last_run_at,detail').eq('owner_key', key).maybeSingle();
  const trades = data ? (await db.from('auto_robot_trades').select('symbol,direction,status,created_at').eq('robot_id', data.id).order('created_at', { ascending: false }).limit(10)).data : [];
  return { robot: data, trades: trades ?? [] };
}
export async function startRobot(token: string, raw: unknown) {
  const input = robotStartSchema.parse(raw); const { account, key } = await verifyAutomationOwner(token);
  const service = createMT5Service();
  for (const s of input.symbols) { const q = await service.quote(token, s.symbol); if (q.symbol !== s.symbol) throw new Error(`Symbol ${s.symbol} does not exist exactly on your broker.`); }
  const db = await jobsDB();
  const { error } = await db.from('auto_robots').upsert({ owner_key: key, token_cipher: encrypt(token), account_login: account.login, account_server: account.server, bot_name: input.botName ?? 'TRADE NEST EA', symbols: input.symbols, news_enabled: input.news, running: true, detail: 'Robot started. First scan within 5 minutes.', updated_at: new Date().toISOString() }, { onConflict: 'owner_key' });
  if (error) throw new Error('Robot could not be saved.');
  return { running: true };
}
export async function stopRobot(token: string) {
  const db = await jobsDB();
  await db.from('auto_robots').update({ running: false, token_cipher: null, detail: 'Stopped by account owner.', updated_at: new Date().toISOString() }).eq('owner_key', owner(token));
  return { running: false };
}
export async function runningRobotIds() {
  const db = await jobsDB(); const { data } = await db.from('auto_robots').select('id').eq('running', true).not('token_cipher', 'is', null);
  return (data ?? []).map(r => r.id as string);
}
async function load(id: string) {
  const db = await jobsDB(); const { data } = await db.from('auto_robots').select('*').eq('id', id).eq('running', true).maybeSingle();
  if (!data?.token_cipher) return null;
  const token = decrypt(data.token_cipher); const info = await createMT5Service().account(token);
  if (info.connected !== true || info.login !== Number(data.account_login) || info.server !== data.account_server) {
    await db.from('auto_robots').update({ running: false, token_cipher: null, detail: 'Stopped: MT5 account changed or disconnected. Reconnect and start again.' }).eq('id', id);
    return null;
  }
  return { db, row: data, token, symbols: data.symbols as RobotSymbol[] };
}
/** Arm every upcoming high-impact event for the robot's symbols (existing news workflow trades it with SL/TP). */
export async function armRobotNews(id: string) {
  const ctx = await load(id); if (!ctx || !ctx.row.news_enabled) return { armed: 0 };
  const now = Date.now(); let armed = 0;
  const events = (await getNewsEvents()).filter(e => /high/i.test(e.impact) && e.currency && Date.parse(e.time_utc) - now > 180000 && Date.parse(e.time_utc) - now < 1800000);
  for (const e of events) {
    const matches = ctx.symbols.filter(s => symbolCurrencies(s.symbol).includes(String(e.currency).toUpperCase()));
    if (!matches.length) continue;
    try { await scheduleAutomation(ctx.token, { eventId: e.id, symbols: matches.map(m => m.symbol), lot: matches[0].lot, trades: matches[0].trades, leadSeconds: 60 }); armed++; } catch { /* duplicate or unavailable: never retry */ }
  }
  return { armed };
}
export async function sampleRobot(id: string) {
  const ctx = await load(id); if (!ctx) return null; const service = createMT5Service(); const out: Record<string, { bid: number; ask: number; observedAt: number; digits?: number }> = {};
  for (const s of ctx.symbols) { try { const q = await service.quote(ctx.token, s.symbol); if (q.symbol === s.symbol && q.ask >= q.bid && q.bid > 0) out[s.symbol] = { bid: Number(q.bid), ask: Number(q.ask), observedAt: Date.now(), digits: q.digits }; } catch { /* skip sample */ } }
  return out;
}
export async function analyseAndTrade(id: string, samples: Record<string, { bid: number; ask: number; observedAt: number; digits?: number }>[]) {
  const ctx = await load(id); if (!ctx) return { stopped: true };
  const service = createMT5Service(); const results: string[] = [];
  const positions = await service.positions(ctx.token).catch(() => null);
  const open = new Set((Array.isArray(positions) ? positions : positions?.positions ?? []).map((p: { symbol?: string }) => p.symbol));
  const base = process.env['PUBLIC_APP_URL'] || 'https://tradnestea.app';
  for (const s of ctx.symbols) {
    if (open.has(s.symbol)) { results.push(`${s.symbol}: position open, skipped`); continue; }
    const series = samples.map(x => x[s.symbol]).filter(Boolean);
    const live = await service.quote(ctx.token, s.symbol).catch(() => null);
    if (!live || live.symbol !== s.symbol || series.length < 20) { results.push(`${s.symbol}: not enough prices`); continue; }
    const now = Date.now();
    const liveMarket = { source: 'mt5_gateway', symbol: s.symbol, server: ctx.row.account_server, bid: Number(live.bid), ask: Number(live.ask), spread: Number(live.ask) - Number(live.bid), digits: live.digits, observedAt: now, samples: series.map(p => ({ bid: p.bid, ask: p.ask, observedAt: p.observedAt })) };
    const r = await fetch(`${base}/api/public/analyze-chart`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env['SCANNER_API_KEY'] ?? '' }, body: JSON.stringify({ symbol: s.symbol, liveMarket, strategy: 'master', tradeStyle: 'day', orderType: 'instant', dataSource: 'broker_quotes', confidenceThreshold: 72 }) });
    const data = await r.json().catch(() => ({}));
    const dir = String(data.direction ?? '').toUpperCase(); const sl = Number(data.sl ?? data.stopLoss); const tp = Number(data.tp ?? (Array.isArray(data.takeProfit) ? data.takeProfit[0] : NaN));
    if (!r.ok || data.symbol !== s.symbol || (dir !== 'BUY' && dir !== 'SELL') || Number(data.confidence) < 72 || !(sl > 0) || !(tp > 0)) { results.push(`${s.symbol}: no accurate setup`); continue; }
    const k = signalKey(s.symbol, now);
    const { error } = await ctx.db.from('auto_robot_trades').insert({ robot_id: id, signal_key: k, symbol: s.symbol, direction: dir });
    if (error) continue; // already traded this window
    let sent = 0, lastError = '';
    for (let i = 0; i < s.trades; i++) {
      try { const res = await service.trade(ctx.token, { symbol: s.symbol, side: dir === 'BUY' ? 'buy' : 'sell', volume: s.lot, sl, tp, comment: String(ctx.row.bot_name).slice(0, 28) }); if (confirmedOrder(res)) sent++; else { lastError = 'Broker rejected order'; break; } }
      catch (e) { lastError = e instanceof Error ? e.message : 'Order failed'; break; } // ambiguous: never retry
    }
    await ctx.db.from('auto_robot_trades').update({ status: sent === s.trades ? 'sent' : sent ? 'partial' : 'failed', detail: { sent, confidence: data.confidence, sl, tp, error: lastError || null } }).eq('robot_id', id).eq('signal_key', k);
    results.push(`${s.symbol}: ${dir} ${sent}/${s.trades} sent${lastError ? ` (${lastError})` : ''}`);
  }
  await ctx.db.from('auto_robots').update({ last_run_at: new Date().toISOString(), detail: results.join(' · ').slice(0, 900) }).eq('id', id);
  return { results };
}
