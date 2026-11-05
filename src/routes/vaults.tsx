import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Web3Boundary } from "@/components/web3-boundary";
const VaultBrowser = lazy(() => import("@/components/vault-browser"));
const fallback = <main className="vault-theme min-h-screen bg-background p-8 text-foreground"><h1 className="text-4xl font-bold">Yield vaults</h1><p role="status" className="mt-4">Loading wallets and live vaults…</p></main>;
export const Route = createFileRoute("/vaults")({
  head: () => ({ meta: [{ title: "Live Yield Vaults | TradeNest EA" }, { name: "description", content: "Browse live Pigi Finance vault yields, liquidity and risk, and connect a wallet to supported deposits." }, { property: "og:title", content: "TradeNest EA — Live Yield Vaults" }, { property: "og:description", content: "Explore live on-chain yield opportunities powered by Pigi Finance." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <Web3Boundary fallback={fallback}><Suspense fallback={fallback}><VaultBrowser/></Suspense></Web3Boundary>,
});
