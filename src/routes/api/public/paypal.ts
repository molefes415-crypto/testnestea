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
 * PayPal Orders API v2 flow (server-verified).
 *
 * Why not the plain PayPal.me / no-code (NCP) payment link: an NCP link gives the
 * app no order id, no capture id and no reliable way to tie a payment to a user,
 * so it can't be verified server-side. We therefore create a real PayPal order
 * server-side, send the buyer to PayPal's approval page, then capture + verify.
 *
 * ?action=create   POST { email, user_ref } -> { order_id, approve_url }
 * ?action=capture  POST { order_id }        -> { status }
 * ?action=status   GET  order_id | email    -> { status }
 * ?action=cancel   POST { order_id }        -> { status: 'cancelled' }
 */
export const Route = createFileRoute('/api/public/paypal')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        try {
          const u = new URL(request.url)
          if (u.searchParams.get('action') !== 'status') {
            return json({ error: 'unknown action' }, 400)
          }
          const orderId = (u.searchParams.get('order_id') || '').trim()
          const email = (u.searchParams.get('email') || '').trim().toLowerCase()
          if (!orderId && !email) return json({ error: 'missing order_id or email' }, 400)

          const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
          let q = supabaseAdmin
            .from('payments')
            .select('paypal_order_id,status,verified_at,amount,currency')
            .order('created_at', { ascending: false })
            .limit(1)
          q = orderId ? q.eq('paypal_order_id', orderId) : q.eq('email', email)
          const { data } = await q.maybeSingle()

          if (data?.status === 'paid') {
            return json({ status: 'paid', paid: true, order_id: data.paypal_order_id })
          }

          // Not paid in our records yet. If PayPal already approved/completed the
          // order, capture it now so a slow return still resolves correctly.
          if (orderId) {
            const captured = await captureAndVerify(orderId)
            if (captured.status === 'paid') return json({ status: 'paid', paid: true, order_id: orderId })
            return json({ status: captured.status, paid: false, order_id: orderId })
          }
          return json({ status: data?.status ?? 'pending', paid: false })
        } catch (e: any) {
          return json({ status: 'pending', paid: false, error: e?.message || 'server error' }, 500)
        }
      },

      POST: async ({ request }) => {
        try {
          const u = new URL(request.url)
          const action = u.searchParams.get('action') || ''
          const body = (await request.json().catch(() => ({}))) as Record<string, any>

          if (action === 'create') {
            const email = String(body.email || '').trim().toLowerCase()
            const userRef = String(body.user_ref || email || '').trim()
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid email' }, 400)

            const { PRODUCT, paypalFetch } = await import('@/lib/paypal.server')
            const origin = new URL(request.url).origin
            const returnUrl = `${origin}/paypal-return.html`
            const cancelUrl = `${origin}/paypal-return.html?cancel=1`

            const created = await paypalFetch('/v2/checkout/orders', {
              method: 'POST',
              body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [
                  {
                    custom_id: userRef.slice(0, 120),
                    description: PRODUCT.description,
                    amount: { currency_code: PRODUCT.currency, value: PRODUCT.amount },
                  },
                ],
                payment_source: {
                  paypal: {
                    email_address: email,
                    experience_context: {
                      brand_name: PRODUCT.name,
                      user_action: 'PAY_NOW',
                      shipping_preference: 'NO_SHIPPING',
                      landing_page: 'LOGIN',
                      return_url: returnUrl,
                      cancel_url: cancelUrl,
                    },
                  },
                },
              }),
            })
            if (!created.ok || !created.data?.id) {
              return json({ error: 'paypal_create_failed', detail: created.data }, 502)
            }
            const orderId: string = created.data.id
            const links: any[] = Array.isArray(created.data.links) ? created.data.links : []
            const approve =
              links.find((l) => l.rel === 'payer-action')?.href ||
              links.find((l) => l.rel === 'approve')?.href

            const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
            await supabaseAdmin.from('payments').upsert(
              {
                user_ref: userRef.slice(0, 120) || email,
                email,
                provider: 'paypal',
                paypal_order_id: orderId,
                amount: PRODUCT.amount,
                currency: PRODUCT.currency,
                status: 'pending',
              },
              { onConflict: 'paypal_order_id' },
            )

            return json({ order_id: orderId, approve_url: approve, status: 'pending' })
          }

          if (action === 'capture') {
            const orderId = String(body.order_id || '').trim()
            if (!orderId) return json({ error: 'missing order_id' }, 400)
            const result = await captureAndVerify(orderId)
            return json({ ...result, paid: result.status === 'paid', order_id: orderId })
          }

          if (action === 'cancel') {
            const orderId = String(body.order_id || '').trim()
            if (!orderId) return json({ error: 'missing order_id' }, 400)
            const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
            // Never downgrade an already verified payment.
            await supabaseAdmin
              .from('payments')
              .update({ status: 'cancelled' })
              .eq('paypal_order_id', orderId)
              .eq('status', 'pending')
            return json({ status: 'cancelled', paid: false, order_id: orderId })
          }

          return json({ error: 'unknown action' }, 400)
        } catch (e: any) {
          return json({ error: e?.message || 'server error' }, 500)
        }
      },
    },
  },
})

