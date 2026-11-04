-- =============================================================================
-- Migration: Validação Oficial de CPF (Módulo 11) na Tabela patients
-- =============================================================================

-- 1. Função IMMUTABLE para validar os 2 dígitos verificadores do CPF (Receita Federal)
CREATE OR REPLACE FUNCTION public.is_valid_cpf(p_cpf TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_digits TEXT;
  v_sum INT;
  v_rem INT;
  i INT;
BEGIN
  IF p_cpf IS NULL THEN
    RETURN FALSE;
  END IF;

  v_digits := regexp_replace(p_cpf, '\D', '', 'g');

  -- Deve conter exatamente 11 dígitos
  IF length(v_digits) <> 11 THEN
    RETURN FALSE;
  END IF;

  -- Rejeita sequências de dígitos todos iguais (00000000000 a 99999999999)
  IF v_digits ~ '^(\d)\1{10}$' THEN
    RETURN FALSE;
  END IF;

  -- Cálculo do 1º dígito verificador
  v_sum := 0;
  FOR i IN 1..9 LOOP
    v_sum := v_sum + (substring(v_digits FROM i FOR 1)::INT * (11 - i));
  END LOOP;
  v_rem := (v_sum * 10) % 11;
  IF v_rem = 10 OR v_rem = 11 THEN
    v_rem := 0;
  END IF;
  IF v_rem <> substring(v_digits FROM 10 FOR 1)::INT THEN
    RETURN FALSE;
  END IF;

  -- Cálculo do 2º dígito verificador
  v_sum := 0;
  FOR i IN 1..10 LOOP
    v_sum := v_sum + (substring(v_digits FROM i FOR 1)::INT * (12 - i));
  END LOOP;
  v_rem := (v_sum * 10) % 11;
  IF v_rem = 10 OR v_rem = 11 THEN
    v_rem := 0;
  END IF;
  IF v_rem <> substring(v_digits FROM 11 FOR 1)::INT THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- 2. Atualizar trigger de pacientes para validar o CPF e padronizar no formato 000.000.000-00
CREATE OR REPLACE FUNCTION public.trfn_normalize_patient_cpf()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_digits TEXT;
BEGIN
  IF NEW.cpf IS NOT NULL THEN
    NEW.cpf := btrim(NEW.cpf);
    v_digits := regexp_replace(NEW.cpf, '\D', '', 'g');

    IF v_digits = '' THEN
      NEW.cpf := NULL;
    ELSE
      -- Valida o CPF sempre que for um novo cadastro ou quando o CPF for alterado
      IF TG_OP = 'INSERT' OR NEW.cpf IS DISTINCT FROM OLD.cpf THEN
        IF NOT public.is_valid_cpf(v_digits) THEN
          RAISE EXCEPTION 'CPF inválido (%). Informe um CPF válido com 11 dígitos ou deixe o campo em branco.', NEW.cpf
            USING ERRCODE = '23514';
        END IF;
      END IF;

      -- Padroniza a formatação como 000.000.000-00 quando tiver 11 dígitos
      IF length(v_digits) = 11 THEN
        NEW.cpf := substring(v_digits FROM 1 FOR 3) || '.' ||
                   substring(v_digits FROM 4 FOR 3) || '.' ||
                   substring(v_digits FROM 7 FOR 3) || '-' ||
                   substring(v_digits FROM 10 FOR 2);
      END IF;
    END IF;
  END IF;

  IF NEW.state IS NULL OR btrim(NEW.state) = '' THEN
    NEW.state := 'TO';
  END IF;

  RETURN NEW;
END;
$$;

