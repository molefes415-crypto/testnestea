import { test, expect } from "bun:test";
import { botPerformance, readDeals, readPositions, positionSide, floatingPerformance } from "./mt5-performance";
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
test("positions without type retain real symbols and profit without inventing a sell direction", () => {
  const positions = readPositions([{ticket:12,symbol:".US30.",volume:0.01,profit:-7}]);
  expect(positions[0].profit).toBe(-7);
  expect(positions[0].symbol).toBe(".US30.");
  expect(positionSide(positions[0])).toBe("—");
});
test("explicit broker side fields are read for positions and history", () => {
  expect(positionSide(readPositions([{ticket:12,symbol:"BTCUSDm",volume:0.01,profit:5,side:"buy"}])[0])).toBe("BUY");
  const row = deal(1,10,0,0); delete row.type;
  expect(readDeals([{...row,side:"sell"}])[0].type).toBe(1);
  expect(() => readDeals([row])).toThrow("cannot yet be verified");
});
test("live trading profit remains positive when separately reported swap makes net negative", () => {
  const result = floatingPerformance(readPositions([{ticket:1,symbol:"XAUUSD.m",volume:0.01,profit:5.67,swap:-20}]));
  expect(result.profit).toBe(5.67);
  expect(result.swap).toBe(-20);
});