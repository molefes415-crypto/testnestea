import { test, expect } from "bun:test";
import { marketSessions } from "./market-sessions";
test("session flags follow their real local session times rather than fixed screenshot values",()=>{
  const sessions=marketSessions(Date.parse("2026-11-09T14:55:00Z"));
  expect(sessions.filter(s=>s.open).map(s=>s.name)).toEqual(["London","New York"]);
  expect(sessions.find(s=>s.name==="Sydney").country).toBe("au");
});
test("weekend sessions stay closed",()=>{
  expect(marketSessions(Date.parse("2026-11-08T12:00:00Z")).every(s=>!s.open)).toBe(true);
});