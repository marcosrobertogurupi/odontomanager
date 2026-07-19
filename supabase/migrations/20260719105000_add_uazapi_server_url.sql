-- Adicionar coluna para a URL customizada do servidor UAZAPI por tenant
ALTER TABLE public.tenant_integrations 
  ADD COLUMN IF NOT EXISTS uazapi_server_url TEXT;
