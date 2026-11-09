export interface InvoiceItem {
  id: string;
  codigo_original: string;
  descricao: string;
  unidade_nota: string;
  quantidade_nota: number;
  valor_unitario: number;
  valor_total: number;
  fator_conversao: number; // Ex: se C/40 -> 40
  unidade_estoque: string; // Ex: 'un'
  modo_entrada: 'unidade' | 'embalagem'; // 'unidade' dá entrada na quantidade multiplicada; 'embalagem' entra como 1 caixa
  quantidade_entrada: number;
  custo_unitario_entrada: number;
  categoria: string;
  insumo_id?: string | null;
  selected: boolean;
  vinculado_automatico?: boolean; // Se foi vinculado pelo histórico do fornecedor
  mapeamento_fornecedor?: boolean; // Se corresponde a um produto já mapeado do fornecedor
}

export interface FornecedorInsumoMapping {
  id?: string;
  tenant_id: string;
  fornecedor_nome: string;
  fornecedor_cnpj?: string;
  codigo_produto_fornecedor?: string;
  descricao_fornecedor: string;
  insumo_id: string;
  fator_conversao: number;
  modo_entrada: 'unidade' | 'embalagem';
  unidade_fornecedor?: string;
}

export interface InvoiceData {
  numero_nota: string;
  serie?: string;
  chave_acesso?: string;
  data_emissao?: string;
  fornecedor_nome: string;
  fornecedor_cnpj?: string;
  valor_total_nota: number;
  itens: InvoiceItem[];
}

/**
 * Converte um arquivo para base64 puro (sem o prefixo data:mime;base64,)
 */
export async function fileToBase64(file: File): Promise<{ base64Data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(',');
      if (commaIndex !== -1) {
        resolve({
          base64Data: result.substring(commaIndex + 1),
          mimeType: file.type || 'application/octet-stream'
        });
      } else {
        resolve({
          base64Data: result,
          mimeType: file.type || 'application/octet-stream'
        });
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Detecta fator de conversão a partir de textos como 'C/40', 'C/26', 'CX C/50', '20 UN'
 */
export function detectPackagingFactor(description: string, defaultUnit: string = 'un'): { factor: number; cleanName: string } {
  const regexPatterns = [
    /\b(?:c\/|c\s*\/\s*|cx\s*c\/\s*|contendo\s*|com\s*)(\d+)\b/i,
    /\b(\d+)\s*(?:unidades|unids|unid|un|fls|folhas|pcs|peças)\b/i
  ];

  for (const pattern of regexPatterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 1) {
        return { factor: num, cleanName: description };
      }
    }
  }

  const unitLower = defaultUnit.toLowerCase();
  if (['ptc', 'pct', 'cx', 'cj', 'kit'].includes(unitLower)) {
    return { factor: 1, cleanName: description };
  }

  return { factor: 1, cleanName: description };
}

/**
 * Dados reais da DANFE de exemplo (Doctor Shop) fornecida pelo usuário
 */
