import { describe, it as test } from "node:test";
import assert from "node:assert/strict";
import { fetchPigiVaults, PigiError } from "./pigi.server";

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
    expect(new Headers(calls[0].init?.headers).get("Content-Type")).toBe("application/json");
    expect(new Headers(calls[0].init?.headers).get("Authorization")).toBe(null);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ apiKey: "test-key" });
    expect(calls[1].url).toBe("https://pigi.finance/api/v1/vaults?limit=20");
    expect(calls[1].init?.method).toBe("GET");
    expect(calls[1].init?.body).toBe(undefined);
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
  for (const stage of ["authorization", "vaults"] as const) {
    test(`returns a safe timeout error during ${stage}`, async () => {
      let calls = 0;
      const fake = (async () => {
        calls++;
        if (stage === "vaults" && calls === 1) return Response.json({ token: "test-token" });
        throw new DOMException("sensitive upstream details", "TimeoutError");
      }) as typeof fetch;
      await assert.rejects(fetchPigiVaults("test-key", fake), (error: unknown) =>
        error instanceof PigiError && error.status === 504 &&
        error.message === `Pigi Finance ${stage} timed out. Please try again.`);
      expect(calls).toBe(stage === "authorization" ? 1 : 2);
    });
  }
  test("handles malformed authorization JSON without requesting vaults", async () => {
    let calls = 0;
    const fake = (async () => { calls++; return new Response("not json"); }) as typeof fetch;
    await expect(fetchPigiVaults("test-key", fake)).rejects.toThrow("invalid authorization response");
    expect(calls).toBe(1);
  });
  test("handles malformed vault JSON gracefully", async () => {
    let calls = 0;
    const fake = (async () => {
      calls++;
      return calls === 1 ? Response.json({ token: "test-token" }) : new Response("not json");
    }) as typeof fetch;
    await expect(fetchPigiVaults("test-key", fake)).rejects.toThrow("invalid vaults response");
  });
  test("does not disclose network error details", async () => {
    const fake = (async () => { throw new TypeError("sensitive upstream details"); }) as typeof fetch;
    await assert.rejects(fetchPigiVaults("test-key", fake), (error: unknown) =>
      error instanceof PigiError && error.status === 502 &&
      error.message === "Pigi Finance is temporarily unavailable. Please try again.");
  });
  test("does not disclose failed vault response bodies", async () => {
    let calls = 0;
    const fake = (async () => {
      calls++;
      return calls === 1 ? Response.json({ token: "test-token" }) : new Response("sensitive upstream details", { status: 503 });
    }) as typeof fetch;
    await expect(fetchPigiVaults("test-key", fake)).rejects.toThrow("Pigi Finance could not retrieve vaults.");
  });
});