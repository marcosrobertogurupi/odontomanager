import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Phone, 
  MessageSquare, 
  Calendar, 
  User, 
  Sparkles,
  Smartphone,
  Video,
  Loader
} from 'lucide-react';
import styles from './ZaiONe.module.css';
import { supabase } from '../lib/supabaseClient';
import { useTenant } from '../contexts/TenantContext';

interface ZaiChat {
  id: string;
  tenant_id: string;
  type: 'patient' | 'staff' | 'zai_assistant';
  title: string;
  patient_id: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  patient?: {
    name: string;
    phone: string | null;
  } | null;
  preview?: string;
}

interface ZaiMessage {
  id: string;
  chat_id: string;
  tenant_id: string;
  sender_id: string | null;
  sender_name: string;
  sender_role: 'staff' | 'patient' | 'zai_assistant';
  text: string;
  created_at: string;
}

export default function ZaiONe() {
  const { activeTenant, user, profile } = useTenant();
  const [chats, setChats] = useState<ZaiChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ZaiMessage[]>([]);
  const [inputText, setInputText] = useState('');
  
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const messageEndRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  // Carregar chats do tenant ativo
  const fetchChats = async () => {
    if (!activeTenant || !user) return;
    try {
      setLoadingChats(true);
      const { data, error } = await supabase
        .from('zai_chats')
        .select(`
          id,
          tenant_id,
          type,
          title,
          patient_id,
          created_by,
          created_at,
          updated_at,
          patient:patients (name, phone)
        `)
        .eq('tenant_id', activeTenant.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      let formattedChats: ZaiChat[] = (data || []).map((chat: any) => ({
        ...chat,
        title: chat.type === 'patient' && chat.patient ? `${chat.patient.name} (Paciente)` : chat.title
      }));

      // Garante que exista pelo menos um chat virtual do Assistente Zai se não houver um no banco
      const hasAssistantChat = formattedChats.some(c => c.type === 'zai_assistant' && c.created_by === user.id);
      if (!hasAssistantChat) {
        const virtualChat: ZaiChat = {
          id: 'new-zai-assistant',
          tenant_id: activeTenant.id,
          type: 'zai_assistant',
          title: 'Zai AI Assistente',
          patient_id: null,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          preview: 'Olá, sou o Zai! Como posso te ajudar na gestão clínica hoje?'
        };
        formattedChats = [virtualChat, ...formattedChats];
      }

      setChats(formattedChats);

      // Definir o primeiro chat como ativo
      if (formattedChats.length > 0 && !activeChatId) {
        setActiveChatId(formattedChats[0].id);
      }
    } catch (err) {
      console.error('Erro ao buscar chats:', err);
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    if (activeTenant && user) {
      fetchChats();
    }
  }, [activeTenant, user]);

  // Carregar mensagens do chat ativo
  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeChatId) {
        setMessages([]);
        return;
      }
      if (activeChatId === 'new-zai-assistant') {
        setMessages([
          {
            id: 'welcome',
            chat_id: 'new-zai-assistant',
            tenant_id: activeTenant?.id || '',
            sender_id: null,
            sender_name: 'Zai',
            sender_role: 'zai_assistant',
            text: 'Olá, sou o Zai! Seu assistente inteligente. Posso analisar agendamentos, enviar lembretes para pacientes ou consultar movimentações. O que deseja fazer?',
            created_at: new Date().toISOString()
          }
        ]);
        return;
      }

      try {
        setLoadingMessages(true);
        const { data, error } = await supabase
          .from('zai_messages')
          .select('*')
          .eq('chat_id', activeChatId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error('Erro ao buscar mensagens:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [activeChatId, activeTenant]);

  // Assinatura Realtime para mensagens do chat ativo
  useEffect(() => {
    if (!activeChatId || activeChatId === 'new-zai-assistant') return;

    const channel = supabase
      .channel(`zai_messages:${activeChatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'zai_messages',
          filter: `chat_id=eq.${activeChatId}`,
        },
        (payload) => {
          const newMsg = payload.new as ZaiMessage;
          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Atualiza a prévia e a ordenação na barra lateral
          setChats((prevChats) => {
            return prevChats.map(c => {
              if (c.id === activeChatId) {
                return {
                  ...c,
                  preview: newMsg.text,
                  updated_at: newMsg.created_at
                };
              }
              return c;
            }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId]);

  // Rolar para a última mensagem
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Enviar mensagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeTenant || !user || !profile || !activeChatId) return;

    const textToSend = inputText;
    setInputText('');
    setSendingMessage(true);

    try {
      const activeChat = chats.find(c => c.id === activeChatId);
      if (!activeChat) return;

      if (activeChat.type === 'zai_assistant') {
        const isNew = activeChatId === 'new-zai-assistant';

        // Resposta otimista temporária do usuário no chat
        const tempMsg: ZaiMessage = {
          id: 'temp-' + Math.random(),
          chat_id: activeChatId,
          tenant_id: activeTenant.id,
          sender_id: user.id,
          sender_name: profile.name || 'Profissional',
          sender_role: 'staff',
          text: textToSend,
          created_at: new Date().toISOString()
        };
        
        // Se for conversa nova, limpa a mensagem de boas-vindas mockada antes
        if (isNew) {
          setMessages([tempMsg]);
        } else {
          setMessages(prev => [...prev, tempMsg]);
        }

        const reqBody = {
          message: textToSend,
          chat_id: isNew ? undefined : activeChatId
        };

        const { data, error } = await supabase.functions.invoke('zai-chat', {
          body: reqBody
        });

        if (error) throw error;

        if (isNew && data?.chat_id) {
          // Recarrega todos os chats reais e seleciona o ID definitivo retornado
          await fetchChats();
          setActiveChatId(data.chat_id);
        } else {
          // Adiciona resposta da IA localmente
          const aiMsg: ZaiMessage = {
            id: 'temp-ai-' + Math.random(),
            chat_id: activeChatId,
            tenant_id: activeTenant.id,
            sender_id: null,
            sender_name: 'Zai',
            sender_role: 'zai_assistant',
            text: data?.reply || '',
            created_at: new Date().toISOString()
          };
          setMessages(prev => {
            // Remove a mensagem temporária do usuário se o Realtime ainda não inseriu a real
            const filtered = prev.filter(m => !m.id.startsWith('temp-'));
            return [...filtered, aiMsg];
          });

          // Atualizar barra lateral
          setChats(prev => prev.map(c => {
            if (c.id === activeChatId) {
              return {
                ...c,
                preview: data?.reply || '',
                updated_at: new Date().toISOString()
              };
            }
            return c;
          }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
        }

      } else {
        // Chat normal (paciente/equipe): gravação síncrona direta via Supabase
        const { data: newMsg, error } = await supabase
          .from('zai_messages')
          .insert({
            chat_id: activeChatId,
            tenant_id: activeTenant.id,
            sender_id: user.id,
            sender_name: profile.name || 'Profissional',
            sender_role: 'staff',
            text: textToSend
          })
          .select()
          .single();

        if (error) throw error;

        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        setChats(prev => prev.map(c => {
          if (c.id === activeChatId) {
            return {
              ...c,
              preview: textToSend,
              updated_at: newMsg.created_at
            };
          }
          return c;
        }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
      }
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
      alert('Erro ao enviar mensagem: ' + (err.message || err));
    } finally {
      setSendingMessage(false);
    }
  };

  // WhatsApp manual com fallback gratuito
  const handleSendWhatsApp = async () => {
    if (!activeTenant || !activeChat || !activeChat.patient_id || !activeChat.patient) {
      alert("Apenas conversas de pacientes suportam envio de WhatsApp.");
      return;
    }
    const phone = activeChat.patient.phone;
    if (!phone) {
      alert("Paciente não possui telefone cadastrado.");
      return;
    }

    const defaultMsg = `Olá, ${activeChat.patient.name}! Gostaria de confirmar seu agendamento no OdontoManager.`;
    const message = prompt("Digite a mensagem do WhatsApp:", defaultMsg);
    if (!message) return;

    try {
      // Verificar se a API de WhatsApp (UAZAPI) está configurada e conectada para o tenant
      const { data: integration } = await supabase
        .from('tenant_integrations')
        .select('uazapi_instance_id, uazapi_token, whatsapp_conectado')
        .eq('tenant_id', activeTenant.id)
        .maybeSingle();

      const hasApiConfigured = integration && 
                               integration.uazapi_instance_id && 
                               integration.uazapi_token && 
                               integration.whatsapp_conectado;

      if (hasApiConfigured) {
        // Envio automatizado em segundo plano via API UAZAPI
        const { data, error } = await supabase.functions.invoke('send-message', {
          body: {
            tenant_id: activeTenant.id,
            phone,
            message,
            channel: 'whatsapp'
          }
        });

        if (error) throw error;
      } else {
        // Fallback gratuito: Redirecionamento para WhatsApp Web / App
        let cleanedPhone = phone.replace(/\D/g, '');
        if (cleanedPhone.length === 10 || cleanedPhone.length === 11) {
          cleanedPhone = '55' + cleanedPhone; // assume Brasil por padrão
        }
        const waUrl = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
      }

      // Gravar mensagem enviada no chat (seja via API ou redirecionamento)
      const { error: dbError } = await supabase
        .from('zai_messages')
        .insert({
          chat_id: activeChat.id,
          tenant_id: activeTenant.id,
          sender_id: user?.id,
          sender_name: profile?.name || 'Profissional',
          sender_role: 'staff',
          text: `[WhatsApp] ${message}`
        });

      if (dbError) throw dbError;
      
      if (hasApiConfigured) {
        alert("Mensagem enviada automaticamente via WhatsApp!");
      } else {
        alert("WhatsApp aberto para envio manual. A mensagem foi registrada no histórico.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Erro ao disparar WhatsApp: " + (err.message || err));
    }
  };

  // SMS manual
  const handleSendSMS = async () => {
    if (!activeTenant || !activeChat || !activeChat.patient_id || !activeChat.patient) {
      alert("Apenas conversas de pacientes suportam envio de SMS.");
      return;
    }
    const phone = activeChat.patient.phone;
    if (!phone) {
      alert("Paciente não possui telefone cadastrado.");
      return;
    }

    const defaultMsg = `Lembrete de consulta - OdontoManager. Confirme respondendo Sim ou Nao.`;
    const message = prompt("Digite a mensagem de SMS:", defaultMsg);
    if (!message) return;

    try {
      const { data, error } = await supabase.functions.invoke('send-message', {
        body: {
          tenant_id: activeTenant.id,
          phone,
          message,
          channel: 'sms'
        }
      });

      if (error) throw error;

      // Gravar mensagem enviada no chat
      const { error: dbError } = await supabase
        .from('zai_messages')
        .insert({
          chat_id: activeChat.id,
          tenant_id: activeTenant.id,
          sender_id: user?.id,
          sender_name: profile?.name || 'Profissional',
          sender_role: 'staff',
          text: `[SMS] ${message}`
        });

      if (dbError) throw dbError;
      alert("SMS disparado com sucesso!");
    } catch (err: any) {
      console.error(err);
      alert("Erro ao disparar SMS: " + (err.message || err));
    }
  };

  // Teleconsulta
  const handleStartCall = async () => {
    if (!activeTenant || !activeChat || !activeChat.patient_id || !activeChat.patient) {
      alert("Apenas conversas de pacientes suportam teleconsultas.");
      return;
    }
    const phone = activeChat.patient.phone;
    if (!phone) {
      alert("Paciente não possui telefone cadastrado.");
      return;
    }

    const randomToken = Math.random().toString(36).substring(2, 7);
    const roomName = `odontomanager-${activeTenant.id}-${activeChat.id}-${randomToken}`;
    const jitsiUrl = `https://meet.jit.si/${roomName}`;

    if (!confirm(`Deseja iniciar a teleconsulta? Isso gerará uma sala única do Jitsi e enviará o link ao paciente via WhatsApp.`)) {
      return;
    }

    try {
      const message = `Olá, ${activeChat.patient.name}! Sua teleconsulta com o profissional foi iniciada. Acesse a sala pelo link: ${jitsiUrl}`;

      // Verificar se a API de WhatsApp (UAZAPI) está configurada e conectada para o tenant
      const { data: integration } = await supabase
        .from('tenant_integrations')
        .select('uazapi_instance_id, uazapi_token, whatsapp_conectado')
        .eq('tenant_id', activeTenant.id)
        .maybeSingle();

      const hasApiConfigured = integration && 
                               integration.uazapi_instance_id && 
                               integration.uazapi_token && 
                               integration.whatsapp_conectado;

      if (hasApiConfigured) {
        // Enviar convite via API WhatsApp
        const { data, error } = await supabase.functions.invoke('send-message', {
          body: {
            tenant_id: activeTenant.id,
            phone,
            message,
            channel: 'whatsapp'
          }
        });

        if (error) throw error;
      } else {
        // Abrir WhatsApp Web para envio manual do convite
        let cleanedPhone = phone.replace(/\D/g, '');
        if (cleanedPhone.length === 10 || cleanedPhone.length === 11) {
          cleanedPhone = '55' + cleanedPhone;
        }
        const waUrl = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
      }

      // Salvar a mensagem no chat
      const { error: dbError } = await supabase
        .from('zai_messages')
        .insert({
          chat_id: activeChat.id,
          tenant_id: activeTenant.id,
          sender_id: user?.id,
          sender_name: profile?.name || 'Profissional',
          sender_role: 'staff',
          text: `[Teleconsulta] Link gerado: ${jitsiUrl}`
        });

      if (dbError) throw dbError;

      // Abrir teleconsulta em nova janela
      window.open(jitsiUrl, '_blank', 'width=1000,height=700');
    } catch (err: any) {
      console.error(err);
      alert("Erro ao iniciar teleconsulta: " + (err.message || err));
    }
  };

  if (loadingChats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px' }}>
        <Loader className={styles.spinner} size={32} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: '10px' }}>Carregando canais de conversa...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Coluna Esquerda: Lista de Conversas */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>Canais de Conversa</span>
        </div>
        <div className={styles.chatList}>
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className={`${styles.chatItem} ${activeChatId === chat.id ? styles.chatItemActive : ''}`}
            >
              <div className={styles.chatAvatar}>
                {chat.type === 'zai_assistant' ? <Sparkles size={20} /> : (chat.patient?.name ? chat.patient.name.substring(0, 2).toUpperCase() : chat.title.substring(0, 2).toUpperCase())}
              </div>
              <div className={styles.chatInfo}>
                <span className={styles.chatName}>{chat.title}</span>
                <span className={styles.chatPreview}>{chat.preview || 'Nenhuma mensagem'}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Coluna Direita: Conversa Ativa */}
      <div className={styles.chatWindow}>
        {activeChat ? (
          <>
            <div className={styles.windowHeader}>
              <div className={styles.headerInfo}>
                <div className={styles.chatAvatar}>
                  {activeChat.type === 'zai_assistant' ? <Sparkles size={20} /> : (activeChat.patient?.name ? activeChat.patient.name.substring(0, 2).toUpperCase() : activeChat.title.substring(0, 2).toUpperCase())}
                </div>
                <div>
                  <span className={styles.chatName}>{activeChat.title}</span>
                  <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))' }}>
                    {activeChat.type === 'zai_assistant' ? 'Assistente Virtual Integrado' : 'Conexão Segura'}
                  </p>
                </div>
              </div>

              {/* Ações Rápidas de Comunicação */}
              {activeChat.type === 'patient' && (
                <div className={styles.headerActions}>
                  <button onClick={handleSendSMS} className={styles.btnAction} title="Disparar SMS manual">
                    <Smartphone size={14} />
                    <span>SMS</span>
                  </button>
                  <button onClick={handleSendWhatsApp} className={styles.btnAction} title="Enviar WhatsApp interativo">
                    <MessageSquare size={14} />
                    <span>WhatsApp</span>
                  </button>
                  <button onClick={handleStartCall} className={styles.btnAction} style={{ backgroundColor: 'hsl(var(--primary-light))', color: 'hsl(var(--primary))' }} title="Iniciar vídeo chamada">
                    <Video size={14} />
                    <span>Teleconsulta</span>
                  </button>
                </div>
              )}
            </div>

            {/* Histórico de Mensagens */}
            <div className={styles.messageArea}>
              {loadingMessages ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Loader className={styles.spinner} size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ marginLeft: '8px' }}>Carregando mensagens...</span>
                </div>
              ) : (
                messages.map(msg => (
                  <div 
                    key={msg.id} 
                    className={`${styles.messageBubble} ${msg.sender_role === 'staff' ? styles.sent : styles.received}`}
                  >
                    <p style={{ whiteSpace: 'pre-line' }}>{msg.text}</p>
                    <div className={styles.messageTime}>
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
              <div ref={messageEndRef} />
            </div>

            {/* Input de Envio */}
            <form className={styles.inputArea} onSubmit={handleSendMessage}>
              <input 
                type="text" 
                placeholder={sendingMessage ? "Zai está pensando..." : "Digite sua mensagem ou comando..."}
                className={styles.input}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={sendingMessage}
              />
              <button type="submit" className={styles.sendBtn} disabled={sendingMessage}>
                {sendingMessage ? (
                  <Loader className={styles.spinner} size={18} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'hsl(var(--text-muted))' }}>
            Selecione uma conversa para começar
          </div>
        )}
      </div>
      
      {/* Estilos locais para o spin do Loader */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
