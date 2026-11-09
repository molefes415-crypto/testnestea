import { test, expect } from "bun:test";
import { createMT5Service } from "./mt5-service";

test("account history uses the documented default range rather than requesting decades of data", async () => {
  let requested;
  const service = createMT5Service(async (url, options) => {
    requested = new URL(url);
    expect(options.headers.get("X-MT5-Token")).toBe("fixture");
    return new Response("[]", {status:200});
  });
  expect(await service.history("fixture")).toEqual([]);
  expect(requested.searchParams.get("p")).toBe("history");
  expect(requested.searchParams.has("days")).toBe(false);
});