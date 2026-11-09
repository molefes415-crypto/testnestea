import { test, expect } from "bun:test";
import { automationSchema, executionTime, validNewsSignal, confirmedOrder } from "./news-automation";
test("execution uses exactly the selected seconds before release",()=>{
  expect(executionTime("2026-11-10T12:30:00Z",30,Date.parse("2026-11-10T12:00Z"))).toBe("2026-11-10T12:29:30.000Z");
  expect(executionTime("2026-11-10T12:30:00Z",900,Date.parse("2026-11-10T12:00Z"))).toBe("2026-11-10T12:15:00.000Z");
});
test("passed execution moments cannot be armed",()=>{
  expect(()=>executionTime("2026-11-10T12:30:00Z",60,Date.parse("2026-11-10T12:29:00Z"))).toThrow();
});
test("preserves exact symbol, lot and selected trade count",()=>{
  const input={eventId:"nfp",symbols:["XAUUSD.m"],lot:0.01,trades:10,leadSeconds:60};
  expect(automationSchema.parse(input)).toEqual(input);
  expect(automationSchema.safeParse({...input,leadSeconds:901}).success).toBe(false);
});
test("AI orders require exact symbol, confidence and unchanged valid stops",()=>{
  const signal={symbol:"XAUUSD.m",direction:"BUY",sl:99,tp:103,confidence:50};
  expect(validNewsSignal(signal,"XAUUSD.m",100,101)).toEqual(signal);
  expect(validNewsSignal(signal,"XAUUSD",100,101)).toBeNull();
  expect(validNewsSignal({...signal,sl:100.5},"XAUUSD.m",100,101)).toBeNull();
  expect(validNewsSignal({...signal,confidence:49},"XAUUSD.m",100,101)).toBeNull();
  expect(validNewsSignal(signal,"XAUUSD.m",NaN,101)).toBeNull();
});
test("never claims an ambiguous gateway order succeeded",()=>{
  expect(confirmedOrder({})).toBe(false);
  expect(confirmedOrder({retcode:10016})).toBe(false);
  expect(confirmedOrder({retcode:10009,order:1234})).toBe(true);
});