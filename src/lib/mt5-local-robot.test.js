import { test, expect } from 'bun:test';
import { EMA, RSI } from 'technicalindicators';
import '../../public/mt5-local-robot.js';
const engine = globalThis.TNLocalRobot;
const indicators = { ema: EMA.calculate, rsi: RSI.calculate };
test('trade comments contain the bot name followed by -auto', () => {
  expect(engine.tradeComment('mobi ea')).toBe('mobi ea-auto');
  expect(engine.tradeComment('MASTER')).toBe('MASTER-auto');
  expect(engine.tradeComment(undefined)).toBe('BOT-auto');
});
function market() {
  const now = Date.now();
  const samples = Array.from({length:60},(_,i)=>{const bid=100+i*0.004+(i%3===0?-0.01:0);return {bid,ask:bid+0.001,observedAt:now-(59-i)*5000};});
  return {symbol:'XAUUSD.m',...samples.at(-1),digits:5,samples};
}
test('local scanner requires at least three minutes of real price history',()=>{
  const m=market();m.samples=m.samples.slice(-20);
  expect(engine.analyse(m,'day',indicators).direction).toBe('NEUTRAL');
});
test('stale live quote never generates a local trade',()=>{
  const m=market();m.observedAt-=31000;
  expect(engine.analyse(m,'day',indicators).direction).toBe('NEUTRAL');
});
test('broker rejection or empty response never counts as placed',()=>{
  expect(engine.confirmed({retcode:10016,ticket:123})).toBe(false);
  expect(engine.confirmed({})).toBe(false);
  expect(engine.confirmed({retcode:10009,ticket:123})).toBe(true);
});
test('local breakout keeps exact symbol and day stops',()=>{
  const m=market();
  const fixed={ema:({period})=>period===9?[99,101]:[99,100],rsi:()=>[60]};
  const result=engine.analyse(m,'day',fixed);
  expect(result.symbol).toBe('XAUUSD.m');
  expect(result.direction).toBe('BUY');
  expect(result.sl).toBeLessThan(m.bid);
  expect(result.tp).toBeGreaterThan(m.ask);
  expect(engine.analyse(m,'swing',fixed).sl).toBe(null);
});test('broker tick history fills readiness instantly and keeps the exact symbol', () => {
  const now = Date.now(); const last = 1_700_000_600_000;
  const ticks = Array.from({length: 600}, (_, i) => [last - (599 - i) * 1000, 100 + i * 0.001, 100.001 + i * 0.001]);
  const seed = engine.seedFromTicks({symbol:'XAUUSD.m', last_msc:last, ticks}, 'XAUUSD.m', now);
  expect(seed.length).toBeGreaterThanOrEqual(40);
  expect(now - seed[0].observedAt).toBeGreaterThanOrEqual(180000);
  expect(engine.seedFromTicks({symbol:'XAUUSD', last_msc:last, ticks}, 'XAUUSD.m', now)).toEqual([]);
});
test('a single opposite reading never closes a position', () => {
  let t = 0; const g = engine.createReversalGuard({now: () => t});
  const p = {symbol:'XAUUSD.m', ticket: 1, profit: -2};
  g.observe('XAUUSD.m','SELL'); expect(g.canClose(p,'BUY','SELL')).toBe(false);
});
test('reversal closes only after 3 confirmations and 5 minutes held', () => {
  let t = 0; const g = engine.createReversalGuard({now: () => t});
  const p = {symbol:'XAUUSD.m', ticket: 1, profit: -2};
  g.canClose(p,'BUY','NEUTRAL');
  for (let i = 0; i < 3; i++) g.observe('XAUUSD.m','SELL');
  t = 299000; expect(g.canClose(p,'BUY','SELL')).toBe(false);
  t = 300000; expect(g.canClose(p,'BUY','SELL')).toBe(true);
});
test('profitable position is never closed on a reversal', () => {
  let t = 0; const g = engine.createReversalGuard({now: () => t});
  const p = {symbol:'XAUUSD.m', ticket: 1, profit: 5};
  g.canClose(p,'BUY','NEUTRAL'); for (let i = 0; i < 5; i++) g.observe('XAUUSD.m','SELL');
  t = 999999; expect(g.canClose(p,'BUY','SELL')).toBe(false);
});
test('entry needs the same direction twice in a row', () => {
  const g = engine.createReversalGuard();
  g.observe('US30','BUY'); expect(g.canEnter('US30','BUY')).toBe(false);
  g.observe('US30','BUY'); expect(g.canEnter('US30','BUY')).toBe(true);
  g.observe('US30','NEUTRAL'); expect(g.canEnter('US30','BUY')).toBe(false);
});
test('robot recognises its own -auto trade comments', () => {
  expect(engine.ownsPosition('mobi ea-auto','mobi ea')).toBe(true);
  expect(engine.ownsPosition('other-auto','mobi ea')).toBe(false);
});
