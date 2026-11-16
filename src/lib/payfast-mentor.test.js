import { test, expect } from 'bun:test'
import { paymentMentorId, mentorActivationSchema } from './payfast-mentor'

test('activation uses stored mentor ID and refuses email-only legacy checkout identity', () => {
  expect(paymentMentorId({ mentor_id: 17 })).toBe(17)
  expect(() => paymentMentorId({ user_ref: 'client@example.com' })).toThrow()
  expect(() => paymentMentorId({ mentor_id: 0 })).toThrow()
})
test('only paid R580 ZAR confirmations qualify for mentor activation', () => {
  const paid = { payment_id: 'tnea1', provider_payment_id: 'pf1', admin_id: 17, email: 'CLIENT@example.com', amount: '580.00', currency: 'ZAR', status: 'paid' }
  expect(mentorActivationSchema.parse(paid).email).toBe('client@example.com')
  expect(() => mentorActivationSchema.parse({ ...paid, status: 'pending' })).toThrow()
  expect(() => mentorActivationSchema.parse({ ...paid, amount: '350.00' })).toThrow()
})