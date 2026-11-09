import { createFileRoute } from "@tanstack/react-router";
import { Performance } from "@/components/performance";
export const Route = createFileRoute("/performance")({
  head: () => ({ meta: [
    { title: "Account Performance | Trade Nest EA" },
    { name: "description", content: "Review connected MT5 open positions, bot trade history, net earnings, win rate and losses in Trade Nest EA." },
    { property: "og:title", content: "Account Performance — Trade Nest EA" },
    { property: "og:description", content: "Track verified account positions and closed bot trading results." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Performance,
});