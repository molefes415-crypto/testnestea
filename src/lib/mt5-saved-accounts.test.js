import { test, expect } from "bun:test";
import { parseSaved, upsertSaved, removeSaved, firstFourLoginDigits } from "./mt5-saved-accounts";

test("account cards reveal only the first four login digits", () => {
  expect(firstFourLoginDigits(2002245610)).toBe("2002***");
  expect(firstFourLoginDigits(4096842)).toBe("4096***");
  expect(firstFourLoginDigits(12345678)).toBe("1234***");
});

test("saved accounts never keep the password", () => {
  const list = upsertSaved([], { token: "t1", login: 123, server: "JustMarkets-Demo", password: "secret" });
  expect(JSON.stringify(list)).not.toContain("secret");
  expect(JSON.stringify(parseSaved(JSON.stringify([{ token: "t1", login: 1, server: "s", password: "p" }])))).not.toContain('"p"');
});

test("relinking the same login+server replaces the old entry", () => {
  let list = upsertSaved([], { token: "old", login: 5, server: "Srv" });
  list = upsertSaved(list, { token: "new", login: 5, server: "srv" });
  expect(list).toHaveLength(1);
  expect(list[0].token).toBe("new");
});

test("different accounts are kept separately and unlink removes only one", () => {
  let list = upsertSaved([], { token: "a", login: 1, server: "S" });
  list = upsertSaved(list, { token: "b", login: 2, server: "S" });
  expect(list).toHaveLength(2);
  expect(removeSaved(list, "a").map(a => a.login)).toEqual([2]);
});
