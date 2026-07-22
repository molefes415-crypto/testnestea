import { createFileRoute } from '@tanstack/react-router'

// MTAPI (mtapi.io) MT5 REST bridge — https://mt5.mtapi.io
// The client posts { action, ... } and always gets back { ok, data, error }.
// The session token returned by /ConnectEx is what we call `accountId` on the wire,
// so the front-end interface stays identical to the previous MetaApi proxy.

const MT_BASE = 'https://mt5.mtapi.io'

// MT5 EnOperationType (integer) — from the MTAPI swagger.
const OP_MAP: Record<string, number> = {
  BUY: 0, SELL: 1,
  BUY_LIMIT: 2, SELL_LIMIT: 3,
  BUY_STOP: 4, SELL_STOP: 5,
  ORDER_TYPE_BUY: 0, ORDER_TYPE_SELL: 1,
  ORDER_TYPE_BUY_LIMIT: 2, ORDER_TYPE_SELL_LIMIT: 3,
  ORDER_TYPE_BUY_STOP: 4, ORDER_TYPE_SELL_STOP: 5,
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } })

function mtHeaders(): Record<string, string> {
  const h: Record<string, string> = { accept: 'application/json' }
  const token = process.env.MTAPI_TOKEN
  if (token) h['Auth-Token'] = token
  return h
}

async function mtGet(path: string, params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const url = `${MT_BASE}${path}?${qs.toString()}`
  const resp = await fetch(url, { headers: mtHeaders() })
  const txt = await resp.text()
  let data: any = txt
  try { data = JSON.parse(txt) } catch {}
  return { ok: resp.ok, status: resp.status, data, raw: txt }
}

function extractError(data: any, status: number) {
  if (typeof data === 'string') return data || `MTAPI ${status}`
  return data?.message || data?.error || data?.Message || data?.ErrorMessage || `MTAPI ${status}`
}

async function connect(login: string, password: string, server: string) {
  const r = await mtGet('/ConnectEx', {
    user: login, password, server,
    connectTimeoutSeconds: 30,
  })
  if (!r.ok) return { ok: false as const, error: extractError(r.data, r.status) }
  // ConnectEx returns the session id as a bare string (sometimes JSON-quoted).
  let id: string | undefined
  if (typeof r.data === 'string') id = r.data.trim().replace(/^"|"$/g, '')
  else id = r.data?.id || r.data?.Id || r.data?._id
  if (!id || id.length < 8) return { ok: false as const, error: 'MTAPI did not return a session id.' }
  return { ok: true as const, id }
}

export const Route = createFileRoute('/api/public/mtapi-trade')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        let body: any
        try { body = await request.json() } catch { return json(400, { ok: false, error: 'Invalid JSON' }) }

        const { action } = body || {}

        if (action === 'provision') {
          const { login, password, server } = body
          if (!login || !password || !server) return json(400, { ok: false, error: 'login, password, server required' })
          const r = await connect(String(login), String(password), String(server))
          if (!r.ok) return json(502, { ok: false, error: r.error })

          // Optionally fetch account summary so the client can display balance immediately.
          const acc = await mtGet('/AccountSummary', { id: r.id })
          return json(200, { ok: true, accountId: r.id, account: acc.ok ? acc.data : null })
        }

        const { accountId } = body || {}
        if (!accountId) return json(400, { ok: false, error: 'accountId required' })

        if (action === 'account') {
          const r = await mtGet('/AccountSummary', { id: accountId })
          return json(r.ok ? 200 : 502, {
            ok: r.ok, data: r.data,
            error: r.ok ? undefined : extractError(r.data, r.status),
          })
        }

        if (action === 'positions') {
          const r = await mtGet('/OpenedOrders', { id: accountId })
          return json(r.ok ? 200 : 502, {
            ok: r.ok, data: r.data,
            error: r.ok ? undefined : extractError(r.data, r.status),
          })
        }

        if (action === 'status') {
          const r = await mtGet('/ConnectionStatus', { id: accountId })
          return json(r.ok ? 200 : 502, {
            ok: r.ok, data: r.data,
            error: r.ok ? undefined : extractError(r.data, r.status),
          })
        }

        if (action === 'disconnect') {
          const r = await mtGet('/Disconnect', { id: accountId })
          return json(r.ok ? 200 : 502, { ok: r.ok, data: r.data })
        }

        if (action === 'trade') {
          const { symbol, direction, volume, stopLoss, takeProfit, openPrice, slippage, comment = 'BOT' } = body
          if (!symbol || direction === undefined || !volume) {
            return json(400, { ok: false, error: 'symbol, direction, volume required' })
          }
          const op = OP_MAP[String(direction).toUpperCase()]
          if (op === undefined) return json(400, { ok: false, error: `Unknown direction: ${direction}` })

          const params: Record<string, string | number | undefined> = {
            id: accountId,
            symbol,
            operation: op,
            volume: Number(volume),
            price: openPrice ? Number(openPrice) : 0,
            slippage: slippage != null ? Number(slippage) : 20,
            stoploss: stopLoss ? Number(stopLoss) : 0,
            takeprofit: takeProfit ? Number(takeProfit) : 0,
            comment: String(comment).slice(0, 31),
            placedType: 0,
          }

          const r = await mtGet('/OrderSendSafe', params)
          if (!r.ok) {
            return json(502, { ok: false, data: r.data, error: extractError(r.data, r.status) })
          }
          const t = r.data || {}
          const ticket = t.ticket || t.Ticket || t.orderId || t.OrderId || t.order || t.id || null
          return json(200, { ok: true, data: { ticket, raw: t } })
        }

        return json(400, { ok: false, error: `Unknown action: ${action}` })
      },
    },
  },
})
