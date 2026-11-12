import { test, expect } from "bun:test";
import { createMT5Service } from "./mt5-service";

const input = { server: "JustMarkets-Demo", accountNumber: "12345678", password: "x" };
const identity = { email: "a@b.c", admin_id: "1" };

test("a failed link reports a slow broker login when the gateway health check passes", async () => {
  const service = createMT5Service(async (url) => {
    if (new URL(url).searchParams.get("a") === "health") return new Response(JSON.stringify({ gateway_reachable: true }), { status: 200 });
    throw new TypeError("Failed to fetch");
  });
  await expect(service.connect(input, identity)).rejects.toThrow("broker login did not finish in time");
});

test("server gateway failure does not blame the client's internet or browser origins", async () => {
  const service = createMT5Service(async () => { throw new TypeError("Failed to fetch"); });
  await expect(service.connect(input, identity)).rejects.toThrow("robot server could not reach the MT5 gateway");
});
