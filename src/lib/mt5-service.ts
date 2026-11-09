import { MT5_GATEWAY_BASE, preserveOrderStops, validateConnection, type MT5Account, type MT5AppIdentity, type MT5ConnectionInput } from "./mt5-contract";

export function createMT5Service(request: typeof fetch = fetch) {
  async function call(action: "link" | "proxy" | "health", path?: string, token?: string, method = "GET", body?: unknown) {
    const url = new URL(MT5_GATEWAY_BASE);
    url.searchParams.set("a", action);
    if (path) url.searchParams.set("p", path);
    const headers = new Headers({ Accept: "application/json" });
    if (body !== undefined) headers.set("Content-Type", "application/json");
    if (token) headers.set("X-MT5-Token", token);
    let response: Response;
    try {
      response = await request(url.toString(), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(action === "link" ? 200000 : 30000), redirect: "error", credentials: "omit" });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new Error("MT5 gateway connection timed out. Try again and check the trading server.");
      throw new Error("Cannot reach the MT5 gateway. Check your internet connection; the gateway must also allow this app's website address in mt5_config.php allowed_origins.");
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data?.detail;
      const message = typeof detail === "string" ? detail : typeof detail?.comment === "string" ? detail.comment : `Gateway request failed (${response.status}).`;
      // Preserve broker detail without reflecting credentials into the UI.
      const safeMessage = [token, typeof body === "object" && body !== null && "password" in body ? String(body.password) : undefined].reduce<string>((text, secret) => secret ? text.split(secret).join("[redacted]") : text, message);
      throw new Error(response.status === 404 ? "MT5 gateway not found. The supplied gateway URL returned 404." : `MT5 gateway (${response.status}): ${safeMessage}`);
    }
    if (data === null) throw new Error("Gateway returned an invalid response.");
    return data;
  }
  const proxy = (token: string, path: string, method = "GET", body?: unknown) => {
    if (!token) throw new Error("Link your MT5 account first.");
    return call("proxy", path, token, method, body);
  };
  return {
    async connect(input: MT5ConnectionInput, identity: MT5AppIdentity) {
      validateConnection(input);
      const login = Number(input.accountNumber);
      if (!Number.isSafeInteger(login) || login <= 0) throw new Error("Enter a valid MT5 account number.");
      const data = await call("link", undefined, undefined, "POST", { login, password: input.password, server: input.server.trim(), email: identity.email, adminId: identity.admin_id });
      if (typeof data.token !== "string" || !data.token || typeof data.account_id !== "string" || data.account?.connected !== true || data.account.login !== login) throw new Error("Gateway did not confirm this MT5 account connection.");
      return data as { account_id: string; token: string; account: MT5Account };
    },
    async account(token: string): Promise<MT5Account> {
      const data = await proxy(token, "account");
      if (typeof data.login !== "number" || typeof data.balance !== "number" || typeof data.server !== "string") throw new Error("Gateway returned incomplete account details.");
      return data;
    },
    positions: (token: string) => proxy(token, "positions"),
    history: (token: string) => proxy(token, "history"),
    quote: (token: string, symbol: string) => proxy(token, `quote/${symbol}`),
    async trade(token: string, order: { symbol: string; side: "buy" | "sell"; volume: number; sl: number | null; tp: number | null; comment: string }) {
      preserveOrderStops({ stopLoss: order.sl ?? undefined, takeProfit: order.tp ?? undefined });
      const quote = await proxy(token, `quote/${order.symbol}`);
      if (quote.symbol !== order.symbol) throw new Error(`Symbol "${order.symbol}" does not exist exactly on the connected broker.`);
      return proxy(token, "order", "POST", { ...order, deviation: 20 });
    },
    modify: (token: string, body: { ticket: number; sl: number | null; tp: number | null }) => proxy(token, "modify", "POST", body),
    close: (token: string, body: { ticket: number; volume?: number }) => proxy(token, "close", "POST", body),
    closeAll: (token: string) => proxy(token, "close_all", "POST"),
    disconnect: (token: string) => proxy(token, "me", "DELETE"),
    health: () => call("health"),
  };
}