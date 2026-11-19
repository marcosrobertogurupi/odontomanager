-- Financeiro: status de pagamento + preservação do que já foi recebido ao excluir um paciente.
--
-- Regra de negócio:
--   * Lançamento QUITADO (status = 'paid', com data de pagamento) permanece no banco para
--     consulta/auditoria mesmo depois que o paciente é excluído (patient_id vira NULL pelo
--     ON DELETE SET NULL; o nome do paciente fica guardado em patient_name).
--   * Lançamento NÃO quitado (status = 'pending') é excluído junto com o paciente.

-- 1. Colunas novas -----------------------------------------------------------------------
-- DEFAULT 'paid': tudo que já existe (e qualquer insert que não informe status, como as
-- movimentações manuais do Fluxo de Caixa) continua valendo como recebido/pago e fica protegido.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS paid_at DATE,
  ADD COLUMN IF NOT EXISTS patient_name TEXT;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check CHECK (status IN ('pending', 'paid'));

-- Lançamentos que já existiam contam como pagos, com data de pagamento = data do lançamento.
UPDATE public.transactions
   SET paid_at = date
 WHERE status = 'paid' AND paid_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_patient_pending
  ON public.transactions (patient_id)
  WHERE status = 'pending' AND patient_id IS NOT NULL;

-- 2. Mantém status e data de pagamento coerentes ---------------------------------------
--   paid    -> paid_at preenchido (se vier vazio, usa a data do lançamento)
--   pending -> paid_at sempre NULL
CREATE OR REPLACE FUNCTION public.tg_transactions_sync_paid_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' THEN
    NEW.paid_at := COALESCE(NEW.paid_at, NEW.date, CURRENT_DATE);
  ELSE
    NEW.paid_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_transactions_sync_paid_at ON public.transactions;
CREATE TRIGGER tg_transactions_sync_paid_at
  BEFORE INSERT OR UPDATE OF status, paid_at, date ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_transactions_sync_paid_at();

-- 3. Exclusão do paciente ---------------------------------------------------------------
-- Roda ANTES do DELETE em patients (e portanto antes da ação ON DELETE SET NULL da FK):
--   * apaga o que ainda não foi quitado;
--   * nos quitados, guarda o nome do paciente para a auditoria saber de quem era.
CREATE OR REPLACE FUNCTION public.tg_patients_handle_transactions_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.transactions
   WHERE patient_id = OLD.id
     AND status <> 'paid';

  UPDATE public.transactions
     SET patient_name = COALESCE(patient_name, OLD.name)
   WHERE patient_id = OLD.id
     AND status = 'paid';

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tg_patients_handle_transactions_on_delete ON public.patients;
CREATE TRIGGER tg_patients_handle_transactions_on_delete
  BEFORE DELETE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_patients_handle_transactions_on_delete();
