import { test, expect } from "bun:test";
import { startPositionStream, POSITION_REFRESH_MS } from "./mt5-position-stream";

test("floating profit polls every second without inventing values or overlapping reads", async () => {
  let resolve; let reads = 0; let next; const values=[];
  const stop = startPositionStream({read:()=>{reads++;return new Promise(r=>{resolve=r;});},apply:v=>values.push(v),failed:()=>{},active:()=>true,schedule:(fn,ms)=>{expect(ms).toBe(1000);next=fn;return 1;},cancel:()=>{}});
  expect(POSITION_REFRESH_MS).toBe(1000); expect(reads).toBe(1); expect(next).toBeUndefined();
  resolve({profit:5.67}); await Promise.resolve(); await Promise.resolve();
  expect(values).toEqual([{profit:5.67}]); next(); expect(reads).toBe(2); stop(); resolve({profit:9}); await Promise.resolve();
  expect(values).toHaveLength(1);
});
test("changed accounts discard delayed position results", async () => {
  let resolve; let active=true; const values=[];
  const stop=startPositionStream({read:()=>new Promise(r=>{resolve=r;}),apply:v=>values.push(v),failed:()=>{},active:()=>active,schedule:()=>1,cancel:()=>{}});
  active=false;resolve({profit:100});await Promise.resolve();await Promise.resolve();
  expect(values).toEqual([]);stop();
});