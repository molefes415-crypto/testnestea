import { createFileRoute } from "@tanstack/react-router";
import { Fundamentals } from "@/components/fundamentals";
import { fundamentalsQuery } from "@/lib/fundamentals-query";
export const Route = createFileRoute("/fundamentals")({
  head: () => ({ meta: [
    { title: "Fundamentals & Economic Calendar | Trade Nest EA" },
    { name: "description", content: "Follow economic releases, forecasts, previous results and AI news outlooks in Johannesburg time with Trade Nest EA." },
    { property: "og:title", content: "Trade Nest EA — Fundamentals" },
    { property: "og:description", content: "Economic calendar and AI news outlooks for your trading symbols." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(fundamentalsQuery),
  component: Fundamentals,
});