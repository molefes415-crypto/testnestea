import { createFileRoute } from "@tanstack/react-router";
import { MT5Connection } from "@/components/mt5-connection";

export const Route = createFileRoute("/mt5")({
  head: () => ({ meta: [
    { title: "MT5 Account Login | Trade Nest EA" },
    { name: "description", content: "Connect your broker's MetaTrader 5 account to Expert Mobile VPS and view verified account details and broker symbols." },
    { property: "og:title", content: "MT5 Account Login — Trade Nest EA" },
    { property: "og:description", content: "Manage your independent MetaTrader 5 broker connection with Trade Nest EA." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&display=swap" }] }),
  component: MT5Connection,
});