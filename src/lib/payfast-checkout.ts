import { z } from 'zod'

export const PAYFAST_RECEIVER = '36249167'
export const PAYFAST_PAYNOW_URL = 'https://payment.payfast.io/eng/process'

export function payfastPayNowFields(input: {
  paymentId: string
  email: string
  userRef: string
  notifyUrl: string
}) {
  const paymentId = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/).parse(input.paymentId)
  const email = z.string().email().max(254).parse(input.email)
  const userRef = z.string().max(120).parse(input.userRef)
  const notifyUrl = z.string().url().startsWith('https://').parse(input.notifyUrl)
  const returnUrl = `https://tradenestea.com/admin/api/payfast_return.php?m=${encodeURIComponent(paymentId)}`
  return {
    cmd: '_paynow',
    receiver: PAYFAST_RECEIVER,
    return_url: returnUrl,
    cancel_url: `${returnUrl}&cancel=1`,
    notify_url: notifyUrl,
    amount: '580',
    item_name: 'Trade Nest EA',
    item_description: 'Trade Nest EA is a technology platform that provides secure cloud hosting, deployment, and management services for Expert Advisors (EAs) and automate software',
    subscription_type: '1',
    recurring_amount: '580',
    cycles: '0',
    frequency: '3',
    // Retain a stored, unique checkout reference for the ITN and both mobile apps.
    m_payment_id: paymentId,
    email_address: email,
    custom_str1: userRef,
    custom_str2: email,
  }
}