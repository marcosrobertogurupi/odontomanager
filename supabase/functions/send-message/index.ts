import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

serve(async (req) => {
  try {
    const body = await req.json()
    const { tenant_id, phone, message } = body

    if (!tenant_id || !phone || !message) {
      throw new Error("Parâmetros inválidos: tenant_id, phone e message são obrigatórios.")
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar configurações de integração do UAZAPI para este tenant
    const { data: integration, error } = await supabaseClient
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tenant_id)
      .maybeSingle()

    if (error) throw error

    if (!integration || !integration.uazapi_instance_id || !integration.uazapi_token) {
      throw new Error("Instância do UAZAPI não configurada para este tenant.")
    }

    // UAZAPI endpoint padrão para envio de texto
    const url = `https://api.uazapi.com/instance/${integration.uazapi_instance_id}/sendMessage`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integration.uazapi_token}`
      },
      body: JSON.stringify({
        phone: phone,
        message: message
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Erro na API UAZAPI: ${response.status} - ${errorText}`)
    }

    const resData = await response.json()

    return new Response(JSON.stringify({ success: true, data: resData }), {
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
