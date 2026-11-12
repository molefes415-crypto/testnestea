import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../public/tradenest.html', import.meta.url), 'utf8');
const syncBody = source.split('const syncCloudRobot = async (start, ea) => {')[1].split('const robotSyncBusy')[0];
const startBody = source.split('const handleStartTrading = async (ea) => {')[1].split('const handleFullStop')[0];
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

test('failed server sync never enables the robot or its execution countdown', async () => {
  let enabled = false;
  const start = new AsyncFunction('ea', 'robotSyncBusy', 'showDraggableIcon', 'tradeDelayTimer', 'syncCloudRobot', 'setBotRunning', 'speakText', startBody.replace(/};\s*$/, ''));
  await start({}, { current: false }, false, null, async () => false, () => { enabled = true; }, () => { throw new Error('Countdown must not start'); });
  expect(enabled).toBe(false);
});

test('successful HTTP response without running confirmation is rejected', async () => {
  const sync = new AsyncFunction('start', 'ea', 'localStorage', 'allowedSymbols', 'fetch', 'toast', syncBody.replace(/};\s*$/, ''));
  const result = await sync(true, {}, { getItem: () => 'fixture-token' }, { XAUUSD: { numTrades: 10 } }, async () => ({ ok: true, json: async () => ({ running: false }) }), () => {});
  expect(result).toBe(false);
});