import { test, expect } from "bun:test";
import { symbolCurrencies, signalKey, robotStartSchema } from "./robot";
test("gold and indices follow USD news", () => { expect(symbolCurrencies("XAUUSD.m")).toContain("USD"); expect(symbolCurrencies("US30")).toEqual(["USD"]); });
test("EURJPY reacts to both currencies", () => { expect(symbolCurrencies("EURJPY").sort()).toEqual(["EUR","JPY"]); });
test("same symbol in same 15-minute window trades once", () => { expect(signalKey("XAUUSD", 900000)).toBe(signalKey("XAUUSD", 1799999)); expect(signalKey("XAUUSD", 1800000)).not.toBe(signalKey("XAUUSD", 900000)); });
test("client trade count capped at 50 and at least 1", () => {
  expect(robotStartSchema.safeParse({ symbols:[{symbol:"XAUUSD",lot:0.01,trades:51}], news:true }).success).toBe(false);
  expect(robotStartSchema.safeParse({ symbols:[{symbol:"XAUUSD",lot:0.01,trades:10}], news:true }).success).toBe(true);
});
import { shouldCloseSwing } from "./robot";
test("swing BUY closes only on confident SELL read", () => {
  expect(shouldCloseSwing("BUY","SELL",80)).toBe(true);
  expect(shouldCloseSwing("BUY","SELL",60)).toBe(false);
  expect(shouldCloseSwing("BUY","BUY",90)).toBe(false);
  expect(shouldCloseSwing("BUY","NEUTRAL",90)).toBe(false);
});
test("style defaults to day", () => { expect(robotStartSchema.parse({symbols:[{symbol:"US30",lot:0.1,trades:2}],news:true}).symbols[0].style).toBe("day"); });
