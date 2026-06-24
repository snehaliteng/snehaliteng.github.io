import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/crypto/mod.ts'

serve(async (req) => {
  try {
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
    if (!webhookSecret) return new Response(JSON.stringify({ error: 'Webhook not configured' }), { status: 500 })

    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature') || ''

    const expectedSig = await createHmac('sha256', webhookSecret).update(body).toString()
    if (expectedSig !== signature) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
    }

    const event = JSON.parse(body)
    if (event.event !== 'payment.captured') {
      return new Response(JSON.stringify({ status: 'ignored' }), { status: 200 })
    }

    const payment = event.payload.payment.entity
    const razorpayOrderId = payment.order_id
    const razorpayPaymentId = payment.id

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order } = await supabase.from('shop_orders')
      .select('*')
      .eq('razorpay_order_id', razorpayOrderId)
      .single()

    if (!order) return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 })

    await supabase.from('shop_orders')
      .update({ payment_status: 'success', razorpay_payment_id: razorpayPaymentId, transaction_id: razorpayPaymentId })
      .eq('id', order.id)

    const { data: cart } = await supabase.from('shop_cart')
      .select('*, shop_products(*)')
      .eq('user_id', order.user_id)

    if (cart?.length) {
      const items = cart.map(c => ({
        order_id: order.id,
        product_id: c.product_id,
        title: c.shop_products?.title || 'Unknown',
        price: c.shop_products?.price || 0,
        pdf_url: c.shop_products?.pdf_url || ''
      }))
      await supabase.from('shop_order_items').insert(items)
      await supabase.from('shop_cart').delete().eq('user_id', order.user_id)
    }

    const userEmail = order.email
    if (userEmail) {
      const pdfLinks = cart?.map(c => c.shop_products?.pdf_url).filter(Boolean) || []
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-pdf-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({ email: userEmail, pdf_urls: pdfLinks, order_id: order.id })
      })
    }

    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
