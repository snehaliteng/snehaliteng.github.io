import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL = 'Snehal IT Eng <shop@snehaliteng.com>'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { email, pdf_urls, order_id } = await req.json()
    if (!email || !pdf_urls?.length) {
      return new Response(JSON.stringify({ error: 'Missing email or pdf_urls' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://snehaliteng.github.io'
    const links = pdf_urls.map(url => `<li><a href="${siteUrl}${url}">${url.split('/').pop()}</a></li>`).join('')
    const html = `
      <h2>Thank you for your purchase!</h2>
      <p>Order ID: <strong>${order_id}</strong></p>
      <p>Your tutorial PDFs are ready for download:</p>
      <ul>${links}</ul>
      <p style="color:#666;font-size:.85rem;">These links are for personal use only. Please do not share.</p>
      <p>— Snehal IT Eng</p>
    `

    if (!RESEND_API_KEY) {
      console.log('RESEND_API_KEY not set — email not sent')
      console.log('Would send to:', email, 'PDFs:', pdf_urls)
      return new Response(JSON.stringify({ status: 'logged', note: 'Resend not configured' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: 'Your Tutorial PDFs from Snehal IT Eng',
        html
      })
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response(JSON.stringify({ error: 'Email send failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ status: 'sent' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
