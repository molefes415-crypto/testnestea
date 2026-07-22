import { createFileRoute } from '@tanstack/react-router'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Content-Type': 'application/json',
}

// Candidate upstream endpoints on the portal — first one that responds wins.
const UPSTREAMS = [
  'https://tradenestea.com/admin/api/check_subscription.php',
  'https://tradenestea.com/admin/api/check-subscription.php',
  'https://tradenestea.com/admin/api/subscription_status.php',
]

async function checkUpstream(adminId: string, email: string): Promise<{ active: boolean; source?: string; raw?: unknown }> {
  for (const base of UPSTREAMS) {
    try {
      const url = `${base}?admin_id=${encodeURIComponent(adminId)}&email=${encodeURIComponent(email)}`
      const r = await fetch(url, { headers: { accept: 'application/json' } })
      if (!r.ok) continue
      const text = await r.text()
      let data: any = null
      try { data = JSON.parse(text) } catch { data = { raw: text } }
      // Portal is authoritative — accept common truthy shapes.
      const active =
        data?.active === true ||
        data?.status === 'active' ||
        data?.subscribed === true ||
        data?.is_active === true ||
        /"active"\s*:\s*true/i.test(text)
      return { active: !!active, source: base, raw: data }
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
          if (!adminId || !email) {
            return new Response(JSON.stringify({ active: false, error: 'missing admin_id or email' }), { status: 400, headers: CORS })
          }
          const result = await checkUpstream(adminId, email)
          return new Response(JSON.stringify(result), { status: 200, headers: CORS })
        } catch (e: any) {
          return new Response(JSON.stringify({ active: false, error: e?.message || 'server error' }), { status: 500, headers: CORS })
        }
      },
    },
  },
})
