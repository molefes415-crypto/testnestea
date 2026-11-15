import { test, expect } from 'bun:test'
import { parsePayfastItn, payfastAmountMatches, payfastNotifyUrl } from './payfast-itn'
import { createHash } from 'node:crypto'
import { payfastItnSignature, payfastValidate } from './payfast.server'

const raw = 'merchant_id=123&m_payment_id=order1&pf_payment_id=pf1&payment_status=COMPLETE&amount_gross=580.00&signature=' + 'a'.repeat(32)
test('R580 monthly payments must match the stored amount exactly', () => {
  expect(payfastAmountMatches('580.00', 580)).toBe(true)
  expect(payfastAmountMatches('579.99', 580)).toBe(false)
  expect(payfastAmountMatches('581.00', 580)).toBe(false)
})
test('duplicate fields cannot override signed payment identity', () => {
  expect(() => parsePayfastItn(raw + '&m_payment_id=other')).toThrow('Duplicate')
  expect(parsePayfastItn(raw).data.m_payment_id).toBe('order1')
})
test('notifications require transaction identity and valid money', () => {
  expect(() => parsePayfastItn(raw.replace('pf_payment_id=pf1&', ''))).toThrow()
  expect(() => parsePayfastItn(raw.replace('580.00', 'NaN'))).toThrow()
})
test('Render notify URL must use HTTPS, leaving the default unchanged', () => {
  expect(payfastNotifyUrl('https://tradnestea.app')).toBe('https://tradnestea.app/api/public/payfast-itn')
  expect(payfastNotifyUrl('https://tradnestea.app', 'https://example.onrender.com/itn')).toBe('https://example.onrender.com/itn')
  expect(() => payfastNotifyUrl('https://tradnestea.app', 'http://example.com/itn')).toThrow()
})
test('signature uses PHP encoding and excludes the incoming signature field', async () => {
  const expected = createHash('md5').update('item_name=TradeNest+%21%27%28%29%2A&passphrase=test').digest('hex')
  expect(await payfastItnSignature([['item_name', "TradeNest !'()*"], ['signature', 'ignored']], 'test')).toBe(expected)
})
test('PayFast must return exact VALID; unavailable validation cannot approve payment', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('VALID')
    expect(await payfastValidate('test=1')).toBe(true)
    globalThis.fetch = async () => new Response('INVALID')
    expect(await payfastValidate('test=1')).toBe(false)
    globalThis.fetch = async () => new Response('VALID anything else')
    expect(await payfastValidate('test=1')).toBe(false)
    globalThis.fetch = async () => new Response('unavailable', { status: 503 })
    await expect(payfastValidate('test=1')).rejects.toThrow('unavailable')
  } finally { globalThis.fetch = original }
})