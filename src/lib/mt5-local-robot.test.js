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
});