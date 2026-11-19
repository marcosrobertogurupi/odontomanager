import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

/**
 * Média real da nota de satisfação (patients.satisfaction_score) da clínica.
 * Retorna null enquanto carrega ou quando não há pacientes com nota.
 */
export function useAverageSatisfaction(tenantId: string | undefined): number | null {
  const [average, setAverage] = useState<number | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setAverage(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('satisfaction_score')
        .eq('tenant_id', tenantId);

      if (cancelled) return;
      if (error) {
        console.error('Erro ao calcular satisfação média:', error);
        setAverage(null);
        return;
      }

      const scores = (data || [])
        .map((p: { satisfaction_score: number | null }) => p.satisfaction_score)
        .filter((s): s is number => s !== null && s !== undefined)
        .map(Number);

      setAverage(scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return average;
}
