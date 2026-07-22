import { createFileRoute } from '@tanstack/react-router'

const MT_API = (region: string) => `https://mt-client-api-v1.${region}.agiliumtrade.ai`
const PROV_API = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai'
const REGIONS = ['new-york', 'london', 'singapore'] as const

const OP_MAP: Record<string, string> = {
  BUY: 'ORDER_TYPE_BUY', SELL: 'ORDER_TYPE_SELL',
  BUY_LIMIT: 'ORDER_TYPE_BUY_LIMIT', SELL_LIMIT: 'ORDER_TYPE_SELL_LIMIT',
  BUY_STOP: 'ORDER_TYPE_BUY_STOP', SELL_STOP: 'ORDER_TYPE_SELL_STOP',
  ORDER_TYPE_BUY: 'ORDER_TYPE_BUY', ORDER_TYPE_SELL: 'ORDER_TYPE_SELL',
  ORDER_TYPE_BUY_LIMIT: 'ORDER_TYPE_BUY_LIMIT', ORDER_TYPE_SELL_LIMIT: 'ORDER_TYPE_SELL_LIMIT',
  ORDER_TYPE_BUY_STOP: 'ORDER_TYPE_BUY_STOP', ORDER_TYPE_SELL_STOP: 'ORDER_TYPE_SELL_STOP',
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } })

async function metaFetch(token: string, url: string, init: RequestInit = {}) {
  const resp = await fetch(url, {
    ...init,
    headers: { 'auth-token': token, 'content-type': 'application/json', ...(init.headers || {}) },
  })
  const txt = await resp.text()
  let data: any = txt
  try { data = JSON.parse(txt) } catch {}
  return { ok: resp.ok, status: resp.status, data }
}

async function callRegions(token: string, path: string, init: RequestInit) {
  let last: { status: number; data: any } = { status: 0, data: null }
  for (const region of REGIONS) {
    const r = await metaFetch(token, MT_API(region) + path, init)
    if (r.ok) return { ok: true as const, status: r.status, data: r.data, region }
    last = { status: r.status, data: r.data }
    const msg = (r.data?.message || r.data?.error || '').toString().toLowerCase()
    if (!/region|not.*found|deployed/.test(msg)) break
  }
  return { ok: false as const, ...last }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function findOrCreateAccount(token: string, login: string, password: string, server: string) {
  // 1. Look for an existing account
  const list = await metaFetch(token, `${PROV_API}/users/current/accounts`)
  if (list.ok && Array.isArray(list.data)) {
    const existing = list.data.find((a: any) =>
      String(a.login) === String(login) && String(a.server).toLowerCase() === String(server).toLowerCase()
    )
    if (existing) return { ok: true, accountId: existing._id, state: existing.state, connectionStatus: existing.connectionStatus }
  }

  // 2. Create a new account (MetaApi auto-resolves broker for common servers)
  const create = await metaFetch(token, `${PROV_API}/users/current/accounts`, {
    method: 'POST',
    body: JSON.stringify({
      name: `TN-${login}`,
      type: 'cloud-g2',
      login: String(login),
      password: String(password),
      server: String(server),
      platform: 'mt5',
      magic: 0,
      application: 'MetaApi',
      keywords: [],
      reliability: 'regular',
    }),
  })
  if (!create.ok) {
    const msg = create.data?.message || create.data?.error || `Provisioning failed (${create.status})`
    return { ok: false, error: msg }
  }
  const accountId = create.data?.id || create.data?._id
  if (!accountId) return { ok: false, error: 'MetaApi did not return an accountId.' }

  // 3. Deploy
  await metaFetch(token, `${PROV_API}/users/current/accounts/${accountId}/deploy`, { method: 'POST' })
  return { ok: true, accountId, state: 'DEPLOYING' }
}

async function waitConnected(token: string, accountId: string, timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const r = await metaFetch(token, `${PROV_API}/users/current/accounts/${accountId}`)
    if (r.ok) {
      const state = r.data?.state
      const cs = r.data?.connectionStatus
      if (state === 'DEPLOYED' && cs === 'CONNECTED') return { ok: true, data: r.data }
      if (state === 'UNDEPLOYED' || state === 'DELETING') return { ok: false, error: `Account ${state}` }
    }
    await sleep(3000)
  }
  return { ok: false, error: 'Timeout waiting for broker connection (still deploying — try again in a minute).' }
}

export const Route = createFileRoute('/api/public/metaapi-trade')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      POST: async ({ request }) => {
        const token = process.env.METAAPI_TOKEN
        if (!token) return json(500, { ok: false, error: 'METAAPI_TOKEN not configured' })

        let body: any
        try { body = await request.json() } catch { return json(400, { ok: false, error: 'Invalid JSON' }) }

        const { action } = body || {}

        if (action === 'provision') {
          const { login, password, server, wait } = body
          if (!login || !password || !server) return json(400, { ok: false, error: 'login, password, server required' })
          const r = await findOrCreateAccount(token, login, password, server)
          if (!r.ok) return json(502, { ok: false, error: r.error })
          if (wait) {
            const w = await waitConnected(token, r.accountId!)
            if (!w.ok) return json(202, { ok: false, accountId: r.accountId, error: w.error, deploying: true })
            return json(200, { ok: true, accountId: r.accountId, account: w.data })
          }
          return json(200, { ok: true, accountId: r.accountId, state: r.state })
        }

        const { accountId } = body || {}
        if (!accountId) return json(400, { ok: false, error: 'accountId required' })

        if (action === 'account') {
          const r = await callRegions(token, `/users/current/accounts/${encodeURIComponent(accountId)}/account-information`, { method: 'GET' })
          return json(r.ok ? 200 : 502, { ok: r.ok, data: r.data, error: r.ok ? undefined : (r.data?.message || `MetaApi ${r.status}`) })
        }

        if (action === 'positions') {
          const r = await callRegions(token, `/users/current/accounts/${encodeURIComponent(accountId)}/positions`, { method: 'GET' })
          return json(r.ok ? 200 : 502, { ok: r.ok, data: r.data })
        }

        if (action === 'status') {
          const r = await metaFetch(token, `${PROV_API}/users/current/accounts/${accountId}`)
          return json(r.ok ? 200 : 502, { ok: r.ok, data: r.data })
        }

        if (action === 'trade') {
          const { symbol, direction, volume, stopLoss, takeProfit, openPrice, comment = 'BOT', clientId } = body
          if (!symbol || !direction || !volume) return json(400, { ok: false, error: 'symbol, direction, volume required' })
          const actionType = OP_MAP[String(direction).toUpperCase()] || 'ORDER_TYPE_BUY'
          const payload: Record<string, unknown> = {
            actionType, symbol, volume: Number(volume), comment: String(comment).slice(0, 27),
          }
          if (stopLoss) payload.stopLoss = Number(stopLoss)
          if (takeProfit) payload.takeProfit = Number(takeProfit)
          if (openPrice && /LIMIT|STOP/.test(actionType)) payload.openPrice = Number(openPrice)
          if (clientId) payload.clientId = String(clientId).slice(0, 32)

          const r = await callRegions(token, `/users/current/accounts/${encodeURIComponent(accountId)}/trade`, {
            method: 'POST', body: JSON.stringify(payload),
          })
          return json(r.ok ? 200 : 502, {
            ok: r.ok, data: r.data,
            error: r.ok ? undefined : (r.data?.message || r.data?.error || `MetaApi ${r.status}`),
          })
        }

        return json(400, { ok: false, error: `Unknown action: ${action}` })
      },
    },
  },
})
