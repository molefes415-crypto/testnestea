import { createFileRoute } from '@tanstack/react-router'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Content-Type': 'application/json',
}

// Existing mentor-scoped portal access contracts.
const UPSTREAMS = [
  'https://tradenestea.com/admin/api/check_subscription.php',
  'https://tradenestea.com/admin/api/check-subscription.php',
  'https://tradenestea.com/admin/api/subscription_status.php',
]

async function checkUpstream(adminId: string, email: string): Promise<{ active: boolean; source?: string; raw?: unknown }> {
  for (const base of UPSTREAMS) {
    try {
      const url = `${base}?admin_id=${encodeURIComponent(adminId)}&email=${encodeURIComponent(email)}`
      const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8_000) })
      if (!r.ok) continue
      const text = await r.text()
      let data: any = null
      try { data = JSON.parse(text) } catch { data = { raw: text } }
      const active =
        data?.active === true ||
        data?.status === 'active' ||
        data?.subscribed === true ||
        data?.is_active === true ||
        /"active"\s*:\s*true/i.test(text)
      if (active) return { active: true, source: base, raw: data }
    } catch {
      // try next upstream
    }
  }
  return { active: false }
}

export const Route = createFileRoute('/api/public/check-subscription')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const u = new URL(request.url)
          const adminId = (u.searchParams.get('admin_id') || '').trim()
          const email = (u.searchParams.get('email') || '').trim().toLowerCase()
          if (!/^[1-9]\d{0,9}$/.test(adminId) || Number(adminId) > 2147483647 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
            return new Response(JSON.stringify({ active: false, error: 'Valid mentor ID and email required' }), { status: 400, headers: CORS })
          }

          // The mentor portal owns access. Never grant cross-mentor access by email alone.
          const portal = await checkUpstream(adminId, email)
          if (portal.active) {
            return new Response(JSON.stringify({ active: true, via: 'portal', source: portal.source }), { status: 200, headers: CORS })
          }

          return new Response(JSON.stringify({ active: false, via: 'portal', hint: 'Waiting for verified payment activation under this mentor.' }), { status: 200, headers: CORS })
        } catch (e: any) {
          return new Response(JSON.stringify({ active: false, error: e?.message || 'server error' }), { status: 500, headers: CORS })
        }
      },
    },
  },
})
