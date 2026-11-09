import { test, expect } from "bun:test";
import { botPerformance, readDeals, readPositions } from "./mt5-performance";
const deal = (ticket, position_id, entry, profit, comment = "mobi ea", extra = {}) => ({ ticket, position_id, entry, profit, comment, symbol: "XAUUSD.m", type: 0, volume: 0.1, ...extra });
test("bot overall earnings and accuracy exclude manual trades and include broker costs", () => {
  const result = botPerformance([deal(1, 10, 0, 0, "mobi ea", {commission:-2}), deal(2, 10, 1, 102), deal(3, 20, 0, 0), deal(4, 20, 1, -40, "", {swap:-5}), deal(5, 30, 0, 0, "manual"), deal(6, 30, 1, 900, "manual")], [], ["mobi ea"]);
  expect(result.net).toBe(55); expect(result.accuracy).toBe(50); expect(result.losses).toBe(1); expect(result.grossLoss).toBe(-45); expect(result.trades).toHaveLength(2);
});
test("partial closes remain excluded while the account position is open and duplicate deals are not counted twice", () => {
  const deals = [deal(1, 10, 0, 0), deal(2, 10, 1, 20), deal(2, 10, 1, 20)];
  expect(botPerformance(deals, [{ticket:99,identifier:10}], ["mobi ea"]).net).toBe(0);
  expect(botPerformance(deals, [], ["mobi ea"]).net).toBe(20);
});
test("unknown history does not fabricate zero earnings and no closed trades has no accuracy", () => {
  expect(() => readDeals({ unknown: [] })).toThrow(); expect(() => readPositions([{symbol:"XAUUSD"}])).toThrow();
  expect(botPerformance([], [], ["mobi ea"]).accuracy).toBeNull();
});