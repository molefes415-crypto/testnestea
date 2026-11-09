import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./mt5_gateway.php', import.meta.url), 'utf8');

test('MT5 linking does not require an active app subscription', () => {
  expect(source).not.toMatch(/is_active_subscriber|CHECK_SUBSCRIPTION_URL|Subscription not active/);
  expect(source).toContain("gw('POST', '/admin/accounts', $adminHdr, $payload, 220)");
});

test('an email label cannot authorize deletion of another existing terminal', () => {
  expect(source).not.toContain("gw('DELETE', '/admin/accounts/");
  expect(source).toContain("if ($st === 409) out(");
  expect(source).toContain("if ($token === '') out(['detail' => 'Missing token'], 401)");
  expect(source).toContain("$hdr = ['Authorization: Bearer ' . $token]");
});