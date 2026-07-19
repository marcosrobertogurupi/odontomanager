# Documento de Requisitos de Produto (PRD) - OdontoManager (Versão Atualizada)

## 1. Visão Geral do Produto
O **OdontoManager** (evolução do ControleODONTO) é um Software como Serviço (SaaS) completo em nuvem voltado para a gestão de clínicas e consultórios odontológicos. O produto oferece uma interface moderna, premium, responsiva e focada em isolamento de dados multilocatário (Multi-Tenancy), facilitando a rotina de agendamentos, o controle financeiro, a gestão de estoque, o fluxo físico de pacientes na clínica e a comunicação assistida por Inteligência Artificial.

---

## 2. Arquitetura e Stack Tecnológica

O projeto é estruturado como uma aplicação moderna desacoplada:

1. **Frontend (React + Vite + TypeScript)**:
   - Interface construída com CSS nativo e componentes estilizados de forma premium (paleta HSL, cantos arredondados, efeitos de hover e micro-animações).
   - Integração direta com o Supabase via cliente JS autenticado.
   - Gerenciamento de contexto do Tenant ativo.

2. **Backend e Persistência (Supabase + PostgreSQL)**:
   - Banco de dados relacional PostgreSQL hospedado no Supabase.
   - **Isolamento Multilocatário (Multi-Tenancy)** rigoroso habilitado via Row Level Security (RLS) em todas as tabelas transacionais, baseado no vínculo de usuários e tenants na tabela `users_tenants`.
   - **Supabase Storage**: Bucket público `clinic-logos` configurado para armazenamento dos logotipos personalizados das clínicas.

3. **Funções Serverless (Supabase Edge Functions)**:
   - **`zai-chat`**: Assistente de IA integrado com a API do Google Gemini para interpretar linguagem natural, buscar dados da clínica no banco de dados e disparar mensagens automáticas ou manuais.
   - **`send-message`**: Gateway integrado para o disparo de mensagens via SMS (Twilio) ou WhatsApp (UAZAPI).

---

## 3. Funcionalidades Detalhadas

### 3.1. Arquitetura SaaS / Multi-Tenancy
- **Isolamento de Dados**: Cada clínica (Tenant) possui seus próprios dados isolados. Usuários do sistema são associados aos seus respectivos Tenants na tabela `users_tenants`.
- **Múltiplas Unidades**: O sistema suporta múltiplas filiais/unidades físicas para o mesmo Tenant. O usuário pode alternar facilmente de unidade na barra superior.
- **Branding Customizado**: Suporte ao upload do logotipo da clínica. O arquivo de imagem é armazenado em um bucket do Supabase Storage e associado ao tenant (coluna `logo_url` na tabela `tenants`), sendo exibido dinamicamente na barra lateral.

### 3.2. Agenda Clínica & Agendamentos
- **Gestão de Consultas**: Agendamento de consultas com associação de paciente, profissional, horário de início/fim, sala e observações.
- **Filtros e Visualização**: Visualização diária filtrada por unidade selecionada.
- **Fila de Espera & Check-in**: A partir da própria agenda, a recepção pode realizar o **Check-in** do paciente. Isso cria ou atualiza automaticamente o registro no painel de fluxo da clínica.

### 3.3. Painel de Fluxo na Clínica (Recepção)
- **Funil de Espera**: Acompanhamento visual dos pacientes nas seguintes etapas:
  1. **Checked In**: Paciente fez check-in na recepção.
  2. **Waiting Room**: Paciente aguardando na sala de espera.
  3. **In Consultation**: Paciente em atendimento com o dentista.
  4. **Checked Out**: Consulta finalizada e liberação do paciente.
- **Registro de Atividades**: Histórico em tempo real exibido no dashboard das movimentações recentes do dia.

### 3.4. Dashboard & Analytics Real
- **Métricas Rápidas**: Exibição da quantidade de agendados para hoje, pacientes na sala de espera, satisfação média e faturamento do dia.
- **Balanço Financeiro Semanal**: Gráfico de colunas de Entradas (Receitas) vs. Saídas (Despesas) baseado em lançamentos reais na tabela `transactions`.
- **Avisos e Comunicados Dinâmicos**: Quadro de notícias integrado ao banco de dados (tabela `announcements`), permitindo configurar avisos urgentes, novidades ou comunicados gerais por clínica ou por unidade.

### 3.5. Integrações & IA (ZaiONe)
- **Assistente Zai**: Inteligência Artificial para interagir com o profissional da clínica. Permite consultas em linguagem natural ("quais os pacientes de hoje?", "agende para amanhã").
- **Gateway UAZAPI (WhatsApp)**: Configuração de servidor customizado e token de API por Tenant para disparo de mensagens de confirmação, lembretes de consultas e links de teleconsultas diretamente no WhatsApp do paciente.
- **Twilio (SMS)**: Canal secundário para comunicação direta por SMS.
- **Teleconsultas**: Geração automática de salas de conferência únicas via Jitsi Meet com envio imediato do link de convite por WhatsApp.

---

## 4. Estrutura do Banco de Dados (Schema)

As tabelas do banco de dados incluem:

- **`tenants`**: Armazena as clínicas cadastradas, informações cadastrais (e-mail, endereço, telefone) e URL do logotipo customizado (`logo_url`).
- **`units`**: As unidades físicas ou filiais de cada clínica.
- **`profiles`**: Perfis dos profissionais e funcionários da clínica vinculados ao Auth do Supabase.
- **`users_tenants`**: Tabela de associação N:N entre perfis de usuários e seus respectivos Tenants autorizados.
- **`patients`**: Dados cadastrais dos pacientes da clínica.
- **`procedures`**: Catálogo de procedimentos odontológicos e seus preços padrão.
- **`appointments`**: Registro de consultas agendadas.
- **`clinic_flow`**: Funil de acompanhamento físico do paciente no dia da consulta (`checked_in_at`, `consultation_started_at`, `consultation_ended_at`, `status`).
- **`transactions`**: Lançamentos financeiros de entrada (receita) ou saída (despesa).
- **`announcements`**: Quadro de comunicados dinâmicos filtrados por tenant e/ou unidade.
- **`tenant_integrations`**: Credenciais de integração (UAZAPI, Twilio) de cada clínica.
- **`zai_chats`** & **`zai_messages`**: Registro de conversas e mensagens com a IA ou chats internos.
- **`insumos`**, **`estoque_unidade`**, **`compras_estoque`**, **`movimentacoes_estoque`**, **`custos_fixos`**: Gestão completa de estoque e controle de custos.

---

## 5. Próximos Passos e Roadmap
- [ ] Implementar a edição e criação de avisos diretamente pelo painel administrativo da clínica no frontend.
- [ ] Implementar o envio automático do aviso no WhatsApp (via UAZAPI) quando o paciente fizer o check-in na recepção.
- [ ] Desenvolver relatórios consolidados de faturamento mensal e comissão de profissionais baseados nos procedimentos executados.
