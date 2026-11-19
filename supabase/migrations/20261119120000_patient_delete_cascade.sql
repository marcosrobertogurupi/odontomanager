-- Excluir um paciente apaga TODO o histórico vinculado a ele.
--
-- Já eram em cascata: appointments (e clinic_flow via appointment), patient_photos,
-- photo_ai_analyses e patient_cases.
-- Estavam como ON DELETE SET NULL (o registro ficava órfão, sem paciente) e passam a CASCADE:
--   * generated_documents  (orçamentos, receitas, atestados, termos...)
--   * zai_chats            (conversas do paciente; zai_messages cai junto via chat_id)
--
-- `transactions` (financeiro) fica de fora de propósito: lançamentos já recebidos devem
-- permanecer para consulta/auditoria. A regra do financeiro é tratada à parte.

DO $$
DECLARE
  alvo RECORD;
  c RECORD;
BEGIN
  FOR alvo IN
    SELECT * FROM (VALUES
      ('generated_documents'),
      ('zai_chats')
    ) AS t(tabela)
  LOOP
    -- Remove a FK atual de patient_id (qualquer que seja o nome do constraint)...
    FOR c IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
      WHERE con.contype = 'f'
        AND con.conrelid = format('public.%I', alvo.tabela)::regclass
        AND con.confrelid = 'public.patients'::regclass
        AND att.attname = 'patient_id'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', alvo.tabela, c.conname);
    END LOOP;

    -- ...e recria com CASCADE.
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE',
      alvo.tabela,
      alvo.tabela || '_patient_id_fkey'
    );
  END LOOP;
END $$;
