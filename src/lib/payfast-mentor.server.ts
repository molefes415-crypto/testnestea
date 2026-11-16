import { mentorActivationSchema } from './payfast-mentor'

// Call only after the original PayFast notification has passed every verification.
export async function activateMentorPayment(input: unknown) {
  const data = mentorActivationSchema.parse(input)
  const secret = process.env['PAYFAST_PORTAL_SIGNING_SECRET']
  if (!secret) throw new Error('Mentor activation signing secret is not configured')
  const body = JSON.stringify(data)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`))
  const signature = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const response = await fetch('https://tradenestea.com/admin/api/payfast_activate.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-TN-Timestamp': timestamp, 'X-TN-Signature': signature },
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error('Mentor activation unavailable')
  const result: unknown = await response.json()
  if (!result || typeof result !== 'object' || !('success' in result) || result.success !== true || !('payment_id' in result) || result.payment_id !== data.payment_id) {
    throw new Error('Mentor activation was not confirmed')
  }
}