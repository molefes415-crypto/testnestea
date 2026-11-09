import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./mt5_gateway.php', import.meta.url), 'utf8');

test('MT5 linking does not require an active app subscription', () => {
  expect(source).not.toMatch(/is_active_subscriber|CHECK_SUBSCRIPTION_URL|Subscription not active/);
  expect(source).toContain("gw('POST', '/admin/accounts', $adminHdr, $payload, 220)");
});

test('re-linking replaces a terminal only after the broker verifies the password', () => {
  const block = source.slice(source.indexOf('if ($st === 409)'));
  const check = block.indexOf('broker_password_ok(');
  const del = block.indexOf("gw('DELETE', '/admin/accounts/");
  expect(check).toBeGreaterThan(-1);
  expect(del).toBeGreaterThan(check);
  expect(block.slice(0, del)).not.toContain("'label'");
  expect(source).toContain("if ($token === '') out(['detail' => 'Missing token'], 401)");
  expect(source).toContain("$hdr = ['Authorization: Bearer ' . $token]");
});