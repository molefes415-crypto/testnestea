import { describe, expect, test } from "bun:test";
import { exactBrokerSymbol, preserveOrderStops, readExistingMT5Identity } from "./mt5-contract";
import { createMT5Service, isMT5SessionExpired } from "./mt5-service";

describe("MT5 gateway safety", () => {
  test("news account reads recover once from a temporary transport failure", async () => {
    let calls = 0;
    const service = createMT5Service(async () => {
      calls++;
      if (calls === 1) throw new TypeError("Failed to fetch");
      return Response.json({ login: 123456, balance: 198.79, server: "JustMarkets-Demo" });
    }, { retryReadFailures: true });
    expect((await service.account("test-token")).login).toBe(123456);
    expect(calls).toBe(2);
  });
  test("news recovery never retries a rejected personal token", async () => {
    let calls = 0;
    const service = createMT5Service(async () => { calls++; return Response.json({ detail: "Invalid token" }, { status: 401 }); }, { retryReadFailures: true });
    await expect(service.account("test-token")).rejects.toThrow("401");
    expect(calls).toBe(1);
  });
  test("news read recovery never replays an ambiguous order", async () => {
    let orders = 0;
    const service = createMT5Service(async (url, init) => {
      if (init.method === "GET") return Response.json({ symbol: "BTCUSD.m", bid: 100, ask: 101 });
      orders++;
      throw new TypeError("Failed to fetch");
    }, { retryReadFailures: true });
    await expect(service.trade("test-token", { symbol: "BTCUSD.m", side: "buy", volume: 0.01, sl: 99, tp: 103, comment: "News AI" })).rejects.toThrow("server could not reach");
    expect(orders).toBe(1);
  });
  test("temporary gateway errors retain sessions but rejected tokens require login", () => {
    expect(isMT5SessionExpired(new Error("MT5 gateway (404): Not found"))).toBe(false);
    expect(isMT5SessionExpired(new Error("MT5 gateway (500): unavailable"))).toBe(false);
    expect(isMT5SessionExpired(new Error("Failed to fetch"))).toBe(false);
    expect(isMT5SessionExpired(new Error("MT5 gateway (401): Invalid token"))).toBe(true);
    expect(isMT5SessionExpired(new Error("Gateway returned a different account."))).toBe(true);
  });
  test("account 404 is not blamed on missing PHP when gateway health succeeds", async () => {
    const service = createMT5Service(async url => url.includes("a=health") ? Response.json({ gateway_reachable: true }) : Response.json({ detail: "Not found" }, { status: 404 }));
    await expect(service.account("test-token")).rejects.toThrow("gateway is online");
  });
  test("explicit disconnected response does not activate a saved account", async () => {
    const service = createMT5Service(async () => Response.json({ login: 123456, balance: 200, server: "JustMarkets-Demo", connected: false }));
    await expect(service.account("test-token")).rejects.toThrow("disconnected");
  });
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
  test("link uses the exact supplied contract and verifies connected account", async () => {
    let sent;
    const service = createMT5Service(async (url, init) => { sent = { url, init }; return Response.json({ account_id: "test", token: "test-token", account: { connected: true, login: 123456 } }); });
    await service.connect({ server: "JustMarkets-Demo", accountNumber: "123456", password: "test-only" }, { email: "client@example.test", admin_id: "7" });
    expect(sent.url).toBe("https://tradenestea.com/admin/api/mt5_gateway.php?a=link");
    expect(JSON.parse(sent.init.body)).toEqual({ login: 123456, password: "test-only", server: "JustMarkets-Demo", email: "client@example.test", adminId: "7" });
    expect(sent.url.includes("test-only")).toBe(false);
  });
  test("account proxy sends personal token only in the documented header", async () => {
    let sent;
    const service = createMT5Service(async (url, init) => { sent = { url, init }; return Response.json({ login: 123456, balance: 1000, server: "JustMarkets-Demo" }); });
    expect((await service.account("test-token")).balance).toBe(1000);
    expect(sent.url).toBe("https://tradenestea.com/admin/api/mt5_gateway.php?a=proxy&p=account");
    expect(sent.init.headers.get("X-MT5-Token")).toBe("test-token");
  });
  test("offline errors are clear and unsuccessful links never fabricate success", async () => {
    const offline = createMT5Service(async () => Response.json({ detail: { comment: "Session offline" } }, { status: 409 }));
    await expect(offline.account("test-token")).rejects.toThrow("MT5 gateway (409): Session offline");
    const incomplete = createMT5Service(async () => Response.json({ account_id: "test" }));
    await expect(incomplete.connect({ server: "Demo", accountNumber: "123", password: "test-only" }, { email: "client@example.test", admin_id: "7" })).rejects.toThrow("did not confirm");
  });
  test("account ownership conflicts retain the gateway rejection and never retry linking", async () => {
    let calls = 0;
    const service = createMT5Service(async () => { calls++; return Response.json({ detail: "Account already linked by another user" }, { status: 409 }); });
    await expect(service.connect({ server: "Demo", accountNumber: "123", password: "test-only" }, { email: "client@example.test", admin_id: "7" })).rejects.toThrow("MT5 gateway (409): Account already linked by another user");
    expect(calls).toBe(1);
  });
  test("blocked browser requests identify allowed origins without exposing credentials", async () => {
    const service = createMT5Service(async () => { throw new TypeError("Failed to fetch"); });
    const previous = globalThis.window;
    globalThis.window = {};
    try {
      await expect(service.connect({ server: "Demo", accountNumber: "123", password: "test-only" }, { email: "client@example.test", admin_id: "7" })).rejects.toThrow("allowed_origins");
    } finally {
      if (previous === undefined) delete globalThis.window;
      else globalThis.window = previous;
    }
  });
  test("gateway rejection redacts a reflected trading password", async () => {
    const service = createMT5Service(async () => Response.json({ detail: "Login failed test-only" }, { status: 401 }));
    await expect(service.connect({ server: "Demo", accountNumber: "123", password: "test-only" }, { email: "client@example.test", admin_id: "7" })).rejects.toThrow("MT5 gateway (401): Login failed [redacted]");
  });
});