/**
 * Captures the order at PayPal (or reads it back if already captured), verifies
 * status + amount + currency against the Trade Nest EA product, and records the
 * payment idempotently. Returns 'paid' | 'pending' | 'failed' | 'cancelled'.
 */
async function captureAndVerify(
  orderId: string,
): Promise<{ status: 'paid' | 'pending' | 'failed' | 'cancelled'; reason?: string }> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { paypalFetch, extractCapture, amountMatches, PRODUCT } = await import('@/lib/paypal.server')

  // Idempotency: already verified → done, no second capture.
  const { data: existing } = await supabaseAdmin
    .from('payments')
    .select('status')
    .eq('paypal_order_id', orderId)
    .maybeSingle()
  if (existing?.status === 'paid') return { status: 'paid' }

  let res = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    body: '{}',
  })

  // ORDER_ALREADY_CAPTURED / not-approved-yet → read the order instead.
  if (!res.ok) {
    const issue = String(res.data?.details?.[0]?.issue || res.data?.name || '')
    const get = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}`)
    if (!get.ok) return { status: 'pending', reason: issue || 'capture_failed' }
    res = get
    const orderStatus = String(res.data?.status || '').toUpperCase()
    if (orderStatus === 'VOIDED') {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'cancelled' })
        .eq('paypal_order_id', orderId)
        .eq('status', 'pending')
      return { status: 'cancelled' }
    }
    if (orderStatus !== 'COMPLETED') return { status: 'pending', reason: issue || orderStatus }
  }

  const cap = extractCapture(res.data)
  if (!cap.completed) return { status: 'pending', reason: 'not_completed' }
  if (!amountMatches(cap.amount, cap.currency)) {
    await supabaseAdmin
      .from('payments')
      .update({ status: 'failed', raw: { reason: 'amount_mismatch', amount: cap.amount, currency: cap.currency } })
      .eq('paypal_order_id', orderId)
    return { status: 'failed', reason: 'amount_mismatch' }
  }

  const payerEmail = cap.payerEmail || null
  const customId = res.data?.purchase_units?.[0]?.custom_id || payerEmail || 'unknown'

  const { error } = await supabaseAdmin.from('payments').upsert(
    {
      user_ref: String(customId).slice(0, 120),
      email: String(payerEmail || customId).toLowerCase(),
      provider: 'paypal',
      paypal_order_id: orderId,
      paypal_capture_id: cap.captureId ?? null,
      payer_email: payerEmail,
      amount: cap.amount ?? PRODUCT.amount,
      currency: cap.currency ?? PRODUCT.currency,
      status: 'paid',
      verified_at: new Date().toISOString(),
    },
    { onConflict: 'paypal_order_id' },
  )
  if (error) return { status: 'pending', reason: 'record_failed' }
  return { status: 'paid' }
}
