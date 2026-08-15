import { createFileRoute } from '@tanstack/react-router'
import { payfastConfig, payfastItnSignature, payfastValidate, PAYFAST_PRODUCT } from '@/lib/payfast.server'

/**
 * PayFast ITN (Instant Transaction Notification) endpoint.
 * Configure this exact URL in the PayFast dashboard / as notify_url:
 *   https://www.tradnestea.app/api/public/payfast-itn
 *
 * Security: signature check + PayFast server-side validation + amount check.
 * Always answers 200 so PayFast does not retry forever, but only writes
 * `paid` when every check passes.
 */
export const Route = createFileRoute('/api/public/payfast-itn')({
  server: {
    handlers: {
      GET: async () => new Response('ok', { status: 200 }),
      POST: async ({ request }) => {
        const raw = await request.text()
        try {
          const params = new URLSearchParams(raw)
          const ordered: Array<[string, string]> = [...params.entries()]
          const data = Object.fromEntries(ordered)

          const cfg = payfastConfig()
          const expected = await payfastItnSignature(ordered, cfg.passphrase)
          const signatureOk = String(data['signature'] || '').toLowerCase() === expected.toLowerCase()
          const validated = await payfastValidate(raw)
          if (!signatureOk || !validated) {
            console.error('[payfast-itn] rejected', { signatureOk, validated })
            return new Response('rejected', { status: 200 })
          }

          const paymentId = String(data['m_payment_id'] || '').trim()
          const status = String(data['payment_status'] || '').toUpperCase()
          const gross = Number(data['amount_gross'] || data['amount'] || 0)
          const email = String(data['custom_str2'] || data['email_address'] || '').trim().toLowerCase()
          if (!paymentId) return new Response('ok', { status: 200 })

          const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
          const { data: existing } = await supabaseAdmin
            .from('payments')
            .select('id,status,email,user_ref')
            .eq('paypal_order_id', paymentId)
            .maybeSingle()

          // Idempotent: a second COMPLETE notification changes nothing.
          if (existing?.status === 'paid') return new Response('ok', { status: 200 })

          const amountOk = gross >= Number(PAYFAST_PRODUCT.amount) - 0.01
          const next =
            status === 'COMPLETE' && amountOk
              ? 'paid'
              : status === 'CANCELLED'
                ? 'cancelled'
                : status === 'FAILED'
                  ? 'failed'
                  : 'pending'

          const row = {
            user_ref: existing?.user_ref || String(data['custom_str1'] || email || paymentId).slice(0, 120),
            email: existing?.email || email || 'unknown@payfast',
            provider: 'payfast',
            paypal_order_id: paymentId,
            paypal_capture_id: String(data['pf_payment_id'] || '') || null,
            payer_email: email || null,
            amount: gross || Number(PAYFAST_PRODUCT.amount),
            currency: PAYFAST_PRODUCT.currency,
            status: next,
            raw: data as any,
            verified_at: next === 'paid' ? new Date().toISOString() : null,
          }
          await supabaseAdmin.from('payments').upsert(row, { onConflict: 'paypal_order_id' })

          return new Response('ok', { status: 200 })
        } catch (e: any) {
          console.error('[payfast-itn] error', e?.message)
          return new Response('ok', { status: 200 })
        }
      },
    },
  },
})
