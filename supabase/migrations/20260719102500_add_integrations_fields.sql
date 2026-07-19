-- Adicionar novas colunas para credenciais do Twilio (SMS) e Gemini (IA) por tenant
ALTER TABLE public.tenant_integrations 
  ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT,
  ADD COLUMN IF NOT EXISTS twilio_auth_token TEXT,
  ADD COLUMN IF NOT EXISTS twilio_from_number TEXT,
  ADD COLUMN IF NOT EXISTS gemini_api_key TEXT,
  ADD COLUMN IF NOT EXISTS gemini_model TEXT;
