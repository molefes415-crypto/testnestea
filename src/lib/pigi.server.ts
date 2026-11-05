export class PigiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** The timeout covers both receiving headers and reading the JSON body. */
async function requestJson(
  request: typeof fetch,
  url: string,
  init: RequestInit,
  stage: "authorization" | "vaults",
): Promise<unknown> {
  const signal = AbortSignal.timeout(15_000);
  try {
    const response = await request(url, { ...init, signal, redirect: "error" });
    if (!response.ok) {
      throw new PigiError(response.status, stage === "authorization"
        ? "Pigi Finance could not authorize the connection."
        : "Pigi Finance could not retrieve vaults.");
    }
    return await response.json();
  } catch (error) {
    if (error instanceof PigiError) throw error;
    if (signal.aborted || (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))) {
      throw new PigiError(504, `Pigi Finance ${stage} timed out. Please try again.`);
    }
    if (error instanceof SyntaxError) {
      throw new PigiError(502, `Pigi Finance returned an invalid ${stage} response.`);
    }
    throw new PigiError(502, "Pigi Finance is temporarily unavailable. Please try again.");
  }
}

/** Keep credentials and the short-lived token on the server only. */
export async function fetchPigiVaults(apiKey: string, request: typeof fetch = fetch): Promise<unknown> {
  const data = await requestJson(request, "https://pigi.finance/api/v1/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ apiKey }),
  }, "authorization");
  if (!data || typeof data !== "object" || !("token" in data) || typeof data.token !== "string" || !data.token) {
    throw new PigiError(502, "Pigi Finance returned an invalid authorization response.");
  }
  return requestJson(request, "https://pigi.finance/api/v1/vaults?limit=20", {
    method: "GET",
    headers: { Authorization: `Bearer ${data.token}`, Accept: "application/json" },
  }, "vaults");
}