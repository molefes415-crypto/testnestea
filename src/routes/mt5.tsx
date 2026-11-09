import { createFileRoute } from "@tanstack/react-router";
import { MT5Connection } from "@/components/mt5-connection";

export const Route = createFileRoute("/mt5")({
  head: () => ({ meta: [
    { title: "Expert Mobile VPS — MT5 Connection | Trade Nest EA" },
    { name: "description", content: "Connect your broker's MetaTrader 5 account to Expert Mobile VPS and view verified account details and broker symbols." },
    { property: "og:title", content: "Expert Mobile VPS — MT5 Connection" },
    { property: "og:description", content: "Manage your independent MetaTrader 5 broker connection with Trade Nest EA." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MT5Connection,
});