export function getDoctorShopExampleData(): InvoiceData {
  const rawItems = [
    {
      codigo_original: '13662',
      descricao: 'Ambar Universal 5 Ml Aps Fgm',
      unidade_nota: 'un',
      quantidade_nota: 1.0,
      valor_unitario: 208.70,
      valor_total: 208.70,
      categoria: 'Dentística',
      fator_conversao: 1,
      unidade_estoque: 'un'
    },
    {
      codigo_original: '5408',
      descricao: 'Fio Dental Preven 100mts',
      unidade_nota: 'un',
      quantidade_nota: 1.0,
      valor_unitario: 8.60,
      valor_total: 8.60,
      categoria: 'Prevenção / Higiene',
      fator_conversao: 1,
      unidade_estoque: 'un'
    },
    {
      codigo_original: '324',
      descricao: 'Hidroxido De Calcio P.A 10G Biodinamica',
      unidade_nota: 'pc',
      quantidade_nota: 1.0,
      valor_unitario: 14.95,
      valor_total: 14.95,
      categoria: 'Endodontia',
      fator_conversao: 1,
      unidade_estoque: 'un'
    },
    {
      codigo_original: '16645',
      descricao: 'Lencol De Borracha C/26 Mk Life Azul 127x127 mm',
      unidade_nota: 'cj',
      quantidade_nota: 1.0,
      valor_unitario: 34.50,
      valor_total: 34.50,
      categoria: 'Dentística / Isolamento',
      fator_conversao: 26, // C/26
      unidade_estoque: 'un'
    },
    {
      codigo_original: '8664',
      descricao: 'Obtur Restaurador Prov Refil Fluor 25gr',
      unidade_nota: 'un',
      quantidade_nota: 1.0,
      valor_unitario: 21.30,
      valor_total: 21.30,
      categoria: 'Dentística',
      fator_conversao: 1,
      unidade_estoque: 'un'
    },
    {
      codigo_original: '6960',
      descricao: 'Perioplak Reymer 250ml Sem Alcool',
      unidade_nota: 'un',
      quantidade_nota: 1.0,
      valor_unitario: 28.30,
      valor_total: 28.30,
      categoria: 'Periodontia / Higiene',
      fator_conversao: 1,
      unidade_estoque: 'un'
    },
    {
      codigo_original: '882',
      descricao: 'Resina Filtek Z250 Cor 1370 A3',
      unidade_nota: 'un',
      quantidade_nota: 1.0,
      valor_unitario: 135.30,
      valor_total: 135.30,
      categoria: 'Dentística',
      fator_conversao: 1,
      unidade_estoque: 'un'
    },
    {
      codigo_original: '5881',
      descricao: 'Resina Opallis Flow A2 Fgm',
      unidade_nota: 'un',
      quantidade_nota: 1.0,
      valor_unitario: 33.20,
      valor_total: 33.20,
      categoria: 'Dentística',
      fator_conversao: 1,
      unidade_estoque: 'un'
    },
    {
      codigo_original: '16920',
      descricao: 'Sugador Descartavel Maxclean C/40',
      unidade_nota: 'ptc',
      quantidade_nota: 1.0,
      valor_unitario: 10.60,
      valor_total: 10.60,
      categoria: 'Descartáveis',
      fator_conversao: 40, // C/40
      unidade_estoque: 'un'
    },
    {
      codigo_original: '12319',
      descricao: 'Sugador Endodontico C/20 Ssplus',
      unidade_nota: 'ptc',
      quantidade_nota: 1.0,
      valor_unitario: 24.20,
      valor_total: 24.20,
      categoria: 'Endodontia / Descartáveis',
      fator_conversao: 20, // C/20
      unidade_estoque: 'un'
    }
  ];

  const itens: InvoiceItem[] = rawItems.map((item, index) => {
    const modoEntrada: 'unidade' | 'embalagem' = item.fator_conversao > 1 ? 'unidade' : 'embalagem';
    const qtdEntrada = modoEntrada === 'unidade' ? item.quantidade_nota * item.fator_conversao : item.quantidade_nota;
    const custoUnit = qtdEntrada > 0 ? Number((item.valor_total / qtdEntrada).toFixed(4)) : item.valor_unitario;

    return {
      id: `item-${index + 1}-${Date.now()}`,
      codigo_original: item.codigo_original,
      descricao: item.descricao,
      unidade_nota: item.unidade_nota,
      quantidade_nota: item.quantidade_nota,
      valor_unitario: item.valor_unitario,
      valor_total: item.valor_total,
      fator_conversao: item.fator_conversao,
      unidade_estoque: item.unidade_estoque,
      modo_entrada: modoEntrada,
      quantidade_entrada: qtdEntrada,
      custo_unitario_entrada: custoUnit,
      categoria: item.categoria,
      insumo_id: null,
      selected: true
    };
  });

  return {
    numero_nota: '000.034.050',
    serie: '001',
    chave_acesso: '1726 0718 1376 3900 0260 5500 1000 0340 5012 8650 0724',
    data_emissao: '2026-07-16',
    fornecedor_nome: 'Doctor Shop Com e Repres de Produtos Odontolo Ltda',
    fornecedor_cnpj: '18.137.639/0002-60',
    valor_total_nota: 519.65,
    itens
  };
}

/**
 * Busca no Supabase (com fallback no cache local) os mapeamentos salvos para o fornecedor
 */
