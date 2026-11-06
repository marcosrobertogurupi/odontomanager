export interface PricingTemplateMaterial {
  nome: string;
  quantidade_embalagem: number;
  quantidade_rendimento: number;
  preco_embalagem_atual: number;
  quantidade_usada_por_procedimento: number;
  numero_consultas_necessarias: number;
}

export interface PricingTemplate {
  id: string;
  nome: string;
  categoria: string;
  tempo_consulta_minutos: number;
  numero_sessoes_total: number;
  custo_material_especial: number;
  custo_terceiros_laboratorio: number;
  comissao_profissional_pct: number;
  taxa_cartao_pct: number;
  impostos_pct: number;
  margem_lucro_desejada_pct: number;
  outras_deducoes_pct: number;
  materiais: PricingTemplateMaterial[];
}

export const PLANILHA_PROCEDIMENTOS_TEMPLATES: PricingTemplate[] = [
  {
    id: 'endodontia',
    nome: 'Endodontia (Tratamento de Canal)',
    categoria: 'Endodontia',
    tempo_consulta_minutos: 60,
    numero_sessoes_total: 2,
    custo_material_especial: 0,
    custo_terceiros_laboratorio: 900,
    comissao_profissional_pct: 0,
    taxa_cartao_pct: 5.48,
    impostos_pct: 0,
    margem_lucro_desejada_pct: 40,
    outras_deducoes_pct: 0,
    materiais: [
      { nome: 'Sugador Endodôntico', quantidade_embalagem: 1, quantidade_rendimento: 20, preco_embalagem_atual: 24.20, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 2 },
      { nome: 'Sugador Descartável', quantidade_embalagem: 1, quantidade_rendimento: 40, preco_embalagem_atual: 10.60, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 2 },
      { nome: 'Fio Dental', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 8.60, quantidade_usada_por_procedimento: 0.8, numero_consultas_necessarias: 2 },
      { nome: 'Hidróxido de Cálcio P.A.', quantidade_embalagem: 1, quantidade_rendimento: 10, preco_embalagem_atual: 14.95, quantidade_usada_por_procedimento: 0.12, numero_consultas_necessarias: 2 },
      { nome: 'Lençol de Borracha', quantidade_embalagem: 1, quantidade_rendimento: 26, preco_embalagem_atual: 34.50, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 2 },
      { nome: 'Coltosol', quantidade_embalagem: 1, quantidade_rendimento: 25, preco_embalagem_atual: 21.30, quantidade_usada_por_procedimento: 0.2, numero_consultas_necessarias: 2 },
      { nome: 'Perioplak', quantidade_embalagem: 1, quantidade_rendimento: 250, preco_embalagem_atual: 28.30, quantidade_usada_por_procedimento: 10, numero_consultas_necessarias: 2 },
      { nome: 'Lima K 15-40 21mm', quantidade_embalagem: 5, quantidade_rendimento: 5, preco_embalagem_atual: 18.25, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 2 },
      { nome: 'Soda Clorada 2,5%', quantidade_embalagem: 1, quantidade_rendimento: 1, preco_embalagem_atual: 13.95, quantidade_usada_por_procedimento: 0.4, numero_consultas_necessarias: 2 },
      { nome: 'Anestésico', quantidade_embalagem: 1, quantidade_rendimento: 50, preco_embalagem_atual: 142.00, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 2 },
      { nome: 'Agulha Gengival', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 40.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 2 },
      { nome: 'Enxaguante Bucal', quantidade_embalagem: 1, quantidade_rendimento: 2000, preco_embalagem_atual: 39.90, quantidade_usada_por_procedimento: 10, numero_consultas_necessarias: 2 },
    ]
  },
  {
    id: 'dentistica',
    nome: 'Dentística (Restauração Resina)',
    categoria: 'Dentística',
    tempo_consulta_minutos: 60,
    numero_sessoes_total: 1,
    custo_material_especial: 0,
    custo_terceiros_laboratorio: 0,
    comissao_profissional_pct: 0,
    taxa_cartao_pct: 5.48,
    impostos_pct: 0,
    margem_lucro_desejada_pct: 40,
    outras_deducoes_pct: 0,
    materiais: [
      { nome: 'Sugador', quantidade_embalagem: 1, quantidade_rendimento: 40, preco_embalagem_atual: 26.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Babador Descartável', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 30.00, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 1 },
      { nome: 'Adesivo Odontológico', quantidade_embalagem: 1, quantidade_rendimento: 120, preco_embalagem_atual: 208.70, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 1 },
      { nome: 'Fio Dental', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 8.60, quantidade_usada_por_procedimento: 0.25, numero_consultas_necessarias: 1 },
      { nome: 'Anestésico', quantidade_embalagem: 1, quantidade_rendimento: 50, preco_embalagem_atual: 142.00, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 1 },
      { nome: 'Lençol de Borracha', quantidade_embalagem: 1, quantidade_rendimento: 26, preco_embalagem_atual: 34.50, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Resina Convencional', quantidade_embalagem: 1, quantidade_rendimento: 4, preco_embalagem_atual: 135.30, quantidade_usada_por_procedimento: 0.2, numero_consultas_necessarias: 1 },
      { nome: 'Resina Flow', quantidade_embalagem: 1, quantidade_rendimento: 2, preco_embalagem_atual: 33.20, quantidade_usada_por_procedimento: 0.05, numero_consultas_necessarias: 1 },
      { nome: 'Microbrush', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 15.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Gaze Estéril', quantidade_embalagem: 1, quantidade_rendimento: 500, preco_embalagem_atual: 80.00, quantidade_usada_por_procedimento: 3, numero_consultas_necessarias: 1 },
      { nome: 'Ácido Fosfórico 37%', quantidade_embalagem: 1, quantidade_rendimento: 2.5, preco_embalagem_atual: 10.00, quantidade_usada_por_procedimento: 0.05, numero_consultas_necessarias: 1 },
      { nome: 'Matriz', quantidade_embalagem: 1, quantidade_rendimento: 50, preco_embalagem_atual: 79.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Cunha de Madeira', quantidade_embalagem: 1, quantidade_rendimento: 40, preco_embalagem_atual: 45.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Enxaguante Bucal', quantidade_embalagem: 1, quantidade_rendimento: 2000, preco_embalagem_atual: 39.90, quantidade_usada_por_procedimento: 10, numero_consultas_necessarias: 1 },
      { nome: 'Agulha Gengival', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 40.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
    ]
  },
  {
    id: 'protese',
    nome: 'Prótese / Reabilitação (Moldagem & Peça)',
    categoria: 'Prótese',
    tempo_consulta_minutos: 40,
    numero_sessoes_total: 5,
    custo_material_especial: 0,
    custo_terceiros_laboratorio: 650,
    comissao_profissional_pct: 0,
    taxa_cartao_pct: 5.48,
    impostos_pct: 0,
    margem_lucro_desejada_pct: 40,
    outras_deducoes_pct: 0,
    materiais: [
      { nome: 'Enxaguante Bucal', quantidade_embalagem: 1, quantidade_rendimento: 2000, preco_embalagem_atual: 39.90, quantidade_usada_por_procedimento: 10, numero_consultas_necessarias: 5 },
      { nome: 'Babador Descartável', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 30.00, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 5 },
      { nome: 'Gaze Estéril', quantidade_embalagem: 1, quantidade_rendimento: 500, preco_embalagem_atual: 80.00, quantidade_usada_por_procedimento: 6, numero_consultas_necessarias: 5 },
      { nome: 'Hydrogum (Alginato)', quantidade_embalagem: 1, quantidade_rendimento: 453, preco_embalagem_atual: 83.00, quantidade_usada_por_procedimento: 28, numero_consultas_necessarias: 1 },
      { nome: 'Lysanda (Pasta Zinco-Enólica)', quantidade_embalagem: 1, quantidade_rendimento: 120, preco_embalagem_atual: 95.00, quantidade_usada_por_procedimento: 30, numero_consultas_necessarias: 1 },
      { nome: 'Cera 7', quantidade_embalagem: 1, quantidade_rendimento: 225, preco_embalagem_atual: 25.00, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 2 },
    ]
  },
  {
    id: 'cirurgia',
    nome: 'Cirurgia Oral / Exodontia',
    categoria: 'Cirurgia',
    tempo_consulta_minutos: 60,
    numero_sessoes_total: 1,
    custo_material_especial: 0,
    custo_terceiros_laboratorio: 0,
    comissao_profissional_pct: 0,
    taxa_cartao_pct: 9.00,
    impostos_pct: 0,
    margem_lucro_desejada_pct: 40,
    outras_deducoes_pct: 0,
    materiais: [
      { nome: 'Soro Fisiológico 250ml', quantidade_embalagem: 1, quantidade_rendimento: 250, preco_embalagem_atual: 11.20, quantidade_usada_por_procedimento: 250, numero_consultas_necessarias: 1 },
      { nome: 'Perioplak Antisséptico', quantidade_embalagem: 1, quantidade_rendimento: 250, preco_embalagem_atual: 28.30, quantidade_usada_por_procedimento: 10, numero_consultas_necessarias: 1 },
      { nome: 'Escova para Assepsia', quantidade_embalagem: 1, quantidade_rendimento: 1, preco_embalagem_atual: 3.09, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Luva Cirúrgica Estéril', quantidade_embalagem: 1, quantidade_rendimento: 1, preco_embalagem_atual: 1.89, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 1 },
      { nome: 'Kit Cirúrgico Odontológico', quantidade_embalagem: 1, quantidade_rendimento: 1, preco_embalagem_atual: 32.31, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Clorexidina 2%', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 21.24, quantidade_usada_por_procedimento: 5, numero_consultas_necessarias: 1 },
      { nome: 'Gaze Estéril', quantidade_embalagem: 1, quantidade_rendimento: 500, preco_embalagem_atual: 80.00, quantidade_usada_por_procedimento: 13, numero_consultas_necessarias: 1 },
      { nome: 'Sugador Cirúrgico', quantidade_embalagem: 1, quantidade_rendimento: 20, preco_embalagem_atual: 24.15, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Anestésico', quantidade_embalagem: 1, quantidade_rendimento: 50, preco_embalagem_atual: 142.00, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 1 },
      { nome: 'Agulha Gengival', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 40.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Lâmina de Bisturi', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 40.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Fio de Sutura', quantidade_embalagem: 1, quantidade_rendimento: 24, preco_embalagem_atual: 70.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Hemospon Esponja Hemostática', quantidade_embalagem: 1, quantidade_rendimento: 10, preco_embalagem_atual: 60.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
    ]
  },
  {
    id: 'implante',
    nome: 'Implantodontia (Implante + Temporário)',
    categoria: 'Implante',
    tempo_consulta_minutos: 90,
    numero_sessoes_total: 1,
    custo_material_especial: 0,
    custo_terceiros_laboratorio: 239.20,
    comissao_profissional_pct: 0,
    taxa_cartao_pct: 5.48,
    impostos_pct: 0,
    margem_lucro_desejada_pct: 40,
    outras_deducoes_pct: 0,
    materiais: [
      { nome: 'Implante Dentário Titânio', quantidade_embalagem: 1, quantidade_rendimento: 1, preco_embalagem_atual: 178.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Perioplak Antisséptico', quantidade_embalagem: 1, quantidade_rendimento: 250, preco_embalagem_atual: 28.30, quantidade_usada_por_procedimento: 10, numero_consultas_necessarias: 1 },
      { nome: 'Soro Fisiológico 250ml', quantidade_embalagem: 1, quantidade_rendimento: 250, preco_embalagem_atual: 11.20, quantidade_usada_por_procedimento: 250, numero_consultas_necessarias: 1 },
      { nome: 'Escova para Assepsia', quantidade_embalagem: 1, quantidade_rendimento: 1, preco_embalagem_atual: 3.09, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Luva Cirúrgica Estéril', quantidade_embalagem: 1, quantidade_rendimento: 1, preco_embalagem_atual: 1.89, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 1 },
      { nome: 'Kit Cirúrgico', quantidade_embalagem: 1, quantidade_rendimento: 1, preco_embalagem_atual: 32.31, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Clorexidina 2%', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 21.24, quantidade_usada_por_procedimento: 5, numero_consultas_necessarias: 1 },
      { nome: 'Gaze Estéril', quantidade_embalagem: 1, quantidade_rendimento: 500, preco_embalagem_atual: 80.00, quantidade_usada_por_procedimento: 13, numero_consultas_necessarias: 1 },
      { nome: 'Sugador Cirúrgico', quantidade_embalagem: 1, quantidade_rendimento: 20, preco_embalagem_atual: 24.15, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Anestésico', quantidade_embalagem: 1, quantidade_rendimento: 50, preco_embalagem_atual: 142.00, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 1 },
      { nome: 'Agulha Gengival', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 40.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Lâmina de Bisturi', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 40.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Fio de Sutura', quantidade_embalagem: 1, quantidade_rendimento: 24, preco_embalagem_atual: 70.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Componente Temporário', quantidade_embalagem: 1, quantidade_rendimento: 1, preco_embalagem_atual: 120.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
    ]
  },
  {
    id: 'periodontia',
    nome: 'Periodontia (Profilaxia / Raspagem)',
    categoria: 'Periodontia',
    tempo_consulta_minutos: 45,
    numero_sessoes_total: 1,
    custo_material_especial: 0,
    custo_terceiros_laboratorio: 0,
    comissao_profissional_pct: 0,
    taxa_cartao_pct: 5.48,
    impostos_pct: 0,
    margem_lucro_desejada_pct: 40,
    outras_deducoes_pct: 0,
    materiais: [
      { nome: 'Sugador', quantidade_embalagem: 1, quantidade_rendimento: 40, preco_embalagem_atual: 10.60, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Babador Descartável', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 30.00, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 1 },
      { nome: 'Fio Dental', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 8.60, quantidade_usada_por_procedimento: 0.4, numero_consultas_necessarias: 1 },
      { nome: 'Perioplak', quantidade_embalagem: 1, quantidade_rendimento: 250, preco_embalagem_atual: 28.30, quantidade_usada_por_procedimento: 10, numero_consultas_necessarias: 1 },
      { nome: 'Pasta Profilática', quantidade_embalagem: 1, quantidade_rendimento: 90, preco_embalagem_atual: 18.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Escova de Robson', quantidade_embalagem: 1, quantidade_rendimento: 1, preco_embalagem_atual: 4.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 1 },
      { nome: 'Gaze Estéril', quantidade_embalagem: 1, quantidade_rendimento: 500, preco_embalagem_atual: 80.00, quantidade_usada_por_procedimento: 4, numero_consultas_necessarias: 1 },
    ]
  },
  {
    id: 'clareamento-consultorio',
    nome: 'Clareamento Dental de Consultório',
    categoria: 'Estética',
    tempo_consulta_minutos: 60,
    numero_sessoes_total: 3,
    custo_material_especial: 0,
    custo_terceiros_laboratorio: 0,
    comissao_profissional_pct: 0,
    taxa_cartao_pct: 5.48,
    impostos_pct: 0,
    margem_lucro_desejada_pct: 40,
    outras_deducoes_pct: 0,
    materiais: [
      { nome: 'Sugador', quantidade_embalagem: 1, quantidade_rendimento: 40, preco_embalagem_atual: 10.60, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 3 },
      { nome: 'Babador Descartável', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 30.00, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 3 },
      { nome: 'Pasta Profilática', quantidade_embalagem: 1, quantidade_rendimento: 90, preco_embalagem_atual: 18.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 3 },
      { nome: 'Escova de Robson', quantidade_embalagem: 1, quantidade_rendimento: 1, preco_embalagem_atual: 4.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 3 },
      { nome: 'Gaze Estéril', quantidade_embalagem: 1, quantidade_rendimento: 500, preco_embalagem_atual: 80.00, quantidade_usada_por_procedimento: 6, numero_consultas_necessarias: 3 },
      { nome: 'Sugador Endodôntico', quantidade_embalagem: 1, quantidade_rendimento: 20, preco_embalagem_atual: 24.20, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 3 },
      { nome: 'Clareador HP Blue', quantidade_embalagem: 1, quantidade_rendimento: 6, preco_embalagem_atual: 350.00, quantidade_usada_por_procedimento: 1, numero_consultas_necessarias: 3 },
      { nome: 'Verniz Flúor', quantidade_embalagem: 1, quantidade_rendimento: 10, preco_embalagem_atual: 150.34, quantidade_usada_por_procedimento: 0.3, numero_consultas_necessarias: 3 },
      { nome: 'Microbrush', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 15.00, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 3 },
      { nome: 'Dessensibilizante', quantidade_embalagem: 1, quantidade_rendimento: 2.5, preco_embalagem_atual: 34.00, quantidade_usada_por_procedimento: 0.3, numero_consultas_necessarias: 3 },
      { nome: 'Enxaguante Bucal', quantidade_embalagem: 1, quantidade_rendimento: 2000, preco_embalagem_atual: 39.90, quantidade_usada_por_procedimento: 10, numero_consultas_necessarias: 3 },
    ]
  },
  {
    id: 'clareamento-caseiro',
    nome: 'Clareamento Dental Caseiro c/ Moldeiras',
    categoria: 'Estética',
    tempo_consulta_minutos: 30,
    numero_sessoes_total: 2,
    custo_material_especial: 0,
    custo_terceiros_laboratorio: 100,
    comissao_profissional_pct: 0,
    taxa_cartao_pct: 5.48,
    impostos_pct: 0,
    margem_lucro_desejada_pct: 40,
    outras_deducoes_pct: 0,
    materiais: [
      { nome: 'Hydrogum (Alginato Moldeira)', quantidade_embalagem: 1, quantidade_rendimento: 453, preco_embalagem_atual: 83.00, quantidade_usada_por_procedimento: 28, numero_consultas_necessarias: 1 },
      { nome: 'Babador Descartável', quantidade_embalagem: 1, quantidade_rendimento: 100, preco_embalagem_atual: 30.00, quantidade_usada_por_procedimento: 2, numero_consultas_necessarias: 1 },
      { nome: 'Enxaguante Bucal', quantidade_embalagem: 1, quantidade_rendimento: 2000, preco_embalagem_atual: 39.90, quantidade_usada_por_procedimento: 10, numero_consultas_necessarias: 1 },
      { nome: 'Clareador Perfect FGM 16%', quantidade_embalagem: 1, quantidade_rendimento: 1, preco_embalagem_atual: 29.00, quantidade_usada_por_procedimento: 4, numero_consultas_necessarias: 1 },
      { nome: 'Gaze Estéril', quantidade_embalagem: 1, quantidade_rendimento: 500, preco_embalagem_atual: 80.00, quantidade_usada_por_procedimento: 6, numero_consultas_necessarias: 1 },
    ]
  }
];

export const PLANILHA_CUSTOS_FIXOS_PADRAO = [
  { nome_custo: 'Pro Labore (Salário do Dentista)', valor_mensal: 1621.00 },
  { nome_custo: 'Aluguel do Consultório', valor_mensal: 800.00 },
  { nome_custo: 'Condomínio', valor_mensal: 0.00 },
  { nome_custo: 'Salários (Secretária, ASB e etc)', valor_mensal: 0.00 },
  { nome_custo: 'Estágio', valor_mensal: 2000.00 },
  { nome_custo: 'Contador', valor_mensal: 0.00 },
  { nome_custo: 'Telefone', valor_mensal: 100.00 },
  { nome_custo: 'CRO / Conselho de Classe', valor_mensal: 547.93 },
  { nome_custo: 'Energia Elétrica', valor_mensal: 0.00 },
  { nome_custo: 'Água', valor_mensal: 0.00 },
  { nome_custo: 'IPTU', valor_mensal: 0.00 },
  { nome_custo: 'Manutenção de Equipamentos', valor_mensal: 0.00 },
  { nome_custo: 'Material de Limpeza', valor_mensal: 0.00 },
  { nome_custo: 'Material de Escritório', valor_mensal: 0.00 },
  { nome_custo: 'Taxas da Prefeitura / Vigilância', valor_mensal: 161.35 },
  { nome_custo: 'Faxineira', valor_mensal: 0.00 },
  { nome_custo: 'Marketing / Publicidade', valor_mensal: 0.00 },
  { nome_custo: 'Materiais e Dental (Consumo mensal)', valor_mensal: 1500.00 },
  { nome_custo: 'Empréstimo Banco / Parcelamentos', valor_mensal: 0.00 },
  { nome_custo: 'Internet Banda Larga', valor_mensal: 0.00 },
];
