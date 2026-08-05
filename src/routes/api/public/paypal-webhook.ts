import { createFileRoute } from '@tanstack/react-router'

/**
 * PayPal webhook — PAYMENT.CAPTURE.COMPLETED / .DENIED / .REFUNDED, CHECKOUT.ORDER.APPROVED.
 * The event signature is verified with PayPal's official
 * /v1/notifications/verify-webhook-signature endpoint before anything is trusted.
 * Requires the PAYPAL_WEBHOOK_ID backend secret.
 */
export const Route = createFileRoute('/api/public/paypal-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text()
        const webhookId = process.env['PAYPAL_WEBHOOK_ID']
        if (!webhookId) return new Response('webhook not configured', { status: 503 })

        const h = (n: string) => request.headers.get(n) || ''
        const { paypalFetch, extractCapture, amountMatches } = await import('@/lib/paypal.server')

        let event: any
        try {
          event = JSON.parse(raw)
        } catch {
          return new Response('bad payload', { status: 400 })
        }

        const verify = await paypalFetch('/v1/notifications/verify-webhook-signature', {
          method: 'POST',
          body: JSON.stringify({
            auth_algo: h('paypal-auth-algo'),
            cert_url: h('paypal-cert-url'),
            transmission_id: h('paypal-transmission-id'),
            transmission_sig: h('paypal-transmission-sig'),
            transmission_time: h('paypal-transmission-time'),
            webhook_id: webhookId,
            webhook_event: event,
          }),
        })
        if (!verify.ok || verify.data?.verification_status !== 'SUCCESS') {
          return new Response('invalid signature', { status: 401 })
        }

        const type = String(event?.event_type || '')
        const resource = event?.resource ?? {}
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        // Capture events carry the order id in supplementary_data.
        const orderId: string | undefined =
          resource?.supplementary_data?.related_ids?.order_id || (type.startsWith('CHECKOUT.ORDER') ? resource?.id : undefined)
        if (!orderId) return new Response('ok')

        if (type === 'PAYMENT.CAPTURE.COMPLETED') {
          const amount = resource?.amount?.value
          const currency = resource?.amount?.currency_code
          if (!amountMatches(amount, currency)) {
            await supabaseAdmin
              .from('payments')
              .update({ status: 'failed', raw: { reason: 'amount_mismatch', amount, currency } })
              .eq('paypal_order_id', orderId)
            return new Response('ok')
          }
          // Idempotent: only promote a payment that isn't already paid.
          const { data: existing } = await supabaseAdmin
            .from('payments')
            .select('status')
            .eq('paypal_order_id', orderId)
            .maybeSingle()
          if (existing?.status === 'paid') return new Response('ok')

          await supabaseAdmin
            .from('payments')
            .update({
              status: 'paid',
              paypal_capture_id: resource?.id ?? null,
              amount: Number(amount),
              currency,
              verified_at: new Date().toISOString(),
            })
            .eq('paypal_order_id', orderId)
          return new Response('ok')
        }

        if (type === 'PAYMENT.CAPTURE.DENIED' || type === 'PAYMENT.CAPTURE.REVERSED' || type === 'PAYMENT.CAPTURE.REFUNDED') {
          await supabaseAdmin
            .from('payments')
            .update({ status: 'failed', raw: { event: type } })
            .eq('paypal_order_id', orderId)
          return new Response('ok')
        }

        if (type === 'CHECKOUT.ORDER.APPROVED') {
          // Capture + verify through the shared path.
          const capture = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
            method: 'POST',
            body: '{}',
          })
          const cap = extractCapture(capture.data)
          if (capture.ok && cap.completed && amountMatches(cap.amount, cap.currency)) {
            await supabaseAdmin
              .from('payments')
              .update({
                status: 'paid',
                paypal_capture_id: cap.captureId ?? null,
                payer_email: cap.payerEmail ?? null,
                verified_at: new Date().toISOString(),
              })
              .eq('paypal_order_id', orderId)
          }
          return new Response('ok')
        }

        return new Response('ok')
      },
    },
  },
})
