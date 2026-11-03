export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const trimmed = dateStr.trim();
  // Se for apenas data no formato YYYY-MM-DD, formata diretamente sem conversão de fuso horário (UTC)
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}/${month}/${year}`;
  }
  // Para datas ISO com horário (ex: 2026-08-03T12:00:00Z)
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR');
}
