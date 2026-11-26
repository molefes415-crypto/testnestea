// v2 app identity headers required by the tradenestea.com /admin/api/ PHP files.
export const APP_HEADERS = { "X-App-Signature": "TN-EA-V2-SECURE-SECRET-9981", "X-App-Version": "2.0.0" } as const;
const PORTAL = "https://tradenestea.com/admin/api/";

export function withAppHeaders(input: RequestInfo | URL, init?: RequestInit): RequestInit | undefined {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(PORTAL)) return init;
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  for (const [k, v] of Object.entries(APP_HEADERS)) headers.set(k, v);
  return { ...init, headers };
}

export function installAppHeaders(target: { fetch: typeof fetch } = globalThis) {
  const original = target.fetch as typeof fetch & { __tnApp?: boolean };
  if (!original || original.__tnApp) return;
  const wrapped = ((input: RequestInfo | URL, init?: RequestInit) => original(input, withAppHeaders(input, init))) as typeof fetch & { __tnApp?: boolean };
  wrapped.__tnApp = true;
  target.fetch = wrapped;
}
