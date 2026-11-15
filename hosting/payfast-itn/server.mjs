import { createServer } from 'node:http'

export function createItnServer({ receiverUrl, fetcher = fetch, timeout = 20_000 }) {
  const target = new URL(receiverUrl)
  if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Receiver must use HTTPS')
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ service: 'TradeNest PayFast ITN', status: 'ok' }))
      return
    }
    if (req.url !== '/itn') { res.writeHead(404); res.end('Not found'); return }
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); res.end('POST required'); return }
    if (!req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      res.writeHead(415); res.end('Form notification required'); return
    }
    try {
      const chunks = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 32_768) { res.writeHead(413); res.end('Too large'); return }
        chunks.push(chunk)
      }
      // Relay the original bytes. Cloud verifies the signature, merchant,
      // provider validation and stored amount before updating any payment.
      const response = await fetcher(target, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: Buffer.concat(chunks), redirect: 'error', signal: AbortSignal.timeout(timeout),
      })
      res.writeHead(response.status === 200 ? 200 : response.status >= 500 ? 503 : 400)
      res.end(response.status === 200 ? 'ok' : 'Notification not accepted')
    } catch {
      console.error('TradeNest ITN receiver unavailable; notification must be retried')
      res.writeHead(503); res.end('Please retry')
    }
  })
}