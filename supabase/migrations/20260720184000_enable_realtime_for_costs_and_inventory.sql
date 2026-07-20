-- Habilitar Realtime para tabelas de custos e estoque
ALTER TABLE public.custos_fixos REPLICA IDENTITY FULL;
ALTER TABLE public.parametros_custo_unidade REPLICA IDENTITY FULL;
ALTER TABLE public.insumos REPLICA IDENTITY FULL;
ALTER TABLE public.estoque_unidade REPLICA IDENTITY FULL;
ALTER TABLE public.movimentacoes_estoque REPLICA IDENTITY FULL;

DO $$
BEGIN
  -- custos_fixos
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'custos_fixos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.custos_fixos;
  END IF;

  -- parametros_custo_unidade
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'parametros_custo_unidade'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.parametros_custo_unidade;
  END IF;

  -- insumos
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'insumos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.insumos;
  END IF;

  -- estoque_unidade
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'estoque_unidade'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.estoque_unidade;
  END IF;

  -- movimentacoes_estoque
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'movimentacoes_estoque'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movimentacoes_estoque;
  END IF;
END $$;
