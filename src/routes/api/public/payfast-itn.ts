import { createFileRoute } from '@tanstack/react-router'
import { payfastConfig, payfastItnSignature, payfastValidate } from '@/lib/payfast.server'
import { parsePayfastItn, payfastAmountMatches } from '@/lib/payfast-itn'
import { paymentMentorId } from '@/lib/payfast-mentor'

export const Route = createFileRoute('/api/public/payfast-itn')({
  server: {
    handlers: {
      GET: async () => new Response('TradeNest ITN receiver ready'),
      POST: async ({ request }) => {
        if (!request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
          return new Response('Unsupported notification format', { status: 415 })
        }
        let parsed: ReturnType<typeof parsePayfastItn>
        try {
          parsed = parsePayfastItn(await request.text())
        } catch {
          return new Response('Invalid notification', { status: 400 })
        }
        try {
          const { fields, data } = parsed
          const cfg = payfastConfig()
          const expected = await payfastItnSignature(fields, cfg.passphrase)
          if (data.merchant_id !== cfg.merchantId || data.signature.toLowerCase() !== expected) {
            return new Response('Notification verification failed', { status: 400 })
          }
          const validationBody = new URLSearchParams(fields.filter(([key]) => key !== 'signature')).toString()
          if (!(await payfastValidate(validationBody))) {
            return new Response('Notification validation failed', { status: 400 })
          }
          // Only a verified provider notification may access privileged payment records.
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
          const { data: existing, error: readError } = await supabaseAdmin
            .from('payments').select('id,status,amount,currency,paypal_capture_id,email,raw')
            .eq('paypal_order_id', data.m_payment_id).eq('provider', 'payfast').maybeSingle()
          if (readError) throw new Error('Payment lookup failed')
          if (!existing) return new Response('Unknown payment', { status: 400 })
          if (existing.currency !== 'ZAR' || !payfastAmountMatches(data.amount_gross, Number(existing.amount))) {
            return new Response('Payment amount mismatch', { status: 400 })
          }
          const next = data.payment_status === 'COMPLETE' ? 'paid'
            : data.payment_status === 'CANCELLED' ? 'cancelled'
            : data.payment_status === 'FAILED' ? 'failed' : 'pending'
          const raw = existing.raw && typeof existing.raw === 'object' && !Array.isArray(existing.raw) ? existing.raw : {}
          if (next === 'paid') {
            const { activateMentorPayment } = await import('@/lib/payfast-mentor.server')
            // Use stored checkout identity, not editable labels from the notification.
            await activateMentorPayment({
              payment_id: data.m_payment_id, provider_payment_id: data.pf_payment_id,
              admin_id: paymentMentorId(raw), email: existing.email,
              amount: '580.00', currency: 'ZAR', status: 'paid',
            })
          } else if (existing.status === 'paid') {
            return new Response('ok')
          }
          const { error } = await supabaseAdmin.from('payments').update({
            paypal_capture_id: data.pf_payment_id,
            status: next,
            verified_at: next === 'paid' ? new Date().toISOString() : null,
            raw: next === 'paid' ? { ...raw, mentor_activated: true } : raw,
          }).eq('id', existing.id)
          if (error) throw new Error('Payment update failed')
          return new Response('ok')
        } catch {
          console.error('[payfast-itn] notification processing unavailable; payment not acknowledged')
          return new Response('Please retry notification', { status: 503 })
        }
      },
    },
  },
})
