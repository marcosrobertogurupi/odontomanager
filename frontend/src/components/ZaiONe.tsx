import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Phone, 
  MessageSquare, 
  Calendar, 
  User, 
  Sparkles,
  Smartphone,
  Video
} from 'lucide-react';
import styles from './ZaiONe.module.css';

interface Message {
  id: string;
  sender: 'user' | 'other';
  text: string;
  time: string;
}

interface Chat {
  id: string;
  name: string;
  avatar: string;
  preview: string;
  messages: Message[];
}

export default function ZaiONe() {
  const [chats, setChats] = useState<Chat[]>([
    {
      id: 'zai-assistant',
      name: 'Zai AI Assistente',
      avatar: '✨',
      preview: 'Olá, sou o Zai! Como posso te ajudar na gestão clínica hoje?',
      messages: [
        { id: '1', sender: 'other', text: 'Olá, sou o Zai! Seu assistente inteligente. Posso analisar agendamentos, enviar lembretes para pacientes ou consultar movimentações. O que deseja fazer?', time: '16:00' }
      ]
    },
    {
      id: 'patient-ana',
      name: 'Ana Júlia de Souza (Paciente)',
      avatar: 'AJ',
      preview: 'Poderia remarcar minha consulta de terça para quarta?',
      messages: [
        { id: '1', sender: 'other', text: 'Olá! Gostaria de confirmar se há vaga para quarta-feira no período da tarde.', time: '15:30' },
        { id: '2', sender: 'user', text: 'Olá, Ana! Vou verificar a disponibilidade da Dra. Beatriz para quarta-feira.', time: '15:35' },
        { id: '3', sender: 'other', text: 'Poderia remarcar minha consulta de terça para quarta?', time: '15:36' }
      ]
    },
    {
      id: 'staff-mariana',
      name: 'Mariana Costa (Recepção)',
      avatar: 'MC',
      preview: 'O paciente Lucas Lima acabou de chegar e fez check-in.',
      messages: [
        { id: '1', sender: 'other', text: 'Doutor, o paciente Lucas Lima acabou de chegar e fez o check-in na recepção.', time: '10:15' },
        { id: '2', sender: 'user', text: 'Perfeito, Mariana. Já estou finalizando o atendimento anterior.', time: '10:17' }
      ]
    }
  ]);

  const [activeChatId, setActiveChatId] = useState('zai-assistant');
  const [inputText, setInputText] = useState('');
  const messageEndRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId) || chats[0];

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat.messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const newMsg: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: inputText,
      time: timeStr
    };

    // Atualizar mensagens do chat atual
    setChats(prevChats => 
      prevChats.map(c => {
        if (c.id === activeChatId) {
          const updatedMsgs = [...c.messages, newMsg];
          return {
            ...c,
            preview: inputText,
            messages: updatedMsgs
          };
        }
        return c;
      })
    );

    setInputText('');

    // Resposta automática se for o Zai Assistente
    if (activeChatId === 'zai-assistant') {
      setTimeout(() => {
        const replyTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        let replyText = 'Entendido! Estou processando seu comando.';

        const lowerText = inputText.toLowerCase();
        if (lowerText.includes('agenda') || lowerText.includes('consulta')) {
          replyText = 'Entendi! Você tem 5 consultas agendadas para hoje, com a Dra. Beatriz Santos e o Dr. Thiago Oliveira.';
        } else if (lowerText.includes('financeiro') || lowerText.includes('faturamento') || lowerText.includes('caixa')) {
          replyText = 'Claro! Hoje tivemos R$ 2.380,00 em entradas e R$ 450,00 em despesas, resultando em um saldo positivo de R$ 1.930,00.';
        } else if (lowerText.includes('paciente') || lowerText.includes('espera')) {
          replyText = 'No momento, temos 1 paciente na sala de espera: Clara Nunes Dias (aguardando Dr. Thiago).';
        } else if (lowerText.includes('ajuda') || lowerText.includes('recursos')) {
          replyText = 'Posso te ajudar a:\n1. Consultar a agenda de hoje.\n2. Verificar o fluxo de pacientes.\n3. Obter um resumo do faturamento diário.';
        }

        const systemReply: Message = {
          id: Math.random().toString(),
          sender: 'other',
          text: replyText,
          time: replyTime
        };

        setChats(prevChats => 
          prevChats.map(c => {
            if (c.id === 'zai-assistant') {
              return {
                ...c,
                preview: replyText,
                messages: [...c.messages, systemReply]
              };
            }
            return c;
          })
        );
      }, 1000);
    }
  };

  const handleSendSMS = () => {
    alert(`SMS de lembrete disparado com sucesso para ${activeChat.name}!`);
  };

  const handleSendWhatsApp = () => {
    alert(`Mensagem interativa de confirmação enviada via WhatsApp para ${activeChat.name}!`);
  };

  const handleStartCall = () => {
    alert(`Iniciando teleconsulta por chamada de vídeo segura e criptografada com ${activeChat.name}. Aguardando paciente conectar...`);
  };

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
                {chat.id === 'zai-assistant' ? <Sparkles size={20} /> : chat.avatar}
              </div>
              <div className={styles.chatInfo}>
                <span className={styles.chatName}>{chat.name}</span>
                <span className={styles.chatPreview}>{chat.preview}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Coluna Direita: Conversa Ativa */}
      <div className={styles.chatWindow}>
        <div className={styles.windowHeader}>
          <div className={styles.headerInfo}>
            <div className={styles.chatAvatar}>
              {activeChat.id === 'zai-assistant' ? <Sparkles size={20} /> : activeChat.avatar}
            </div>
            <div>
              <span className={styles.chatName}>{activeChat.name}</span>
              <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))' }}>
                {activeChat.id === 'zai-assistant' ? 'Assistente Virtual Integrado' : 'Conexão Segura'}
              </p>
            </div>
          </div>

          {/* Ações Rápidas de Comunicação (ZaiONe Integrado) */}
          {activeChat.id !== 'zai-assistant' && (
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
          {activeChat.messages.map(msg => (
            <div 
              key={msg.id} 
              className={`${styles.messageBubble} ${msg.sender === 'user' ? styles.sent : styles.received}`}
            >
              <p style={{ whiteSpace: 'pre-line' }}>{msg.text}</p>
              <div className={styles.messageTime}>{msg.time}</div>
            </div>
          ))}
          <div ref={messageEndRef} />
        </div>

        {/* Input de Envio */}
        <form className={styles.inputArea} onSubmit={handleSendMessage}>
          <input 
            type="text" 
            placeholder="Digite sua mensagem ou comando para o Zai..." 
            className={styles.input}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button type="submit" className={styles.sendBtn}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
