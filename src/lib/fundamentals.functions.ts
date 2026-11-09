import { createServerFn } from "@tanstack/react-start";

export const readFundamentals = createServerFn({ method: "GET" }).handler(async () => {
  const { getNewsEvents } = await import("@/lib/news.server");
  try {
    return { events: await getNewsEvents(), fetchedAt: new Date().toISOString(), unavailable: false };
  } catch {
    return { events: [] as Awaited<ReturnType<typeof getNewsEvents>>, fetchedAt: new Date().toISOString(), unavailable: true };
  }
});