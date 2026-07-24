import { createFileRoute } from '@tanstack/react-router'

// MTAPI (mtapi.io) MT5 REST bridge — https://mt5.mtapi.io
// The client posts { action, ... } and always gets back { ok, data, error }.
// The session token returned by /ConnectEx is what we call `accountId` on the wire,
// so the front-end interface stays identical to the previous MetaApi proxy.

const MT5_BASE = 'https://mt5.mtapi.io'
const MT4_BASE = 'https://mt4.mtapi.io'
type Platform = 'mt4' | 'mt5'
const baseFor = (p?: string): string => (String(p || '').toLowerCase() === 'mt4' ? MT4_BASE : MT5_BASE)

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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } })

function mtHeaders(): Record<string, string> {
  const h: Record<string, string> = { accept: 'application/json' }
  const token = process.env.MTAPI_TOKEN
  if (token) h['Auth-Token'] = token
  return h
}

type MtParam = string | number | boolean | undefined

async function mtGet(path: string, params: Record<string, MtParam>, platform?: Platform | string) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const url = `${baseFor(platform)}${path}?${qs.toString()}`
  const resp = await fetch(url, { headers: mtHeaders() })
  const txt = await resp.text()
  let data: any = txt
  try { data = JSON.parse(txt) } catch {}
  // MTAPI returns HTTP 201 for application-level exceptions, so only 2xx
  // success codes other than 201 should be treated as a usable API result.
  return { ok: resp.ok && resp.status !== 201, status: resp.status, data, raw: txt }
}

function extractError(data: any, status: number) {
  if (typeof data === 'string') return data || `MTAPI ${status}`
  return data?.message || data?.error || data?.Message || data?.ErrorMessage || data?.exceptionMessage || data?.ExceptionMessage || `MTAPI ${status}`
}

function extractId(data: any): string | undefined {
  if (typeof data === 'string') return data.trim().replace(/^"|"$/g, '')
  return data?.id || data?.Id || data?._id || data?.token || data?.Token
}

function splitHostPort(value: string): { host: string, port: number } | null {
  const trimmed = value.trim()
  const ipv6 = trimmed.match(/^\[([^\]]+)\]:(\d{2,5})$/)
  if (ipv6) return { host: ipv6[1], port: Number(ipv6[2]) }
  const simple = trimmed.match(/^([^:]+):(\d{2,5})$/)
  if (simple) return { host: simple[1], port: Number(simple[2]) }
  return null
}

function brokerSearchTerms(server: string) {
  const clean = server.trim()
  const compact = clean.replace(/\s+/g, '')
  const root = compact.split('-')[0]
  return Array.from(new Set([compact, root].filter((term) => term.length >= 3))).slice(0, 3)
}

function accessForServer(searchData: any, server: string): string[] {
  if (!Array.isArray(searchData)) return []
  const wanted = server.trim().toLowerCase()
  for (const company of searchData) {
    const results = Array.isArray(company?.results) ? company.results : []
    const exact = results.find((result: any) => String(result?.name || '').toLowerCase() === wanted)
    if (exact && Array.isArray(exact.access)) return exact.access.filter((entry: unknown) => typeof entry === 'string')
  }
  for (const company of searchData) {
    const results = Array.isArray(company?.results) ? company.results : []
    const partial = results.find((result: any) => String(result?.name || '').toLowerCase().includes(wanted))
    if (partial && Array.isArray(partial.access)) return partial.access.filter((entry: unknown) => typeof entry === 'string')
  }
  return []
}

async function connectWithHost(login: string, password: string, host: string, port: number, platform?: string) {
  const r = await mtGet('/Connect', {
    user: login,
    password,
    host,
    port,
    connectTimeoutSeconds: 45,
    downloadOrderHistory: false,
  }, platform)
  if (!r.ok) return { ok: false as const, error: extractError(r.data, r.status) }
  const id = extractId(r.data)
  if (!id || id.length < 8) return { ok: false as const, error: extractError(r.data, r.status) || 'MTAPI did not return a session id.' }
  return { ok: true as const, id }
}

async function connect(login: string, password: string, server: string, platform?: string) {
  const normalizedServer = server.trim()
  const hostPort = splitHostPort(normalizedServer)
  const errors: string[] = []

  if (hostPort) {
    const direct = await connectWithHost(login, password, hostPort.host, hostPort.port, platform)
    if (direct.ok) return direct
    errors.push(direct.error)
  } else {
    const byServer = await mtGet('/ConnectEx', {
      user: login,
      password,
      server: normalizedServer,
      connectTimeoutSeconds: 45,
      downloadOrderHistory: false,
    }, platform)
    if (byServer.ok) {
      const id = extractId(byServer.data)
      if (id && id.length >= 8) return { ok: true as const, id }
      errors.push(extractError(byServer.data, byServer.status) || 'MTAPI did not return a session id.')
    } else {
      errors.push(extractError(byServer.data, byServer.status))
    }
  }

  if (!hostPort) {
    for (const term of brokerSearchTerms(normalizedServer)) {
      const search = await mtGet('/Search', { company: term }, platform)
      if (!search.ok) {
        errors.push(extractError(search.data, search.status))
        continue
      }

      const access = accessForServer(search.data, normalizedServer).slice(0, 8)
      for (const entry of access) {
        const gateway = splitHostPort(entry)
        if (!gateway) continue
        const viaGateway = await connectWithHost(login, password, gateway.host, gateway.port, platform)
        if (viaGateway.ok) return viaGateway
        errors.push(viaGateway.error)
      }
    }
  }

  const uniqueErrors = Array.from(new Set(errors.filter(Boolean)))
  return {
    ok: false as const,
    error: uniqueErrors[0] || 'MTAPI could not connect. Check the login, password, and exact broker server name.',
  }
}

export const Route = createFileRoute('/api/public/mtapi-trade')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        let body: any
        try { body = await request.json() } catch { return json(400, { ok: false, error: 'Invalid JSON' }) }

        const { action, platform } = body || {}

        if (action === 'provision') {
          const { login, password, server } = body
          if (!login || !password || !server) return json(400, { ok: false, error: 'login, password, server required' })
          const r = await connect(String(login), String(password), String(server), platform)
          if (!r.ok) return json(502, { ok: false, error: r.error })

          const acc = await mtGet('/AccountSummary', { id: r.id }, platform)
          return json(200, { ok: true, accountId: r.id, platform: (String(platform || '').toLowerCase() === 'mt4' ? 'mt4' : 'mt5'), account: acc.ok ? acc.data : null })
        }

        const { accountId } = body || {}
        if (!accountId) return json(400, { ok: false, error: 'accountId required' })

        if (action === 'account') {
          const r = await mtGet('/AccountSummary', { id: accountId }, platform)
          return json(r.ok ? 200 : 502, {
            ok: r.ok, data: r.data,
            error: r.ok ? undefined : extractError(r.data, r.status),
          })
        }

        if (action === 'positions') {
          const r = await mtGet('/OpenedOrders', { id: accountId }, platform)
          return json(r.ok ? 200 : 502, {
            ok: r.ok, data: r.data,
            error: r.ok ? undefined : extractError(r.data, r.status),
          })
        }

        if (action === 'status') {
          const r = await mtGet('/ConnectionStatus', { id: accountId }, platform)
          return json(r.ok ? 200 : 502, {
            ok: r.ok, data: r.data,
            error: r.ok ? undefined : extractError(r.data, r.status),
          })
        }

        if (action === 'disconnect') {
          const r = await mtGet('/Disconnect', { id: accountId }, platform)
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

          const r = await mtGet('/OrderSendSafe', params, platform)
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
