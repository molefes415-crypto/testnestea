import { createFileRoute } from "@tanstack/react-router";

const CANONICAL = "https://testnestea.lovable.app/";
const TITLE = "TradeNest EA Trading Dashboard";
const DESCRIPTION =
  "Control TradeNest EA robots, trading signals, chart scanning, and MetaTrader account execution from one dashboard.";

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
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:url", content: CANONICAL },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
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
