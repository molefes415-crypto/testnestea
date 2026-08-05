import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-api-key, authorization",
};

const ALLOWED_MODELS = new Set([
  "google/gemini-3.6-flash",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5-mini",
]);

type Body = {
  prompt?: string;
  imageBase64?: string | null;
  mime?: string | null;
  model?: string;
};

/**
 * Generic vision->JSON proxy for the PHP admin AI scanner.
 * The PHP host holds no provider key — it only sends SCANNER_API_KEY and we
 * run the call through the Lovable AI gateway server-side.
 */
export const Route = createFileRoute("/api/public/ai-vision")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const json = (data: unknown, status = 200) =>
          new Response(JSON.stringify(data), {
            status,
            headers: { "content-type": "application/json", ...CORS },
          });

        try {
          const required = process.env["SCANNER_API_KEY"];
          if (required) {
            const auth = request.headers.get("authorization") || "";
            const provided =
              request.headers.get("x-api-key") ||
              (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "");
            if (provided !== required) return json({ error: "Invalid API key" }, 401);
          }

          const body = (await request.json()) as Body;
          const prompt = (body.prompt || "").trim();
          if (!prompt) return json({ error: "prompt required" }, 400);

          const model = ALLOWED_MODELS.has(body.model || "")
            ? (body.model as string)
            : "google/gemini-3.6-flash";

          const apiKey = process.env["LOVABLE_API_KEY"];
          if (!apiKey) return json({ error: "AI gateway not configured" }, 500);

          const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
          if (body.imageBase64) {
            const mime = body.mime || "image/png";
            const url = body.imageBase64.startsWith("data:")
              ? body.imageBase64
              : `data:${mime};base64,${body.imageBase64}`;
            content.push({ type: "image_url", image_url: { url } });
          }

          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "system",
                  content:
                    "You are an elite SMC/ICT chart analyst. Return strict JSON only, no prose.",
                },
                { role: "user", content },
              ],
              response_format: { type: "json_object" },
            }),
          });

          if (!resp.ok) {
            const t = await resp.text().catch(() => "");
            return json({ error: `Gateway ${resp.status}: ${t.slice(0, 300)}` }, 200);
          }

          const data = await resp.json();
          const text: string = data?.choices?.[0]?.message?.content ?? "";
          return json({ model, text });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return json({ error: msg }, 200);
        }
      },
    },
  },
});
