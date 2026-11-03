import { supabase } from './supabaseClient';

/**
 * Função utilitária para verificar condições críticas da clínica e gerar
 * avisos automáticos do sistema (como insumos com estoque baixo).
 */
export async function checkAndGenerateSystemAnnouncements(tenantId: string, unitId?: string) {
  if (!tenantId) return;

  try {
    // 1. Verificar insumos com estoque baixo ou zerado
    let query = supabase
      .from('estoque_unidade')
      .select(`
        quantidade_atual,
        insumo:insumos!inner (
          id,
          nome,
          unidade_medida,
          estoque_minimo,
          ativo,
          tenant_id
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('insumo.ativo', true);

    if (unitId) {
      query = query.eq('unit_id', unitId);
    }

    const { data: stockData, error: stockError } = await query;

    if (stockError) {
      console.warn('Não foi possível consultar estoque para alertas de sistema:', stockError.message);
    } else if (stockData && stockData.length > 0) {
      // Filtrar itens abaixo do estoque mínimo em memória
      const lowStockCandidates: { title: string; body: string }[] = [];

      for (const item of stockData as any[]) {
        const insumo = item.insumo;
        if (!insumo || insumo.ativo === false) continue;

        const qtdAtual = Number(item.quantidade_atual || 0);
        const qtdMinima = Number(insumo.estoque_minimo || 0);

        if (qtdAtual <= qtdMinima) {
          lowStockCandidates.push({
            title: `Estoque Baixo: ${insumo.nome}`,
            body: `O insumo "${insumo.nome}" está abaixo do estoque mínimo recomendado (Atual: ${qtdAtual} ${insumo.unidade_medida || 'un'}, Mínimo: ${qtdMinima} ${insumo.unidade_medida || 'un'}). Realize a reposição.`
          });
        }
      }

      if (lowStockCandidates.length > 0) {
        // Evitar N+1: buscar todos os títulos já existentes em uma única consulta usando .in()
        const candidateTitles = lowStockCandidates.map(c => c.title);
        const { data: existingAnnouncements } = await supabase
          .from('announcements')
          .select('title')
          .eq('tenant_id', tenantId)
          .in('title', candidateTitles);

        const existingTitleSet = new Set((existingAnnouncements || []).map((a: any) => a.title));
        const newAnnouncements = lowStockCandidates
          .filter(c => !existingTitleSet.has(c.title))
          .map(c => ({
            tenant_id: tenantId,
            unit_id: unitId || null,
            tag: 'Urgente',
            tag_type: 'urgent',
            title: c.title,
            body: c.body,
            is_system: true
          }));

        // Inserção em lote (Batch Insert)
        if (newAnnouncements.length > 0) {
          await supabase.from('announcements').insert(newAnnouncements);
        }
      }
    }
  } catch (err) {
    console.error('Erro ao gerar avisos automáticos do sistema:', err);
  }
}
