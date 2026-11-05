export type Vault = {
  id: number; name: string; protocol: string; chainId: number;
  address: string; asset: string; apr: number | null; tvl: number | null;
  risk: string; strategy: string;
};
export const chainNames: Record<number, string> = { 1: "Ethereum", 10: "Optimism", 56: "BNB Chain", 137: "Polygon", 250: "Fantom", 324: "zkSync", 1088: "Metis", 8453: "Base", 42161: "Arbitrum", 42220: "Celo", 43114: "Avalanche", 59144: "Linea", 534352: "Scroll" };
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
export function normalizeVaults(payload: unknown): Vault[] {
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) return [];
  return payload.data.flatMap((v: unknown) => {
    if (!v || typeof v !== "object") return [];
    const r = v as Record<string, unknown>;
    if (typeof r.id !== "number" || typeof r.chain_id !== "number") return [];
    const text = (k: string) => typeof r[k] === "string" ? r[k] as string : "";
    return [{ id: r.id, name: text("display_name") || text("pool_name") || "Unnamed vault", protocol: text("protocol_name"), chainId: r.chain_id, address: text("pool_address"), asset: text("asset_address"), apr: finite(r.apr_30d_ma), tvl: finite(r.tvl_30d_ma), risk: text("risk_band") || "Not rated", strategy: text("type") }];
  });
}
// Never interpret a lending pool or a yield metric as a deposit contract.
export function supportsStandardDeposit(v: Vault) {
  return ["ERC-4626", "Morpho", "Euler", "Yearn v3"].includes(v.protocol) && /^0x[0-9a-fA-F]{40}$/.test(v.address) && /^0x[0-9a-fA-F]{40}$/.test(v.asset);
}