import { describe, expect, test } from "bun:test";
import { exactBrokerSymbol, preserveOrderStops, readExistingMT5Identity } from "./mt5-contract";
import { createMT5Service } from "./mt5-service";

describe("MT5 gateway safety", () => {
  test("uses the existing app email and mentor ID without introducing a login", () => {
    expect(readExistingMT5Identity(JSON.stringify({ email: " CLIENT@example.test ", name: "7" }))).toEqual({ email: "client@example.test", admin_id: "7" });
    expect(readExistingMT5Identity(JSON.stringify({ email: "client@example.test", adminId: "9" }))).toEqual({ email: "client@example.test", admin_id: "9" });
    expect(readExistingMT5Identity(null)).toBe(null);
    expect(readExistingMT5Identity("invalid")).toBe(null);
  });
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
    let received = [];
    const service = createMT5Service(async (...args) => { received = args; return { connected: false, code: "BLOCKED", endpoint: "session.php", message: "blocked" }; });
    await service.connect({ server: "AnyBroker-Live", accountNumber: "123456", password: "test-only" });
    expect(received).toEqual([]);
  });
});