import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { fetchPigiVaults } from "./pigi.server";

function expect(value: unknown) {
  return {
    toEqual: (expected: unknown) => assert.deepEqual(value, expected),
    toBe: (expected: unknown) => assert.equal(value, expected),
    rejects: { toThrow: (message: string) => assert.rejects(value as Promise<unknown>, (error: unknown) => error instanceof Error && error.message.includes(message)) },
  };
}

describe("Pigi vault connection", () => {
  test("exchanges the key before requesting twenty vaults with the returned token", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fake = (async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json(calls.length === 1 ? { token: "test-token" } : { vaults: [{ id: "vault-1" }] });
    }) as typeof fetch;
    expect(await fetchPigiVaults("test-key", fake)).toEqual({ vaults: [{ id: "vault-1" }] });
    expect(calls[0].url).toBe("https://pigi.finance/api/v1/auth/token");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ apiKey: "test-key" });
    expect(calls[1].url).toBe("https://pigi.finance/api/v1/vaults?limit=20");
    expect(new Headers(calls[1].init?.headers).get("Authorization")).toBe("Bearer test-token");
  });
  test("stops on failed authorization without disclosing the provider response", async () => {
    let calls = 0;
    const fake = (async () => {
      calls++;
      return new Response("sensitive upstream body", { status: 401 });
    }) as typeof fetch;
    await expect(fetchPigiVaults("test-key", fake)).rejects.toThrow("Pigi Finance could not authorize the connection.");
    expect(calls).toBe(1);
  });
  test("does not request vaults when a token is missing", async () => {
    let calls = 0;
    const fake = (async () => { calls++; return Response.json({}); }) as typeof fetch;
    await expect(fetchPigiVaults("test-key", fake)).rejects.toThrow("invalid authorization response");
    expect(calls).toBe(1);
  });
});