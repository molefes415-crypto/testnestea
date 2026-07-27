import { createFileRoute } from '@tanstack/react-router'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Content-Type': 'application/json',
}

// Portal upstreams (kept as a fallback if the portal already tracks the payer).
const UPSTREAMS = [
  'https://tradenestea.com/admin/api/check_subscription.php',
  'https://tradenestea.com/admin/api/check-subscription.php',
  'https://tradenestea.com/admin/api/subscription_status.php',
]

async function checkUpstream(adminId: string, email: string): Promise<{ active: boolean; source?: string; raw?: unknown }> {
  for (const base of UPSTREAMS) {
    try {
      const url = `${base}?admin_id=${encodeURIComponent(adminId)}&email=${encodeURIComponent(email)}`
      const r = await fetch(url, { headers: { accept: 'application/json' } })
      if (!r.ok) continue
      const text = await r.text()
      let data: any = null
      try { data = JSON.parse(text) } catch { data = { raw: text } }
      const active =
        data?.active === true ||
        data?.status === 'active' ||
        data?.subscribed === true ||
        data?.is_active === true ||
        /"active"\s*:\s*true/i.test(text)
      if (active) return { active: true, source: base, raw: data }
    } catch {
      // try next upstream
    }
  }
  return { active: false }
}

// ---------- PayPal REST verification ----------
// Docs: https://developer.paypal.com/api/rest/authentication/
//       https://developer.paypal.com/docs/api/transaction-search/v1/

const PAYPAL_BASE = 'https://api-m.paypal.com' // live
// If PayPal creds are sandbox, flip to https://api-m.sandbox.paypal.com via env.
function paypalBase() {
  return (process.env.PAYPAL_ENV || '').toLowerCase() === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : PAYPAL_BASE
}

let cachedToken: { token: string; exp: number } | null = null

async function getPayPalToken(): Promise<string | null> {
  const id = process.env.PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!id || !secret) return null
  const now = Date.now()
  if (cachedToken && cachedToken.exp > now + 30_000) return cachedToken.token
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
  if (!r.ok) return null
  const j: any = await r.json()
  if (!j?.access_token) return null
  cachedToken = { token: j.access_token, exp: now + (j.expires_in ?? 3000) * 1000 }
  return cachedToken.token
}

/**
 * Look for a successful PayPal transaction from the given payer email in the
 * last N days. Uses the Transaction Search API. Requires the "Transaction
 * Search" feature enabled on the PayPal app.
 */
async function checkPayPalByEmail(email: string, days = 31): Promise<{ active: boolean; raw?: unknown; error?: string }> {
  const token = await getPayPalToken()
  if (!token) return { active: false, error: 'paypal_auth_failed' }

  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, '-0000')

  const qs = new URLSearchParams({
    start_date: fmt(start),
    end_date: fmt(end),
    fields: 'payer_info,transaction_info',
    page_size: '100',
    page: '1',
    transaction_status: 'S', // successful
  })

  const r = await fetch(`${paypalBase()}/v1/reporting/transactions?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!r.ok) {
    const txt = await r.text().catch(() => '')
    return { active: false, error: `paypal_${r.status}`, raw: txt.slice(0, 300) }
  }
  const j: any = await r.json()
  const target = email.trim().toLowerCase()
  const details: any[] = Array.isArray(j?.transaction_details) ? j.transaction_details : []
  const match = details.find((t) => {
    const em = (t?.payer_info?.email_address || '').toLowerCase()
    return em && em === target
  })
  return { active: !!match, raw: match ? { id: match?.transaction_info?.transaction_id } : undefined }
}

export const Route = createFileRoute('/api/public/check-subscription')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const u = new URL(request.url)
          const adminId = (u.searchParams.get('admin_id') || '').trim()
          const email = (u.searchParams.get('email') || '').trim().toLowerCase()
          if (!adminId || !email) {
            return new Response(JSON.stringify({ active: false, error: 'missing admin_id or email' }), { status: 400, headers: CORS })
          }

          // 1) Portal (authoritative if it already flags the account active)
          const portal = await checkUpstream(adminId, email)
          if (portal.active) {
            return new Response(JSON.stringify({ active: true, via: 'portal', source: portal.source }), { status: 200, headers: CORS })
          }

          // 2) PayPal REST fallback — verify a successful payment exists for this email.
          const paypal = await checkPayPalByEmail(email)
          if (paypal.active) {
            return new Response(JSON.stringify({ active: true, via: 'paypal', txn: (paypal.raw as any)?.id }), { status: 200, headers: CORS })
          }

          return new Response(JSON.stringify({ active: false, via: 'none', paypalError: paypal.error, paypalRaw: paypal.raw }), { status: 200, headers: CORS })
        } catch (e: any) {
          return new Response(JSON.stringify({ active: false, error: e?.message || 'server error' }), { status: 500, headers: CORS })
        }
      },
    },
  },
})
