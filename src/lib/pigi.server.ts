export class PigiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Keep credentials and the short-lived token on the server only. */
export async function fetchPigiVaults(apiKey: string, request: typeof fetch = fetch): Promise<unknown> {
  const auth = await request("https://pigi.finance/api/v1/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ apiKey }),
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  // Never return upstream auth bodies: they may contain credential material.
  if (!auth.ok) throw new PigiError(auth.status, "Pigi Finance could not authorize the connection.");
  const data: unknown = await auth.json();
  if (!data || typeof data !== "object" || !("token" in data) || typeof data.token !== "string" || !data.token) {
    throw new PigiError(502, "Pigi Finance returned an invalid authorization response.");
  }
  const vaults = await request("https://pigi.finance/api/v1/vaults?limit=20", {
    headers: { Authorization: `Bearer ${data.token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!vaults.ok) throw new PigiError(vaults.status, "Pigi Finance could not retrieve vaults.");
  return vaults.json();
}