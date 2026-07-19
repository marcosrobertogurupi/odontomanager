import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function get_today_agenda(supabaseClient: any) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data, error } = await supabaseClient
    .from('appointments')
    .select('id, start_time, end_time, status, room, notes, patient:patients(name), professional:profiles(name)')
    .gte('start_time', todayStart.toISOString())
    .lte('start_time', todayEnd.toISOString())
    .order('start_time', { ascending: true });

  if (error) throw error;
  return { appointments: data };
}

async function get_financial_summary(supabaseClient: any, start_date: string, end_date: string) {
  const { data, error } = await supabaseClient
    .from('transactions')
    .select('type, amount')
    .gte('date', start_date)
    .lte('date', end_date);

  if (error) throw error;

  const summary = (data || []).reduce((acc: any, curr: any) => {
    const val = Number(curr.amount);
    if (curr.type === 'income') {
      acc.receitas += val;
    } else if (curr.type === 'expense') {
      acc.despesas += val;
    }
    return acc;
  }, { receitas: 0, despesas: 0 });

  summary.saldo = summary.receitas - summary.despesas;
  return summary;
}

async function get_waiting_patients(supabaseClient: any) {
  const { data, error } = await supabaseClient
    .from('clinic_flow')
    .select('id, status, appointment:appointments(room, patient:patients(name), professional:profiles(name))')
    .eq('status', 'waiting');

  if (error) throw error;
  return { waiting_patients: data };
}

