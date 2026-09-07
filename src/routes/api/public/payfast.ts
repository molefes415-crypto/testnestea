import { createFileRoute } from '@tanstack/react-router'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Content-Type': 'application/json',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS })

/**
 * PayFast subscription checkout (server-signed).
 *
 * ?action=create  POST { email, user_ref } -> { payment_id, process_url, fields }
 * ?action=status  GET  payment_id | email  -> { status, paid }
 * ?action=cancel  POST { payment_id }      -> { status: 'cancelled' }
 *
 * Payment is only ever marked paid by the ITN handler
 * (/api/public/payfast-itn), never by the browser.
 */
export const Route = createFileRoute('/api/public/payfast')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        try {
          const u = new URL(request.url)
          const action = u.searchParams.get('action') || ''

          // Hosted PayFast launcher — the single link the app/browser opens.
          // Serves a self-submitting POST form with the server-signed fields,
          // so native apps don't need to build a data: URL (blocked by Chrome)
          // or hold the signed fields themselves.
          if (action === 'launch') {
            const paymentId = (u.searchParams.get('payment_id') || '').trim()
            if (!paymentId) return json({ error: 'missing payment_id' }, 400)
            const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
            const { data } = await supabaseAdmin
              .from('payments')
              .select('raw')
              .eq('paypal_order_id', paymentId)
              .maybeSingle()
            const fields = (data?.raw as any)?.fields
            const processUrl = (data?.raw as any)?.process_url
            if (!fields || !processUrl) return json({ error: 'payment not found' }, 404)
            const inputs = Object.entries(fields as Record<string, string>)
              .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}"/>`)
              .join('')
            const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Opening PayFast…</title><style>body{background:#050505;color:#fff;font-family:sans-serif;text-align:center;padding:64px 24px}</style></head><body><p>Opening secure PayFast checkout…</p><form id="f" action="${esc(processUrl)}" method="post" accept-charset="utf-8">${inputs}</form><script>document.getElementById('f').submit();</script></body></html>`
            return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
          }

          if (action !== 'status') return json({ error: 'unknown action' }, 400)
          const paymentId = (u.searchParams.get('payment_id') || '').trim()
          const email = (u.searchParams.get('email') || '').trim().toLowerCase()
          if (!paymentId && !email) return json({ error: 'missing payment_id or email' }, 400)

          const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
          let q = supabaseAdmin
            .from('payments')
            .select('paypal_order_id,status,amount,currency,verified_at')
            .eq('provider', 'payfast')
            .order('created_at', { ascending: false })
            .limit(1)
          q = paymentId ? q.eq('paypal_order_id', paymentId) : q.eq('email', email)
          const { data } = await q.maybeSingle()

          const status = data?.status ?? 'pending'
          return json({ status, paid: status === 'paid', payment_id: data?.paypal_order_id || paymentId })
        } catch (e: any) {
          return json({ status: 'pending', paid: false, error: e?.message || 'server error' }, 500)
        }
      },

      POST: async ({ request }) => {
        try {
          const u = new URL(request.url)
          const action = u.searchParams.get('action') || ''
          const body = (await request.json().catch(() => ({}))) as Record<string, any>
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

          if (action === 'create') {
            const email = String(body.email || '').trim().toLowerCase()
            const userRef = String(body.user_ref || email || '').trim()
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid email' }, 400)

            const { payfastConfig, payfastSignature, PAYFAST_PRODUCT } = await import('@/lib/payfast.server')
            const cfg = payfastConfig()
            if (!cfg.merchantId || !cfg.merchantKey) {
              return json({ error: 'payfast_not_configured' }, 500)
            }

            // Use the canonical (non-www) origin: www 307-redirects to apex and
            // PayFast/CloudFront can reject redirected return/notify hops.
            const origin = new URL(request.url).origin.replace('://www.', '://')
            const paymentId = `tnea${Date.now()}${Math.floor(Math.random() * 1000)}`
            // One link handles both success and cancel (cancel is signalled by PayFast's
            // own flag or the ITN status). notify_url stays server-to-server.
            const returnUrl = `${origin}/payfast-return.html?m=${encodeURIComponent(paymentId)}`
            const cancelUrl = returnUrl
            const notifyUrl = `${origin}/api/public/payfast-itn`

            // Field ORDER matters for the PayFast signature.
            const ordered: Array<[string, string]> = [
              ['merchant_id', cfg.merchantId],
              ['merchant_key', cfg.merchantKey],
              ['return_url', returnUrl],
              ['cancel_url', cancelUrl],
              ['notify_url', notifyUrl],
              ['name_first', 'TradeNest'],
              ['name_last', 'Trader'],
              ['email_address', email],
              ['m_payment_id', paymentId],
              ['amount', PAYFAST_PRODUCT.amount],
              ['item_name', PAYFAST_PRODUCT.item_name],
              ['item_description', PAYFAST_PRODUCT.item_description],
              ['custom_str1', userRef.slice(0, 120)],
              ['custom_str2', email],
              ['subscription_type', '1'],
              ['recurring_amount', PAYFAST_PRODUCT.amount],
              ['frequency', PAYFAST_PRODUCT.frequency],
              ['cycles', PAYFAST_PRODUCT.cycles],
            ]
            const signature = await payfastSignature(ordered, cfg.passphrase)
            const fields = Object.fromEntries([...ordered, ['signature', signature]])

            await supabaseAdmin.from('payments').upsert(
              {
                user_ref: userRef.slice(0, 120) || email,
                email,
                provider: 'payfast',
                paypal_order_id: paymentId,
                amount: Number(PAYFAST_PRODUCT.amount),
                currency: PAYFAST_PRODUCT.currency,
                status: 'pending',
                raw: { fields, process_url: cfg.processUrl },
              },
              { onConflict: 'paypal_order_id' },
            )

            return json({
              payment_id: paymentId,
              process_url: cfg.processUrl,
              fields,
              // Same-apex hosted launch page — the only link the app opens.
              launch_url: `${origin}/api/public/payfast?action=launch&payment_id=${encodeURIComponent(paymentId)}`,
              amount: PAYFAST_PRODUCT.amount,
              currency: PAYFAST_PRODUCT.currency,
              status: 'pending',
            })
          }

          if (action === 'cancel') {
            const paymentId = String(body.payment_id || '').trim()
            if (!paymentId) return json({ error: 'missing payment_id' }, 400)
            await supabaseAdmin
              .from('payments')
              .update({ status: 'cancelled' })
              .eq('paypal_order_id', paymentId)
              .eq('status', 'pending') // never downgrade a verified payment
            return json({ status: 'cancelled', paid: false, payment_id: paymentId })
          }

          return json({ error: 'unknown action' }, 400)
        } catch (e: any) {
          return json({ error: e?.message || 'server error' }, 500)
        }
      },
    },
  },
})
