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
        insumo:insumos (
          id,
          nome,
          unidade_medida,
          estoque_minimo,
          status,
          tenant_id
        )
      `)
      .eq('insumo.tenant_id', tenantId);

    if (unitId) {
      query = query.eq('unit_id', unitId);
    }

    const { data: stockData, error: stockError } = await query;

    if (stockError) {
      console.warn('Não foi possível consultar estoque para alertas de sistema:', stockError.message);
    } else if (stockData && stockData.length > 0) {
      for (const item of stockData as any[]) {
        const insumo = item.insumo;
        if (!insumo || insumo.status === 'inativo') continue;

        const qtdAtual = Number(item.quantidade_atual || 0);
        const qtdMinima = Number(insumo.estoque_minimo || 0);

        // Se o estoque atual for menor ou igual ao mínimo
        if (qtdAtual <= qtdMinima) {
          const title = `Estoque Baixo: ${insumo.nome}`;
          const body = `O insumo "${insumo.nome}" está abaixo do estoque mínimo recomendado (Atual: ${qtdAtual} ${insumo.unidade_medida || 'un'}, Mínimo: ${qtdMinima} ${insumo.unidade_medida || 'un'}). Realize a reposição.`;

          // Verificar se já existe um aviso ativo idêntico nos últimos 3 dias
          const { data: existing } = await supabase
            .from('announcements')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('title', title)
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase
              .from('announcements')
              .insert({
                tenant_id: tenantId,
                unit_id: unitId || null,
                tag: 'Urgente',
                tag_type: 'urgent',
                title: title,
                body: body,
                is_system: true
              });
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro ao gerar avisos automáticos do sistema:', err);
  }
}
