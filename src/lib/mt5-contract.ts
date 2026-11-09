export const MT5_ENDPOINTS = {
  session: "session.php",
  connect: "connect.php",
  account: "account.php",
  symbols: "symbols.php",
} as const;

export const MT5_SESSION_BLOCKER =
  "MT5 connection is not yet verified: the PHP source for session.php and connect.php is needed to confirm token issuance, account ownership and the exact connection contract.";

export type MT5AppIdentity = { email: string; admin_id: string };

// The existing app stores the mentor ID as userProfile.name. This reads that
// profile without changing login. It is context, not server-verified identity.
export function readExistingMT5Identity(profileJSON: string | null): MT5AppIdentity | null {
  try {
    const profile: unknown = JSON.parse(profileJSON || "null");
    if (!profile || typeof profile !== "object") return null;
    const value = profile as Record<string, unknown>;
    const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
    const adminId = value.name || value.adminId;
    const admin_id = typeof adminId === "string" || typeof adminId === "number" ? String(adminId).trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !admin_id || admin_id.length > 150) return null;
    return { email, admin_id };
  } catch { return null; }
}

export type MT5ConnectionInput = { server: string; accountNumber: string; password: string };
export type MT5Account = { broker: string; accountNumber: string; balance: number; equity: number; margin: number; currency: string };

export function validateConnection(input: MT5ConnectionInput) {
  if (!input.server.trim()) throw new Error("Enter your broker server.");
  if (!/^\d{1,20}$/.test(input.accountNumber)) throw new Error("Enter a valid MT5 account number.");
  if (!input.password || input.password.length > 256) throw new Error("Enter your MT5 trading password.");
}

export function exactBrokerSymbol(symbol: string, brokerSymbols: readonly string[]) {
  if (!brokerSymbols.includes(symbol)) throw new Error(`Symbol "${symbol}" does not exist exactly on the connected broker.`);
  return symbol;
}

export function preserveOrderStops<T extends { stopLoss?: number; takeProfit?: number }>(order: T): T {
  for (const stop of [order.stopLoss, order.takeProfit]) {
    if (stop !== undefined && (!Number.isFinite(stop) || stop < 0)) throw new Error("Invalid stop loss or take profit.");
  }
  return { ...order };
}