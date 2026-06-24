import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { amount, currency = 'INR' } = await req.json()

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    if (!keyId || !keySecret) return new Response(JSON.stringify({ error: 'Razorpay not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const basicAuth = btoa(`${keyId}:${keySecret}`)
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${basicAuth}` },
      body: JSON.stringify({ amount, currency, receipt: `receipt_${user.id}_${Date.now()}` })
    })

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text()
      return new Response(JSON.stringify({ error: 'Razorpay order failed', details: errBody }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const order = await rzpRes.json()

    await supabase.from('shop_orders').insert({
      user_id: user.id,
      email: user.email,
      total_amount: amount / 100,
      razorpay_order_id: order.id,
      payment_status: 'pending'
    })

    return new Response(JSON.stringify({ id: order.id, amount: order.amount, currency: order.currency }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
