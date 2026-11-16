import { test, expect } from 'bun:test'
import { payfastPayNowFields, PAYFAST_PAYNOW_URL } from './payfast-checkout'

const fields = () => payfastPayNowFields({ paymentId: 'tnea123', email: 'client@example.com', userRef: 'client1', notifyUrl: 'https://tradenestea.com/admin/api/payfast_itn.php' })

test('supplied PayFast form uses Pay Now receiver and endpoint without merchant credentials', () => {
  expect(PAYFAST_PAYNOW_URL).toBe('https://payment.payfast.io/eng/process')
  expect(fields().cmd).toBe('_paynow')
  expect(fields().receiver).toBe('36249167')
  expect(fields()).not.toHaveProperty('merchant_key')
})
test('supplied subscription charges R580 monthly until cancelled', () => {
  expect(fields().amount).toBe('580')
  expect(fields().recurring_amount).toBe('580')
  expect(fields().subscription_type).toBe('1')
  expect(fields().frequency).toBe('3')
  expect(fields().cycles).toBe('0')
})
test('checkout retains its exact unique reference for both mobile returns and ITN', () => {
  expect(fields().m_payment_id).toBe('tnea123')
  expect(fields().return_url).toBe('https://tradenestea.com/admin/api/payfast_return.php?m=tnea123')
  expect(fields().cancel_url).toBe('https://tradenestea.com/admin/api/payfast_return.php?m=tnea123&cancel=1')
  expect(fields().notify_url).toBe('https://tradenestea.com/admin/api/payfast_itn.php')
})