import { createFileRoute } from "@tanstack/react-router";
import { fetchPigiVaults, PigiError } from "@/lib/pigi.server";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

// Private integration endpoint; uses TradeNest's existing server-side API key.
export const Route = createFileRoute("/api/public/pigi")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const required = process.env["SCANNER_API_KEY"];
        if (!required || request.headers.get("x-api-key") !== required) {
          return json({ success: false, error: "Unauthorized" }, 401);
        }
        const apiKey = process.env["PIGI_API_KEY"];
        if (!apiKey) return json({ success: false, error: "Pigi Finance is not configured." }, 503);
        try {
          return json(await fetchPigiVaults(apiKey));
        } catch (error) {
          if (error instanceof PigiError) {
            return json({ success: false, error: error.message, provider_status: error.status }, error.status === 504 ? 504 : 502);
          }
          return json({ success: false, error: "Pigi Finance is temporarily unavailable." }, 502);
        }
      },
    },
  },
});