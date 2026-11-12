import { test, expect } from 'bun:test';
import '../../public/mt5-local-robot.js';

const samples = (count, duration) => Array.from({ length: count }, (_, i) => ({ observedAt: i * duration / Math.max(1, count - 1) }));

test('robot readiness uses a capped ten-point scale with unchanged history requirements', () => {
  const { readiness } = globalThis.TNLocalRobot;
  expect(readiness([])).toBe(0);
  expect(readiness(samples(20, 90000))).toBe(5);
  expect(readiness(samples(40, 180000))).toBe(10);
  expect(readiness(samples(80, 360000))).toBe(10);
  expect(readiness(samples(40, 90000))).toBe(5);
  expect(readiness(samples(10, 180000))).toBe(2);
});