import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Tratar requisições OPTIONS (CORS Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json()
    const { tenant_id, phone, message, channel = 'whatsapp' } = body

    if (!tenant_id || !phone || !message) {
      throw new Error("Parâmetros inválidos: tenant_id, phone e message são obrigatórios.")
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar configurações de integração para este tenant
    const { data: integration, error } = await supabaseClient
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tenant_id)
      .maybeSingle()

    if (error) throw error

    let resData;

    if (channel === 'sms') {
      // Envio via Twilio (SMS com fallback para chaves globais)
      const twilioAccountSid = integration?.twilio_account_sid || Deno.env.get('TWILIO_ACCOUNT_SID')
      const twilioAuthToken = integration?.twilio_auth_token || Deno.env.get('TWILIO_AUTH_TOKEN')
      const twilioFromNumber = integration?.twilio_from_number || Deno.env.get('TWILIO_FROM_NUMBER')

      if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
        throw new Error("Serviço de SMS (Twilio) não configurado para esta clínica nem no servidor.")
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`
      const basicAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`)

      const payload = new URLSearchParams()
      payload.append('To', phone)
      payload.append('From', twilioFromNumber)
      payload.append('Body', message)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`
        },
        body: payload.toString()
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erro na API Twilio SMS: ${response.status} - ${errorText}`)
      }

      resData = await response.json()
    } else {
      // Envio padrão via UAZAPI (WhatsApp)
      if (!integration || !integration.uazapi_token) {
        throw new Error("Token do UAZAPI não configurado para este tenant.")
      }

      const serverUrl = integration.uazapi_server_url || 'https://api.uazapi.com'
      const cleanServerUrl = serverUrl.replace(/\/$/, '')
      const url = `${cleanServerUrl}/send/text`

      let cleanNumber = phone.replace(/\D/g, '')
      if (cleanNumber.length === 10 || cleanNumber.length === 11) {
        cleanNumber = '55' + cleanNumber
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': integration.uazapi_token
        },
        body: JSON.stringify({
          number: cleanNumber,
          text: message
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Erro na API UAZAPI: ${response.status} - ${errorText}`)
      }

      resData = await response.json()
    }

    return new Response(JSON.stringify({ success: true, data: resData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
