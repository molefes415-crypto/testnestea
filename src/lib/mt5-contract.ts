export const MT5_ENDPOINTS = {
  session: "session.php",
  connect: "connect.php",
  account: "account.php",
  symbols: "symbols.php",
} as const;

export const MT5_SESSION_BLOCKER =
  "MT5 connection is unavailable: session.php requires email and admin_id. A separate, client-bound MT5 session is required before connecting a trading account.";

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