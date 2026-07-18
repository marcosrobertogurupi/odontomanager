import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

serve(async (req) => {
  try {
    const body = await req.json()
    const { event, subscription: asaasSubId } = body

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const { data: subData } = await supabaseClient
        .from('subscriptions')
        .select('tenant_id')
        .eq('asaas_subscription_id', asaasSubId)
        .maybeSingle()

      if (subData?.tenant_id) {
        await supabaseClient
          .from('subscriptions')
          .update({ status: 'ACTIVE' })
          .eq('tenant_id', subData.tenant_id)

        await supabaseClient
          .from('tenants')
          .update({ status_assinatura: 'ativo' })
          .eq('id', subData.tenant_id)
      }
    } else if (event === 'PAYMENT_OVERDUE') {
      const { data: subData } = await supabaseClient
        .from('subscriptions')
        .select('tenant_id')
        .eq('asaas_subscription_id', asaasSubId)
        .maybeSingle()

      if (subData?.tenant_id) {
        await supabaseClient
          .from('subscriptions')
          .update({ status: 'OVERDUE' })
          .eq('tenant_id', subData.tenant_id)

        await supabaseClient
          .from('tenants')
          .update({ status_assinatura: 'inadimplente' })
          .eq('id', subData.tenant_id)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    })
  }
})
