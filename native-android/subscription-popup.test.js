import { test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./app/src/main/java/com/whiteyforex/tradenestea/ui/SubscriptionPopup.kt', import.meta.url), 'utf8')
const base = source.match(/private const val BASE = "([^"]+)"/)?.[1]
const paths = [...source.matchAll(/\.url\(BASE \+ "([^"]+)"/g)].map(match => match[1])

test('checkout creation uses the portal PHP API', () => {
  expect(base + paths[0]).toBe('https://tradenestea.com/admin/api/payfast_create.php')
})
test('payment status uses the portal PHP API and checkout reference', () => {
  expect(base + paths[1]).toBe('https://tradenestea.com/admin/api/payfast_status.php?payment_id=')
})
test('access uses the mentor-scoped portal PHP API', () => {
  expect(base + paths[2]).toBe('https://tradenestea.com/admin/api/check_subscription.php?admin_id=')
})

test('full subscription page uses the same PHP payment contract', () => {
  const screen = readFileSync(new URL('./app/src/main/java/com/whiteyforex/tradenestea/ui/SubscriptionScreen.kt', import.meta.url), 'utf8')
  expect(screen.match(/private const val Base = "([^"]+)"/)?.[1]).toBe('https://tradenestea.com/admin/api/')
  expect(screen).toContain('"payfast_create.php"')
  expect(screen).toContain('"payfast_status.php?payment_id=')
  expect(screen).toContain('"check_subscription.php?admin_id=')
})

test('Android polling and return helpers use PHP creation and status', () => {
  const api = readFileSync(new URL('./app/src/main/java/com/whiteyforex/tradenestea/api/PayFastApi.kt', import.meta.url), 'utf8')
  expect(api.match(/private const val BASE_URL = "([^"]+)"/)?.[1]).toBe('https://tradenestea.com/admin/api/')
  expect(api).toContain('@POST("payfast_create.php")')
  expect(api).toContain('@GET("payfast_status.php")')
})