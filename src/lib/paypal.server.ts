// Server-only PayPal helpers. Never import from client code.
// Credentials come from secure backend secrets: PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET.

export const PRODUCT = {
  name: 'Trade Nest EA',
  description: 'Trade Nest EA — one-time access',
  amount: '35.00',
  currency: 'USD',
} as const

export function paypalBase(): string {
  return (process.env['PAYPAL_ENV'] || '').toLowerCase() === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'
}

let cached: { token: string; exp: number } | null = null

export async function paypalToken(): Promise<string> {
  const id = process.env['PAYPAL_CLIENT_ID']
  const secret = process.env['PAYPAL_CLIENT_SECRET']
  if (!id || !secret) throw new Error('paypal_credentials_missing')
  const now = Date.now()
  if (cached && cached.exp > now + 30_000) return cached.token
  const basic = Buffer.from(`${id}:${secret}`).toString('base64')
  const r = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  })
  if (!r.ok) throw new Error('paypal_auth_failed')
  const j = (await r.json()) as { access_token?: string; expires_in?: number }
  if (!j.access_token) throw new Error('paypal_auth_failed')
  cached = { token: j.access_token, exp: now + (j.expires_in ?? 3000) * 1000 }
  return cached.token
}

export async function paypalFetch(path: string, init: RequestInit = {}) {
  const token = await paypalToken()
  const r = await fetch(`${paypalBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  })
  const text = await r.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  return { ok: r.ok, status: r.status, data }
}

/** Reads the completed capture out of an order (capture or get response). */
export function extractCapture(order: any): {
  captureId?: string
  amount?: string
  currency?: string
  completed: boolean
  payerEmail?: string
} {
  const pu = order?.purchase_units?.[0]
  const cap = pu?.payments?.captures?.[0]
  const amount = cap?.amount?.value ?? pu?.amount?.value
  const currency = cap?.amount?.currency_code ?? pu?.amount?.currency_code
  const completed =
    String(order?.status || '').toUpperCase() === 'COMPLETED' &&
    String(cap?.status || '').toUpperCase() === 'COMPLETED'
  return {
    captureId: cap?.id,
    amount,
    currency,
    completed,
    payerEmail: order?.payer?.email_address,
  }
}

export function amountMatches(amount?: string, currency?: string): boolean {
  if (!amount || !currency) return false
  if (currency.toUpperCase() !== PRODUCT.currency) return false
  return Math.abs(Number(amount) - Number(PRODUCT.amount)) < 0.005
}