export async function carregarMapeamentosFornecedor(
  supabaseClient: any,
  tenantId: string,
  fornecedorNome: string,
  fornecedorCnpj?: string
): Promise<FornecedorInsumoMapping[]> {
  const fornClean = (fornecedorNome || '').trim().toLowerCase();
  const cacheKey = `odonto_supplier_map_${tenantId}_${fornClean}`;
  let mappings: FornecedorInsumoMapping[] = [];

  try {
    const { data, error } = await supabaseClient
      .from('fornecedor_insumos')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('fornecedor_nome', `%${fornecedorNome.trim()}%`);

    if (!error && data && data.length > 0) {
      mappings = data;
      localStorage.setItem(cacheKey, JSON.stringify(data));
      return mappings;
    }
  } catch (err) {
    console.warn('Erro ao consultar fornecedor_insumos no Supabase, tentando cache local:', err);
  }

  // Fallback cache local
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      mappings = JSON.parse(cached);
    }
  } catch (_) {}

  return mappings;
}

/**
 * Aplica os mapeamentos aprendidos do fornecedor aos itens extraídos da nota
 */
export function aplicarMapeamentosFornecedor(
  itens: InvoiceItem[],
  mapeamentos: FornecedorInsumoMapping[],
  insumosExistentes: any[]
): { itens: InvoiceItem[]; reconhecidosCount: number } {
  let reconhecidosCount = 0;

  const atualizados = itens.map((item) => {
    // 1. Tentar encontrar por código do produto no catálogo do fornecedor
    let mapMatch = item.codigo_original 
      ? mapeamentos.find(m => m.codigo_produto_fornecedor && m.codigo_produto_fornecedor.trim() === item.codigo_original.trim())
      : null;

    // 2. Se não encontrou por código, tentar por descrição do fornecedor
    if (!mapMatch) {
      const cleanDesc = item.descricao.trim().toLowerCase();
      mapMatch = mapeamentos.find(m => m.descricao_fornecedor && m.descricao_fornecedor.trim().toLowerCase() === cleanDesc);
    }

    if (mapMatch) {
      // Verificar se o insumo mapeado ainda existe no catálogo
      const insumo = insumosExistentes.find(ins => ins.id === mapMatch?.insumo_id);
      if (insumo) {
        reconhecidosCount++;
        const fator = Number(mapMatch.fator_conversao) > 0 ? Number(mapMatch.fator_conversao) : item.fator_conversao;
        const modo = mapMatch.modo_entrada || item.modo_entrada;
        const qtdEntrada = modo === 'unidade' ? item.quantidade_nota * fator : item.quantidade_nota;
        const custoUnit = qtdEntrada > 0 ? Number((item.valor_total / qtdEntrada).toFixed(4)) : item.valor_unitario;

        return {
          ...item,
          insumo_id: insumo.id,
          categoria: insumo.categoria || item.categoria,
          unidade_estoque: insumo.unidade_medida || item.unidade_estoque,
          fator_conversao: fator,
          modo_entrada: modo,
          quantidade_entrada: qtdEntrada,
          custo_unitario_entrada: custoUnit,
          vinculado_automatico: true,
          mapeamento_fornecedor: true
        };
      }
    }

    // 3. Caso não haja mapeamento prévio deste fornecedor, tenta busca aproximada no catálogo
    const cleanDesc = item.descricao.toLowerCase().trim();
    const fuzzyMatch = insumosExistentes.find((ins) => {
      const insNome = ins.nome.toLowerCase().trim();
      return cleanDesc.includes(insNome) || insNome.includes(cleanDesc);
    });

    if (fuzzyMatch) {
      return {
        ...item,
        insumo_id: fuzzyMatch.id,
        unidade_estoque: fuzzyMatch.unidade_medida || item.unidade_estoque,
        categoria: fuzzyMatch.categoria || item.categoria,
        vinculado_automatico: true,
        mapeamento_fornecedor: false
      };
    }

    return item;
  });

  return { itens: atualizados, reconhecidosCount };
}

/**
 * Salva ou atualiza os mapeamentos de produtos do fornecedor
 */
