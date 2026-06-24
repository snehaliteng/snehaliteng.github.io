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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    if (!keySecret) return new Response(JSON.stringify({ error: 'Razorpay not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', encoder.encode(keySecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`))
    const expectedSig = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('')

    if (expectedSig !== razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    await supabase.from('shop_orders')
      .update({ payment_status: 'success', razorpay_payment_id, transaction_id: razorpay_payment_id })
      .eq('razorpay_order_id', razorpay_order_id)

    const { data: order } = await supabase.from('shop_orders')
      .select('*, shop_order_items(*)')
      .eq('razorpay_order_id', razorpay_order_id)
      .single()

    return new Response(JSON.stringify({ status: 'verified', order }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
