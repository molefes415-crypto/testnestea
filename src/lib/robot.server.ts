import { owner, jobsDB, verifyAutomationOwner } from './news-automation.server';

export async function robotStatus(token: string) {
  const { key } = await verifyAutomationOwner(token); const db = await jobsDB();
  const { data } = await db.from('auto_robots').select('id,running,symbols,news_enabled,last_run_at,detail').eq('owner_key', key).maybeSingle();
  const trades = data ? (await db.from('auto_robot_trades').select('symbol,direction,status,created_at').eq('robot_id', data.id).order('created_at', { ascending: false }).limit(10)).data : [];
  return { robot: data, trades: trades ?? [] };
}
export async function stopRobot(token: string) {
  const db = await jobsDB();
  await db.from('auto_robots').update({ running: false, token_cipher: null, detail: 'Stopped by account owner.', updated_at: new Date().toISOString() }).eq('owner_key', owner(token));
  return { running: false };
}

// Legacy queued jobs must not scan or trade after migration to in-app automation.
export async function runningRobotIds() { return []; }
export async function armRobotNews(_id: string) { return { armed: 0 }; }
export async function sampleRobot(_id: string) { return null; }
export async function analyseAndTrade(_id: string, _samples: unknown) { return { stopped: true }; }