export async function salvarMapeamentosFornecedor(
  supabaseClient: any,
  tenantId: string,
  fornecedorNome: string,
  fornecedorCnpj: string | undefined,
  itens: InvoiceItem[]
): Promise<void> {
  if (!tenantId || !fornecedorNome) return;

  const validMappings: FornecedorInsumoMapping[] = itens
    .filter(i => i.selected && i.insumo_id)
    .map(i => ({
      tenant_id: tenantId,
      fornecedor_nome: fornecedorNome.trim(),
      fornecedor_cnpj: fornecedorCnpj?.trim() || undefined,
      codigo_produto_fornecedor: i.codigo_original?.trim() || undefined,
      descricao_fornecedor: i.descricao.trim(),
      insumo_id: i.insumo_id as string,
      fator_conversao: Number(i.fator_conversao) || 1,
      modo_entrada: i.modo_entrada,
      unidade_fornecedor: i.unidade_nota
    }));

  if (validMappings.length === 0) return;

  // Atualizar cache local imediatamente
  const fornClean = fornecedorNome.trim().toLowerCase();
  const cacheKey = `odonto_supplier_map_${tenantId}_${fornClean}`;
  try {
    let existingList: FornecedorInsumoMapping[] = [];
    const cached = localStorage.getItem(cacheKey);
    if (cached) existingList = JSON.parse(cached);

    validMappings.forEach(m => {
      const idx = existingList.findIndex(e => 
        (m.codigo_produto_fornecedor && e.codigo_produto_fornecedor === m.codigo_produto_fornecedor) ||
        e.descricao_fornecedor.toLowerCase() === m.descricao_fornecedor.toLowerCase()
      );
      if (idx !== -1) {
        existingList[idx] = m;
      } else {
        existingList.push(m);
      }
    });

    localStorage.setItem(cacheKey, JSON.stringify(existingList));
  } catch (_) {}

  // Salvar no Supabase
  for (const m of validMappings) {
    try {
      await supabaseClient.rpc('salvar_mapeamento_fornecedor_insumo', {
        p_tenant_id: m.tenant_id,
        p_fornecedor_nome: m.fornecedor_nome,
        p_fornecedor_cnpj: m.fornecedor_cnpj || null,
        p_codigo_produto: m.codigo_produto_fornecedor || null,
        p_descricao: m.descricao_fornecedor,
        p_insumo_id: m.insumo_id,
        p_fator: m.fator_conversao,
        p_modo_entrada: m.modo_entrada,
        p_unidade: m.unidade_fornecedor || 'un'
      });
    } catch (err) {
      try {
        await supabaseClient
          .from('fornecedor_insumos')
          .insert([m]);
      } catch (insertErr) {
        console.warn('Erro ao persistir mapeamento de fornecedor no Supabase (salvo no cache local):', insertErr);
      }
    }
  }
}

/**
 * Envia o arquivo (PDF ou imagem) para a API do Gemini Vision / Multimodal
 * e retorna os dados estruturados da nota fiscal
 */
