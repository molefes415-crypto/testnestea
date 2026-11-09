import { createFileRoute } from "@tanstack/react-router";
import { MT5Connection } from "@/components/mt5-connection";

export const Route = createFileRoute("/mt5")({
  head: () => ({ meta: [
    { title: "MetaTrader Accounts | Trade Nest EA" },
    { name: "description", content: "View verified MetaTrader 5 balances, switch saved broker accounts, and securely link an MT5 login with Trade Nest EA." },
    { property: "og:title", content: "MetaTrader Accounts — Trade Nest EA" },
    { property: "og:description", content: "Manage your saved MT5 broker accounts and verified balances with Trade Nest EA." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&display=swap" }] }),
  component: MT5Connection,
});