-- ============================================================
-- PAPELARIA: Adicionar campos e criar tabela de documentos
-- ============================================================

-- 1. Novos campos na tabela patients (identificados nos PDFs)
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'TO',
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS responsible_name TEXT,  -- para menores / responsável legal
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2); -- para cálculo de anestesia (TCLE decíduo)

-- 2. Novos campos na tabela profiles (CRO dos dentistas)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cro TEXT,
  ADD COLUMN IF NOT EXISTS specialty TEXT;

-- 3. Tabela de histórico de documentos gerados
CREATE TABLE IF NOT EXISTS generated_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  patient_id   UUID REFERENCES patients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  professional_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  unit_id      UUID REFERENCES units(id) ON DELETE SET NULL,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  content_snapshot JSONB,  -- snapshot dos dados no momento da geração
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. RLS para generated_documents
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_generated_docs" ON generated_documents
  FOR ALL TO authenticated
  USING (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_generated_documents_patient
  ON generated_documents(patient_id);

CREATE INDEX IF NOT EXISTS idx_generated_documents_tenant
  ON generated_documents(tenant_id, created_at DESC);
