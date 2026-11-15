import { z } from 'zod'

const payload = z.object({
  merchant_id: z.string().min(1).max(30),
  m_payment_id: z.string().min(1).max(120),
  pf_payment_id: z.string().min(1).max(120),
  payment_status: z.enum(['COMPLETE', 'CANCELLED', 'FAILED', 'PENDING']),
  amount_gross: z.string().regex(/^\d{1,10}\.\d{2}$/),
  signature: z.string().regex(/^[a-f\d]{32}$/i),
}).passthrough()

export function parsePayfastItn(raw: string) {
  if (new TextEncoder().encode(raw).length > 32_768) throw new Error('Notification too large')
  const fields = [...new URLSearchParams(raw).entries()]
  if (new Set(fields.map(([key]) => key)).size !== fields.length) throw new Error('Duplicate notification fields')
  return { fields, data: payload.parse(Object.fromEntries(fields)) }
}

export function payfastAmountMatches(gross: string, expected: number) {
  return Number.isFinite(expected) && Math.round(Number(gross) * 100) === Math.round(expected * 100)
}

export function payfastNotifyUrl(origin: string, override?: string) {
  const url = new URL(override || `${origin}/api/public/payfast-itn`)
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Invalid PayFast notification URL')
  return url.href
}