import { describe, expect, test } from "bun:test";
import { exactBrokerSymbol, preserveOrderStops } from "./mt5-contract";
import { createMT5Service } from "./mt5-service";

describe("MT5 gateway safety", () => {
  test("XAUUSD is not automatically replaced with XAUUSD.m", () => {
    expect(() => exactBrokerSymbol("XAUUSD", ["XAUUSD.m"])).toThrow();
    expect(exactBrokerSymbol(".US30.", [".US30."])).toBe(".US30.");
    expect(() => exactBrokerSymbol("xauusd", ["XAUUSD"])).toThrow();
  });
  test("stop loss and take profit remain exactly unchanged", () => {
    expect(preserveOrderStops({ stopLoss: 2310.5, takeProfit: 2390.75 })).toEqual({ stopLoss: 2310.5, takeProfit: 2390.75 });
  });
  test("an unsupported session cannot be reported as connected", async () => {
    const service = createMT5Service(async () => ({ connected: false, code: "BLOCKED", endpoint: "session.php", message: "email and admin_id required" }));
    expect((await service.connect({ server: "OtherBroker-Live", accountNumber: "123456", password: "test-only" })).connected).toBe(false);
    await expect(service.account()).rejects.toThrow("session.php");
    await expect(service.symbols()).rejects.toThrow("session.php");
    await expect(service.trade()).rejects.toThrow("no verified client-bound session");
  });
  test("inspection receives no password or client-selected session handle", async () => {
    let received: unknown[] = [];
    const service = createMT5Service(async (...args: unknown[]) => { received = args; return { connected: false, code: "BLOCKED", endpoint: "session.php", message: "blocked" }; });
    await service.connect({ server: "AnyBroker-Live", accountNumber: "123456", password: "test-only" });
    expect(received).toEqual([]);
  });
});