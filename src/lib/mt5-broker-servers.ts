// Brokers and exact MT5 server names offered on the login screen.
const exness = [...new Set(("Real9 Trial5 Real Real4 Trial3 Trial2 Trial15 Real33 Trial4 Trial6 Real28 Real46 Real44 Real50 Real41 Real42 Real37 Real31 Trial14 Real29 Real18 Real43 Real30 Real48 Real24 Real51 Real40 Real36 Real38 Trial17 Real21 Real23 Real3 Real34 Real8 Real20 Trial12 Trial Real32 Real26 Real17 Real19 Real6 Real16 Real27 Trial10 Real35 Real2 Trial9 Real5 Real12 Real10 Trial16 Real11 Trial11 Trial8 Real22 Real25").split(" ").map(s => `Exness-MT5${s}`))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const xm = ["XMGlobal-MT5", ...[2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(n => `XMGlobal-MT5 ${n}`)];
export const BROKER_SERVERS: { broker: string; servers: string[] }[] = [
  { broker: "JustMarkets", servers: ["JustMarkets-Live", "JustMarkets-Live2", "JustMarkets-Live3", "JustMarkets-Live6", "JustMarkets-LIVE7", "JustMarkets-Demo", "JustMarkets-Demo2", "JustMarkets-Demo3", "JustMarkets-DEMO6"] },
  { broker: "Exness", servers: exness },
  { broker: "Razor Markets", servers: ["RazorMarkets-Live"] },
  { broker: "AccuMarkets", servers: ["Accumarkets-Live"] },
  { broker: "XM", servers: xm },
];
