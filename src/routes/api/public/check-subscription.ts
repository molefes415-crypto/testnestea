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
async function checkPayPalByEmail(email: string, days = 31): Promise<{ active: boolean; raw?: unknown; error?: string; scanned?: number; sampleEmails?: string[] }> {
  const token = await getPayPalToken()
  if (!token) return { active: false, error: 'paypal_auth_failed' }

  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, '-0000')
  const target = email.trim().toLowerCase()
  const sampleEmails: string[] = []
  let scanned = 0
  let lastError: string | undefined

  // Try both Successful and Pending — hosted-button captures often sit Pending briefly.
  for (const status of ['S', 'P']) {
    let page = 1
    while (page <= 5) {
      const qs = new URLSearchParams({
        start_date: fmt(start),
        end_date: fmt(end),
        fields: 'payer_info,transaction_info,cart_info',
        page_size: '100',
        page: String(page),
        transaction_status: status,
      })
      const r = await fetch(`${paypalBase()}/v1/reporting/transactions?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
      if (!r.ok) {
        const txt = await r.text().catch(() => '')
        lastError = `paypal_${r.status}_status_${status}${txt ? ':' + txt.slice(0, 120) : ''}`
        break
      }
      const j: any = await r.json()
      const details: any[] = Array.isArray(j?.transaction_details) ? j.transaction_details : []
      scanned += details.length
      for (const t of details) {
        const em = (t?.payer_info?.email_address || '').toLowerCase()
        if (em) {
          if (sampleEmails.length < 8 && !sampleEmails.includes(em)) sampleEmails.push(em)
          if (em === target) {
            return { active: true, raw: { id: t?.transaction_info?.transaction_id, status }, scanned, sampleEmails }
          }
        }
      }
      const totalPages = Number(j?.total_pages || 1)
      if (page >= totalPages) break
      page += 1
    }
  }
  return { active: false, error: lastError, scanned, sampleEmails }
}

// Manual override list — comma-separated emails granted access without PayPal verification.
// Set MANUAL_ACTIVATED_EMAILS secret to activate a user immediately (bypasses PayPal lag).
function isManuallyActivated(email: string): boolean {
  const raw = process.env.MANUAL_ACTIVATED_EMAILS || ''
  if (!raw) return false
  const list = raw.split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
  return list.includes(email.trim().toLowerCase())
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
          const debug = u.searchParams.get('debug') === '1'
          if (!adminId || !email) {
            return new Response(JSON.stringify({ active: false, error: 'missing admin_id or email' }), { status: 400, headers: CORS })
          }

          // 0) Manual override
          if (isManuallyActivated(email)) {
            return new Response(JSON.stringify({ active: true, via: 'manual' }), { status: 200, headers: CORS })
          }

          // 0.5) Server-verified PayPal payment recorded in our database
          try {
            const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
            const { data: paid } = await supabaseAdmin
              .from('payments')
              .select('paypal_order_id')
              .eq('status', 'paid')
              .or(`email.eq.${email},payer_email.eq.${email}`)
              .limit(1)
              .maybeSingle()
            if (paid) {
              return new Response(JSON.stringify({ active: true, via: 'payment_record', order: paid.paypal_order_id }), { status: 200, headers: CORS })
            }
          } catch {
            // fall through to the other checks
          }


          // 1) Portal
          const portal = await checkUpstream(adminId, email)
          if (portal.active) {
            return new Response(JSON.stringify({ active: true, via: 'portal', source: portal.source }), { status: 200, headers: CORS })
          }

          // 2) PayPal REST fallback (Transaction Search may lag up to 3 hours after checkout).
          const paypal = await checkPayPalByEmail(email)
          if (paypal.active) {
            return new Response(JSON.stringify({ active: true, via: 'paypal', txn: (paypal.raw as any)?.id }), { status: 200, headers: CORS })
          }

          const body: any = {
            active: false,
            via: 'none',
            hint: 'PayPal Transaction Search can lag up to 3 hours after payment. Try again shortly, and confirm the email matches the one used at PayPal checkout.',
          }
          if (debug) {
            body.paypalError = paypal.error
            body.paypalScanned = paypal.scanned
            body.paypalSampleEmails = paypal.sampleEmails
          }
          return new Response(JSON.stringify(body), { status: 200, headers: CORS })
        } catch (e: any) {
          return new Response(JSON.stringify({ active: false, error: e?.message || 'server error' }), { status: 500, headers: CORS })
        }
      },
    },
  },
})
