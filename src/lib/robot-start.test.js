import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../public/tradenest.html', import.meta.url), 'utf8');
const startBody = source.split('const handleStartTrading = async (ea) => {')[1].split('const handleFullStop')[0];
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

test('failed MT5 verification never enables the robot', async () => {
  let enabled = false;
  const start = new AsyncFunction('ea', 'robotSyncBusy', 'showDraggableIcon', 'botRunning', 'verifyRobotAccount', 'setBotRunning', 'toast', startBody.replace(/};\s*$/, ''));
  await start({}, { current: false }, false, false, async () => { throw new Error('Disconnected'); }, () => { enabled = true; }, () => {});
  expect(enabled).toBe(false);
});

test('verified MT5 starts locally without any cloud robot call', async () => {
  let enabled = false;
  const session = {current:''};
  const start = new AsyncFunction('ea','robotSyncBusy','showDraggableIcon','botRunning','verifyRobotAccount','botSessionRef','setBotRunning','setShowDraggableIcon','setShowBotPopup','toast','autoScanEnabled',startBody.replace(/};\s*$/, ''));
  await start({}, {current:false}, false, false, async () => 'fixture-token', session, v => {enabled=v;}, () => {}, () => {}, () => {}, true);
  expect(enabled).toBe(true);
  expect(session.current).toBe('fixture-token');
});