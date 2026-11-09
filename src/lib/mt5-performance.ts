export type Position = { ticket: number; identifier?: number; symbol: string; type?: number; volume: number; profit: number; swap?: number; comment?: string; price_open?: number; price_current?: number; sl?: number; tp?: number };
export type Deal = { ticket: number; position_id: number; symbol: string; type: number; entry: number; volume: number; profit: number; commission?: number; swap?: number; fee?: number; comment?: string; time?: number };
export type ClosedTrade = { id: number; symbol: string; bot: string; net: number; time?: number; volume: number; side: string };
export type AccountDeal = Omit<Deal, "position_id" | "entry"> & { position_id?: number; entry?: number };

function rows(data: unknown, key: string): Record<string, unknown>[] {
  const list = Array.isArray(data) ? data : data && typeof data === "object" ? (data as Record<string, unknown>)[key] : undefined;
  if (!Array.isArray(list) || list.some(row => !row || typeof row !== "object")) throw new Error(`Gateway ${key} response is not a supported list.`);
  return list;
}
function number(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Gateway trade record is missing ${key}.`);
  return value;
}
function tradeType(row: Record<string, unknown>): number | undefined {
  const value = row.type ?? row.side;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string") {
    if (/^buy$/i.test(value) || value === "0") return 0;
    if (/^sell$/i.test(value) || value === "1") return 1;
  }
  return undefined;
}
export function positionSide(position: Position): string {
  return position.type === 0 ? "BUY" : position.type === 1 ? "SELL" : "—";
}
export function floatingPerformance(positions: Position[]) {
  return { profit: positions.reduce((sum, p) => sum + p.profit, 0), swap: positions.reduce((sum, p) => sum + (p.swap ?? 0), 0) };
}
export function readPositions(data: unknown): Position[] {
  return rows(data, "positions").map(row => {
    for (const key of ["ticket", "volume", "profit"]) number(row, key);
    if (typeof row.symbol !== "string") throw new Error("Gateway position is missing its exact symbol.");
    return { ...row, type: tradeType(row) } as Position;
  });
}
export function readDeals(data: unknown): Deal[] {
  return rows(data, "deals").map((row): Record<string, unknown> => {
    const type = tradeType(row);
    if (type === undefined) throw new Error("Broker history does not identify trade direction; bot totals cannot yet be verified.");
    return { ...row, type };
  }).filter(row => row.type === 0 || row.type === 1).map(row => {
    if (typeof row.position_id !== "number") throw new Error("Broker history is missing position references. Closed bot totals cannot be verified; open positions remain available.");
    for (const key of ["ticket", "position_id", "type", "entry", "volume", "profit"]) number(row, key);
    if (typeof row.symbol !== "string") throw new Error("Gateway history is missing its exact symbol.");
    if (row.entry === 2) throw new Error("Reversed positions require additional broker history details before performance can be calculated.");
    return row as Deal;
  });
}
export function readAccountHistory(data: unknown): AccountDeal[] {
  return rows(data, "deals").map((row): Record<string, unknown> => {
    const type = tradeType(row);
    if (type === undefined) throw new Error("Broker history must identify trading records separately from deposits before earnings can be verified.");
    return { ...row, type };
  }).filter(row => row.type === 0 || row.type === 1).map(row => {
    for (const key of ["ticket", "volume", "profit"]) number(row, key);
    for (const key of ["commission", "swap", "fee"]) if (row[key] !== undefined) number(row, key);
    if (typeof row.symbol !== "string") throw new Error("Gateway history is missing its exact symbol.");
    return row as AccountDeal;
  });
}
export function accountPerformance(deals: AccountDeal[]) {
  const unique = [...new Map(deals.map(d => [d.ticket, d])).values()];
  const history = unique.map(d => ({ ...d, net: d.profit + (d.commission ?? 0) + (d.swap ?? 0) + (d.fee ?? 0) })).sort((a,b) => (b.time ?? 0) - (a.time ?? 0));
  const exits = history.filter(d => d.entry === 1 || d.entry === 2 || d.entry === 3);
  const wins = exits.filter(d => d.net > 0).length;
  const losses = exits.filter(d => d.net < 0).length;
  const classified = history.every(d => typeof d.entry === "number");
  return { history, net: history.reduce((s,d) => s+d.net,0), tradingProfit: history.reduce((s,d) => s+d.profit,0), costs: history.reduce((s,d) => s+d.net-d.profit,0), grossProfit: history.reduce((s,d) => s+Math.max(d.profit,0),0), grossLoss: history.reduce((s,d) => s+Math.min(d.profit,0),0), wins: classified ? wins : null, losses: classified ? losses : null, closes: classified ? exits.length : null, breakeven: classified ? exits.length-wins-losses : null, accuracy: classified && exits.length ? wins/exits.length*100 : null };
}
export function botPerformance(deals: Deal[], positions: Position[], names: string[]) {
  const groups = new Map<number, Deal[]>();
  const seen = new Set<number>();
  for (const deal of deals) {
    if (seen.has(deal.ticket)) continue;
    seen.add(deal.ticket);
    groups.set(deal.position_id, [...(groups.get(deal.position_id) || []), deal]);
  }
  const openIds = new Set(positions.map(p => p.identifier ?? p.ticket));
  const trades: ClosedTrade[] = [];
  for (const [id, group] of groups) {
    if (openIds.has(id)) continue;
    const tagged = group.find(d => d.comment && names.includes(d.comment));
    const exits = group.filter(d => d.entry === 1 || d.entry === 3);
    const entry = group.find(d => d.entry === 0);
    if (!tagged?.comment || !entry || !exits.length) continue;
    trades.push({ id, symbol: entry.symbol, bot: tagged.comment, side: entry.type === 0 ? "BUY" : "SELL", volume: exits.reduce((n, d) => n + d.volume, 0), time: Math.max(...exits.map(d => d.time ?? 0)) || undefined, net: group.reduce((n, d) => n + d.profit + (d.commission ?? 0) + (d.swap ?? 0) + (d.fee ?? 0), 0) });
  }
  trades.sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
  const wins = trades.filter(t => t.net > 0).length;
  const losses = trades.filter(t => t.net < 0).length;
  return { trades, wins, losses, breakeven: trades.length - wins - losses, net: trades.reduce((n, t) => n + t.net, 0), grossProfit: trades.reduce((n, t) => n + Math.max(t.net, 0), 0), grossLoss: trades.reduce((n, t) => n + Math.min(t.net, 0), 0), accuracy: trades.length ? wins / trades.length * 100 : null };
}