import { test, expect } from "bun:test";
import { validateLiveMarket, hasLivePriceHistory, guardLiveAnalysis } from "./mt5-live-analysis";
import "../../public/mt5-live-scanner.js";

const now = 1800000000000;
test("scanner retries a temporary read failure using the same session and fresh quote", async () => {
  let calls = 0;
  const scanner = globalThis.TNLiveScanner.createLiveScanner({ getToken: () => "fixture-token", request: async (url, init) => {
    expect(init.headers['X-MT5-Token']).toBe("fixture-token");
    calls++;
    if (calls === 1) return Response.json({ detail: "Unavailable" }, { status: 503 });
    return Response.json(url.includes("p=account") ? { login: 20021234, server: "JustMarkets-Demo", balance: 200 } : { symbol: "XAUUSD.m", bid: 2500, ask: 2501 });
  } });
  expect((await scanner.snapshot("XAUUSD.m")).ask).toBe(2501);
  expect(calls).toBe(3);
});
test("scanner does not retry an expired token", async () => {
  let calls = 0;
  const scanner = globalThis.TNLiveScanner.createLiveScanner({ getToken: () => "fixture-token", request: async () => { calls++; return Response.json({ detail: "Invalid token" }, { status: 401 }); } });
  await expect(scanner.snapshot("XAUUSD.m")).rejects.toThrow("Invalid token");
  expect(calls).toBe(1);
});
const quote = { source: "mt5_gateway", symbol: "XAUUSD.m", server: "Broker-Live", bid: 2500, ask: 2501, spread: 1, observedAt: now, samples: [{ bid: 2500, ask: 2501, observedAt: now }] };
test("AI live input requires the exact broker symbol, without suffix substitution", () => {
  expect(() => validateLiveMarket(quote, "XAUUSD", now)).toThrow();
  expect(validateLiveMarket(quote, "XAUUSD.m", now).symbol).toBe("XAUUSD.m");
});
test("stale broker quotes cannot enter a live scan", () => {
  expect(() => validateLiveMarket(quote, "XAUUSD.m", now + 30001)).toThrow();
});
test("a single bid/ask snapshot is not enough to generate an automatic signal", () => {
  expect(hasLivePriceHistory(validateLiveMarket(quote, quote.symbol, now))).toBe(false);
});
test("live AI rejection keeps stops unchanged and prevents execution", () => {
  const result = guardLiveAnalysis({ direction: "BUY", symbol: "XAUUSD.m", entry: 2501, sl: 2600, tp: 2700 }, validateLiveMarket(quote, quote.symbol, now));
  expect(result.direction).toBe("NEUTRAL");
  expect(result.sl).toBe(2600);
});
test("account switch discards an in-flight broker quote", async () => {
  let token = "personal-a";
  const api = globalThis.TNLiveScanner;
  const scanner = api.createLiveScanner({ getToken: () => token, request: async () => { token = "personal-b"; return Response.json({ login: 123, server: "Broker-Live" }); } });
  await expect(scanner.snapshot("XAUUSD.m")).rejects.toThrow("account changed");
});
test("verified account read without an optional connected flag can start quote sampling", async () => {
  const scanner = globalThis.TNLiveScanner.createLiveScanner({ getToken: () => "fixture-token", request: async url => Response.json(url.includes("p=account") ? { login: 20021234, server: "JustMarkets-Demo", balance: 200 } : { symbol: "XAUUSD.m", bid: 2500, ask: 2501 }) });
  expect((await scanner.snapshot("XAUUSD.m")).bid).toBe(2500);
});
test("explicitly disconnected accounts cannot start quote sampling", async () => {
  let calls = 0;
  const scanner = globalThis.TNLiveScanner.createLiveScanner({ getToken: () => "fixture-token", request: async () => { calls++; return Response.json({ login: 20021234, server: "JustMarkets-Demo", balance: 200, connected: false }); } });
  await expect(scanner.snapshot("XAUUSD.m")).rejects.toThrow("could not be verified");
  expect(calls).toBe(1);
});