async function send_patient_message(
  supabaseClient: any,
  tenantId: string,
  senderId: string,
  senderName: string,
  patientName: string,
  message: string,
  channel: string,
  authHeader: string
) {
  // 1. Localizar paciente
  const { data: patient, error: patientError } = await supabaseClient
    .from('patients')
    .select('id, name, phone')
    .eq('tenant_id', tenantId)
    .ilike('name', `%${patientName}%`)
    .limit(1)
    .maybeSingle();

  if (patientError || !patient) {
    return { error: `Paciente '${patientName}' não encontrado.` };
  }

  const phone = patient.phone;
  if (!phone) {
    return { error: `Paciente '${patient.name}' não possui telefone cadastrado.` };
  }

  // 2. Chamar a Edge Function send-message
  const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-message`;
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        phone,
        message,
        channel
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return { error: `Erro no envio da mensagem: ${errText}` };
    }
  } catch (err: any) {
    return { error: `Falha de rede ao disparar mensagem: ${err.message || err}` };
  }

  // 3. Gravar no histórico de chat do paciente
  let chatId: string;
  const { data: existingChat } = await supabaseClient
    .from('zai_chats')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('patient_id', patient.id)
    .maybeSingle();

  if (existingChat) {
    chatId = existingChat.id;
  } else {
    const { data: newChat, error: createError } = await supabaseClient
      .from('zai_chats')
      .insert({
        tenant_id: tenantId,
        type: 'patient',
        title: `${patient.name} (Paciente)`,
        patient_id: patient.id
      })
      .select('id')
      .single();
    
    if (createError || !newChat) {
      return { error: `Erro ao criar canal de chat para o paciente.` };
    }
    chatId = newChat.id;
  }

  await supabaseClient
    .from('zai_messages')
    .insert({
      chat_id: chatId,
      tenant_id: tenantId,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: 'staff',
      text: `[${channel === 'sms' ? 'SMS' : 'WhatsApp'} via IA Zai] ${message}`
    });

  return { success: true, message: `Mensagem enviada com sucesso para ${patient.name} via ${channel}.` };
}

serve(async (req) => {
  // Tratar requisições OPTIONS (CORS Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Obter dados do usuário autenticado
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token do usuário inválido: " + userError?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401
      });
    }

    // Buscar perfil do usuário para determinar o tenant_id ativo e o nome do remetente
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tenant_id, name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.tenant_id) {
      return new Response(JSON.stringify({ error: "Perfil ou Tenant não encontrado para o usuário: " + profileError?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const tenantId = profile.tenant_id;
    const senderName = profile.name;

    const body = await req.json();
    let { message, chat_id } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: "O campo 'message' é obrigatório" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Se chat_id não vier, buscar chat existente de IA ou criar um novo para o usuário
    if (!chat_id) {
      const { data: existingChat, error: findError } = await supabaseClient
        .from('zai_chats')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('type', 'zai_assistant')
        .eq('created_by', user.id)
        .maybeSingle();

      if (existingChat) {
        chat_id = existingChat.id;
      } else {
        const { data: newChat, error: createError } = await supabaseClient
          .from('zai_chats')
          .insert({
            tenant_id: tenantId,
            type: 'zai_assistant',
            title: 'Zai AI Assistente',
            created_by: user.id
          })
          .select('id')
          .single();

        if (createError || !newChat) {
          return new Response(JSON.stringify({ error: "Falha ao criar chat do assistente: " + createError?.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500
          });
        }
        chat_id = newChat.id;
      }
    }

    // Salvar mensagem do usuário
    const { error: insertError } = await supabaseClient
      .from('zai_messages')
      .insert({
        chat_id: chat_id,
        tenant_id: tenantId,
        sender_id: user.id,
        sender_name: senderName,
        sender_role: 'staff',
        text: message
      });

    if (insertError) {
      return new Response(JSON.stringify({ error: "Falha ao salvar mensagem do usuário: " + insertError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      });
    }

    // Carregar histórico recente de mensagens do chat (últimas 20)
    const { data: messagesHistory, error: historyError } = await supabaseClient
      .from('zai_messages')
      .select('sender_role, text')
      .eq('chat_id', chat_id)
      .order('created_at', { ascending: true })
      .limit(20);

    if (historyError) {
      return new Response(JSON.stringify({ error: "Falha ao carregar histórico: " + historyError.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      });
    }

    // Mapear histórico para o formato aceito pela API do Gemini (user/model)
    const geminiContents = (messagesHistory || []).map((msg: any) => {
      const role = msg.sender_role === 'zai_assistant' ? 'model' : 'user';
      return {
        role,
        parts: [{ text: msg.text }]
      };
    });

    // Buscar configurações de integração para o tenant para verificar se possui chave própria do Gemini
    const { data: integration } = await supabaseClient
      .from('tenant_integrations')
      .select('gemini_api_key, gemini_model')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const geminiApiKey = integration?.gemini_api_key || Deno.env.get('GEMINI_API_KEY');
    const geminiModel = integration?.gemini_model || Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash';

    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "Chave do Gemini (GEMINI_API_KEY) não configurada para esta clínica nem no servidor." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      });
    }

    const systemInstruction = {
      parts: [
        {
          text: `Você é o Zai, assistente virtual inteligente integrado ao software odontológico OdontoManager.
Você auxilia profissionais da clínica (dentistas, recepcionistas, proprietários) com respostas precisas em português brasileiro.
Você tem acesso a ferramentas de consulta ao banco de dados: get_today_agenda, get_financial_summary e get_waiting_patients.
Use-as para obter dados reais quando perguntado sobre agendamentos, caixa, despesas, faturamento ou sala de espera. Nunca invente dados.
Seja conciso, profissional, gentil e direto.`
        }
      ]
    };

    const tools = [
      {
        functionDeclarations: [
          {
            name: "get_today_agenda",
            description: "Retorna a lista de consultas agendadas para hoje na clínica do usuário.",
            parameters: { type: "OBJECT", properties: {} }
          },
          {
            name: "get_financial_summary",
            description: "Retorna um resumo financeiro de receitas, despesas e saldo líquido da clínica em um período.",
            parameters: {
              type: "OBJECT",
              properties: {
                start_date: { type: "STRING", description: "Data de início (YYYY-MM-DD)" },
                end_date: { type: "STRING", description: "Data de término (YYYY-MM-DD)" }
              },
              required: ["start_date", "end_date"]
            }
          },
          {
            name: "get_waiting_patients",
            description: "Retorna a lista de pacientes que estão na sala de espera agora.",
            parameters: { type: "OBJECT", properties: {} }
          },
          {
            name: "send_patient_message",
            description: "Envia uma mensagem (WhatsApp ou SMS) para um paciente da clínica pelo seu nome.",
            parameters: {
              type: "OBJECT",
              properties: {
                patient_name: { type: "STRING", description: "Nome completo ou parcial do paciente" },
                message: { type: "STRING", description: "Texto da mensagem a ser enviada" },
                channel: { type: "STRING", enum: ["whatsapp", "sms"], description: "Canal de envio (whatsapp ou sms)" }
              },
              required: ["patient_name", "message", "channel"]
            }
          }
        ]
      }
    ];

    let turn = 0;
    let replyText = "";

    while (turn < 3) {
      turn++;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiContents,
          systemInstruction,
          tools
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erro na API Gemini: ${response.status} - ${errText}`);
      }

      const resJson = await response.json();
      const candidate = resJson.candidates?.[0];
      const content = candidate?.content;
      const parts = content?.parts || [];

      // Adicionar resposta do modelo ao histórico para próximas chamadas de função
      geminiContents.push({
        role: 'model',
        parts: parts
      });

      const functionCallPart = parts.find((p: any) => p.functionCall);
      if (functionCallPart) {
        const { name, args } = functionCallPart.functionCall;
        let functionResponse: any;

        try {
          if (name === "get_today_agenda") {
            functionResponse = await get_today_agenda(supabaseClient);
          } else if (name === "get_financial_summary") {
            const { start_date, end_date } = args;
            functionResponse = await get_financial_summary(supabaseClient, start_date, end_date);
          } else if (name === "get_waiting_patients") {
            functionResponse = await get_waiting_patients(supabaseClient);
          } else if (name === "send_patient_message") {
            const { patient_name, message: msgText, channel: msgChannel } = args;
            functionResponse = await send_patient_message(supabaseClient, tenantId, user.id, senderName, patient_name, msgText, msgChannel, authHeader);
          } else {
            throw new Error(`Ferramenta desconhecida: ${name}`);
          }
        } catch (funcErr) {
          console.error(`Erro ao executar ferramenta ${name}:`, funcErr);
          functionResponse = { error: funcErr.message };
        }

        // Registrar o resultado da função
        geminiContents.push({
          role: 'function',
          parts: [
            {
              functionResponse: {
                name,
                response: functionResponse
              }
            }
          ]
        });
      } else {
        // Encontrou a resposta final em texto
        replyText = parts.map((p: any) => p.text).join('\n');
        break;
      }
    }

    if (!replyText) {
      replyText = "Desculpe, encontrei um problema ao processar seu comando.";
    }

    // Salvar resposta do Zai no histórico de mensagens
    const { error: assistantSaveError } = await supabaseClient
      .from('zai_messages')
      .insert({
        chat_id: chat_id,
        tenant_id: tenantId,
        sender_name: 'Zai',
        sender_role: 'zai_assistant',
        text: replyText
      });

    if (assistantSaveError) {
      throw new Error("Erro ao salvar resposta do Zai no banco: " + assistantSaveError.message);
    }

    return new Response(JSON.stringify({ reply: replyText, chat_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
