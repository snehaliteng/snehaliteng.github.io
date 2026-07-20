import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabaseAnon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await supabaseAnon.auth.getUser()
    if (!user || user.email !== 'snehaliteng@gmail.com') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { range = '7d' } = await req.json().catch(() => ({}))

    const now = new Date()
    let since: Date
    if (range === '24h') since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    else if (range === '30d') since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    else since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const sinceStr = since.toISOString()

    const { data: pvRows } = await supabase
      .from('site_analytics')
      .select('created_at, session_id, page_path, device_type, browser, os, event_type')
      .gte('created_at', sinceStr)
      .order('created_at', { ascending: false })
      .limit(50000)

    const rows = pvRows || []

    // Total pageviews
    const totalPV = rows.filter(r => r.event_type === 'pageview').length

    // Unique visitors (distinct session_id)
    const sessions = new Set(rows.map(r => r.session_id))
    const uniqueVisitors = sessions.size

    // Real-time active (last 5 min)
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)
    const realtimeSessions = new Set(rows.filter(r => new Date(r.created_at) > fiveMinAgo).map(r => r.session_id))

    // Daily trend
    const dailyMap: Record<string, { pv: number; uv: Set<string> }> = {}
    for (const r of rows) {
      if (r.event_type !== 'pageview') continue
      const day = r.created_at.substring(0, 10)
      if (!dailyMap[day]) dailyMap[day] = { pv: 0, uv: new Set() }
      dailyMap[day].pv++
      dailyMap[day].uv.add(r.session_id)
    }
    const dailyTrend = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, pageviews: v.pv, visitors: v.uv.size }))

    // Top pages
    const pageMap: Record<string, number> = {}
    for (const r of rows) {
      if (r.event_type !== 'pageview') continue
      pageMap[r.page_path] = (pageMap[r.page_path] || 0) + 1
    }
    const topPages = Object.entries(pageMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([path, count]) => ({ path, count }))

    // Device breakdown
    const deviceMap: Record<string, number> = {}
    for (const r of rows) {
      if (r.event_type !== 'pageview') continue
      deviceMap[r.device_type || 'unknown'] = (deviceMap[r.device_type || 'unknown'] || 0) + 1
    }
    const devices = Object.entries(deviceMap).map(([type, count]) => ({ type, count }))

    // Browser breakdown
    const browserMap: Record<string, number> = {}
    for (const r of rows) {
      if (r.event_type !== 'pageview') continue
      browserMap[r.browser || 'unknown'] = (browserMap[r.browser || 'unknown'] || 0) + 1
    }
    const browsers = Object.entries(browserMap).map(([name, count]) => ({ name, count }))

    // OS breakdown
    const osMap: Record<string, number> = {}
    for (const r of rows) {
      if (r.event_type !== 'pageview') continue
      osMap[r.os || 'unknown'] = (osMap[r.os || 'unknown'] || 0) + 1
    }
    const osList = Object.entries(osMap).map(([name, count]) => ({ name, count }))

    return new Response(JSON.stringify({
      totalPageviews: totalPV,
      uniqueVisitors,
      realtimeActive: realtimeSessions.size,
      dailyTrend,
      topPages,
      devices,
      browsers,
      os: osList,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
