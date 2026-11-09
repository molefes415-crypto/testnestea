import { createServerFn } from "@tanstack/react-start";

export const readFundamentals = createServerFn({ method: "GET" }).handler(async () => {
  const { getNewsEvents } = await import("@/lib/news.server");
  return { events: await getNewsEvents(), fetchedAt: new Date().toISOString() };
});