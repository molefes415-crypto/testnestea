/**
 * PayFast (payfast.co.za) server helpers.
 *
 * Credentials and the optional passphrase never reach the browser: the client
 * asks the server for a signed field set, then POSTs it to PayFast.
 * Docs: https://developers.payfast.co.za/docs
 */

export const PAYFAST_PRODUCT = {
  name: 'TradeNest EA',
  item_name: 'TradeNest EA Subscription',
  item_description: 'Monthly access to TradeNest EA',
  amount: '350.00', // ZAR per month
  currency: 'ZAR',
  frequency: '3', // 3 = monthly
  cycles: '0', // 0 = until cancelled
}

export function payfastConfig() {
  const sandbox = String(process.env['PAYFAST_ENV'] || '').toLowerCase() === 'sandbox'
  return {
    sandbox,
    merchantId: process.env['PAYFAST_MERCHANT_ID'] || '24791875',
    merchantKey: process.env['PAYFAST_MERCHANT_KEY'] || '',
    passphrase: process.env['PAYFAST_PASSPHRASE'] || '',
    processUrl: sandbox
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process',
    validateUrl: sandbox
      ? 'https://sandbox.payfast.co.za/eng/query/validate'
      : 'https://www.payfast.co.za/eng/query/validate',
  }
}

/** PayFast encodes with PHP's urlencode (spaces as '+', uppercase hex). */
function pfEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+').replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase())
}

/**
 * MD5 signature over the fields in the given order (PayFast requirement:
 * the order of the POSTed fields, not alphabetical), plus the passphrase.
 */
export async function payfastSignature(
  fields: Array<[string, string]>,
  passphrase: string,
): Promise<string> {
  const parts = fields
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `${k}=${pfEncode(String(v).trim())}`)
  if (passphrase) parts.push(`passphrase=${pfEncode(passphrase.trim())}`)
  return md5(parts.join('&'))
}

/** ITN signature: same rule, but the incoming `signature` field is excluded. */
export async function payfastItnSignature(
  ordered: Array<[string, string]>,
  passphrase: string,
): Promise<string> {
  return payfastSignature(
    ordered.filter(([k]) => k !== 'signature'),
    passphrase,
  )
}

/** Ask PayFast to confirm the ITN payload really came from them. */
export async function payfastValidate(rawBody: string): Promise<boolean> {
  try {
    const { validateUrl } = payfastConfig()
    const r = await fetch(validateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: rawBody,
    })
    const text = (await r.text()).trim().toUpperCase()
    return r.ok && text.startsWith('VALID')
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Minimal MD5 (no Node crypto md5 guarantee on the Worker runtime).
// ---------------------------------------------------------------------------
function md5(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const words: number[] = []
  for (let i = 0; i < bytes.length; i++) words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << ((i % 4) << 3))
  words[bytes.length >> 2] = (words[bytes.length >> 2] || 0) | (0x80 << ((bytes.length % 4) << 3))
  const bitLen = bytes.length * 8
  const nBlocks = (((bitLen + 64) >>> 9) << 4) + 16
  for (let i = words.length; i < nBlocks; i++) words[i] = words[i] || 0
  for (let i = 0; i < nBlocks; i++) words[i] = words[i] || 0
  words[nBlocks - 2] = bitLen

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ]
  const K: number[] = []
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476
  const rot = (x: number, c: number) => (x << c) | (x >>> (32 - c))

  for (let i = 0; i < nBlocks; i += 16) {
    let A = a0, B = b0, C = c0, D = d0
    for (let j = 0; j < 64; j++) {
      let F: number, g: number
      if (j < 16) { F = (B & C) | (~B & D); g = j }
      else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16 }
      else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16 }
      else { F = C ^ (B | ~D); g = (7 * j) % 16 }
      F = (F + A + K[j]! + (words[i + g] || 0)) | 0
      A = D; D = C; C = B
      B = (B + rot(F, S[j]!)) | 0
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0
  }

  const hex = (n: number) => {
    let s = ''
    for (let i = 0; i < 4; i++) s += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')
    return s
  }
  return hex(a0) + hex(b0) + hex(c0) + hex(d0)
}
