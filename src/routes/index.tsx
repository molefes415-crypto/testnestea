import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TradeNest EA — Automated Trading Suite" },
      {
        name: "description",
        content:
          "TradeNest EA is an automated trading control suite for MetaTrader — manage robots, signals, and market analysis from one interface.",
      },
      { property: "og:title", content: "TradeNest EA — Automated Trading Suite" },
      {
        property: "og:description",
        content:
          "TradeNest EA is an automated trading control suite for MetaTrader — manage robots, signals, and market analysis from one interface.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
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
  );
}