export async function scanInvoiceWithGemini(
  file: File,
  apiKey: string,
  modelName: string = 'gemini-1.5-flash'
): Promise<InvoiceData> {
  if (!apiKey) {
    throw new Error('Chave de API do Gemini não informada. Configure nas Configurações da Clínica ou insira no campo.');
  }

  const { base64Data, mimeType } = await fileToBase64(file);

  const prompt = `
Você é um especialista em processamento e OCR de Notas Fiscais Eletrônicas brasileiras (DANFE / NF-e), NFC-e e Cupons Fiscais emitidos para clínicas odontológicas.
Analise com extrema precisão o documento em anexo (PDF ou foto/imagem) e extraia todos os dados e produtos/serviços.

DADOS OBRIGATÓRIOS A RETORNAR (em formato JSON estrito, sem markdown ao redor, somente o JSON):
{
  "numero_nota": "string com número da NF-e ou cupom",
  "serie": "string com série se houver",
  "chave_acesso": "string com a chave de 44 dígitos se houver",
  "data_emissao": "AAAA-MM-DD",
  "fornecedor_nome": "Razão Social ou Nome Fantasia do Emitente",
  "fornecedor_cnpj": "CNPJ do Emitente",
  "valor_total_nota": number (valor total da nota em reais, float),
  "itens": [
    {
      "codigo_original": "código do produto na nota",
      "descricao": "descrição completa do produto (mantenha limpo e legível)",
      "unidade_nota": "unidade que consta na nota (ex: un, pc, cj, ptc, cx, fr, pct)",
      "quantidade_nota": number (quantidade comprada na nota),
      "valor_unitario": number (valor unitário na nota),
      "valor_total": number (valor total do item),
      "fator_conversao": number (detecte se na descrição ou unidade há indicação de embalagem coletiva, ex: 'C/40' -> 40, 'C/26' -> 26, 'C/20' -> 20, 'cx com 50' -> 50. Se for produto unitário ou não encontrar, retorne 1),
      "unidade_estoque_sugerida": "un, ml, g, etc",
      "categoria_sugerida": "Descartáveis, Dentística, Endodontia, Ortodontia, Cirurgia, Anestésicos, Periodontia ou Geral"
    }
  ]
}

REGRAS CRÍTICAS:
1. Extraia TODOS os itens da tabela de "DADOS DOS PRODUTOS / SERVIÇOS" sem omitir nenhum.
2. Identifique atentamente termos como "C/40", "C/26", "C/20", "C/100", "cx c/ 50" na descrição do produto para preencher "fator_conversao". Isso é fundamental para clínicas que compram caixas/pacotes e dão entrada em unidades.
3. Certifique-se de que a resposta seja SOMENTE um objeto JSON válido, sem texto explicativo extra.
`;

  let effectiveMime = mimeType;
  if (!effectiveMime || effectiveMime === 'application/octet-stream') {
    if (file.name.endsWith('.pdf')) effectiveMime = 'application/pdf';
    else if (file.name.endsWith('.png')) effectiveMime = 'image/png';
    else if (file.name.endsWith('.webp')) effectiveMime = 'image/webp';
    else effectiveMime = 'image/jpeg';
  }

  const effectiveModel = modelName.trim() || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt
          },
          {
            inline_data: {
              mime_type: effectiveMime,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedErr = errorText;
    try {
      const errJson = JSON.parse(errorText);
      parsedErr = errJson.error?.message || errorText;
    } catch (_) {}
    throw new Error(`Erro na API do Gemini: ${parsedErr}`);
  }

  const resJson = await response.json();
  const textContent = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('Nenhum dado retornado pela inteligência artificial. Verifique se o arquivo é legível.');
  }

  let cleanJson = textContent.trim();
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleanJson);

  const itens: InvoiceItem[] = (parsed.itens || []).map((item: any, idx: number) => {
    const fator = Number(item.fator_conversao) > 0 ? Number(item.fator_conversao) : 1;
    const modoEntrada: 'unidade' | 'embalagem' = fator > 1 ? 'unidade' : 'embalagem';
    const qtdNota = Number(item.quantidade_nota || 1);
    const vUnit = Number(item.valor_unitario || 0);
    const vTotal = Number(item.valor_total || (qtdNota * vUnit));
    const qtdEntrada = modoEntrada === 'unidade' ? (qtdNota * fator) : qtdNota;
    const custoUnit = qtdEntrada > 0 ? Number((vTotal / qtdEntrada).toFixed(4)) : vUnit;

    return {
      id: `item-${idx + 1}-${Date.now()}`,
      codigo_original: String(item.codigo_original || ''),
      descricao: String(item.descricao || ''),
      unidade_nota: String(item.unidade_nota || 'un'),
      quantidade_nota: qtdNota,
      valor_unitario: vUnit,
      valor_total: vTotal,
      fator_conversao: fator,
      unidade_estoque: String(item.unidade_estoque_sugerida || 'un'),
      modo_entrada: modoEntrada,
      quantidade_entrada: qtdEntrada,
      custo_unitario_entrada: custoUnit,
      categoria: String(item.categoria_sugerida || 'Geral'),
      insumo_id: null,
      selected: true
    };
  });

  return {
    numero_nota: String(parsed.numero_nota || ''),
    serie: String(parsed.serie || ''),
    chave_acesso: String(parsed.chave_acesso || ''),
    data_emissao: String(parsed.data_emissao || new Date().toISOString().split('T')[0]),
    fornecedor_nome: String(parsed.fornecedor_nome || 'Fornecedor Diversos'),
    fornecedor_cnpj: String(parsed.fornecedor_cnpj || ''),
    valor_total_nota: Number(parsed.valor_total_nota || 0),
    itens
  };
}
