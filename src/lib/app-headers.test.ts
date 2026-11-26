import { test, expect } from "bun:test";
import { withAppHeaders } from "./app-headers";
test("adds v2 headers to portal API calls", () => {
  const h = new Headers(withAppHeaders("https://tradenestea.com/admin/api/news.php", { headers: { "X-MT5-Token": "t" } })?.headers);
  expect(h.get("X-App-Signature")).toBe("TN-EA-V2-SECURE-SECRET-9981");
  expect(h.get("X-App-Version")).toBe("2.0.0");
  expect(h.get("X-MT5-Token")).toBe("t");
});
test("does not send headers to other sites", () => {
  expect(withAppHeaders("https://example.com/x", undefined)).toBeUndefined();
});
