import { createFileRoute } from "@tanstack/react-router";

const CANONICAL = "https://testnestea.lovable.app/";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "TradeNest EA",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Windows, MT5",
  description:
    "Automated trading control suite for MetaTrader — manage robots, signals, and market analysis from one interface.",
  url: CANONICAL,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:url", content: CANONICAL },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(JSON_LD),
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <h1
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        TradeNest EA — Automated Trading Suite
      </h1>
      <iframe
        src="/tradenest.html"
        title="TradeNest EA"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
          background: "#080808",
        }}
      />
    </>
  );
}
