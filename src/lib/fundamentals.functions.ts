import { createServerFn } from "@tanstack/react-start";

export const readFundamentals = createServerFn({ method: "GET" }).handler(async () => {
  const { getNewsEvents } = await import("@/lib/news.server");
  try {
    return { events: await getNewsEvents(), fetchedAt: new Date().toISOString(), unavailable: false, error: "" };
  } catch (e) {
    return { events: [] as Awaited<ReturnType<typeof getNewsEvents>>, fetchedAt: new Date().toISOString(), unavailable: true, error: e instanceof Error ? e.message : "News calendar unavailable." };
  }
});