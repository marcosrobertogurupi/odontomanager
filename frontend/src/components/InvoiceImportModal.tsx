import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Camera, 
  Sparkles, 
  FileText, 
  AlertCircle, 
  Check, 
  Trash2, 
  Plus, 
  RefreshCw, 
  ArrowRight,
  Package,
  Layers,
  CheckCircle2,
  HelpCircle,
  Key,
  Link2
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useTenant } from '../contexts/TenantContext';
import { 
  type InvoiceData, 
  type InvoiceItem, 
  scanInvoiceWithGemini, 
  getDoctorShopExampleData,
  carregarMapeamentosFornecedor,
  aplicarMapeamentosFornecedor,
  salvarMapeamentosFornecedor
} from '../lib/invoiceScanner';
import styles from './InvoiceImportModal.module.css';

interface InvoiceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUnit: string;
  insumosExistentes: any[];
  unidadesMedidaDisponiveis?: any[];
  onImportSuccess: () => Promise<void> | void;
}

export default function InvoiceImportModal({
  isOpen,
  onClose,
  selectedUnit,
  insumosExistentes,
  unidadesMedidaDisponiveis = [],
  onImportSuccess
}: InvoiceImportModalProps) {
  const { activeTenant } = useTenant();

  // Estados principais
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  
  // Chave de API Gemini
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Drag and drop & Câmera
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Estado de confirmação final
  const [isSaving, setIsSaving] = useState(false);
  const [reconhecidosCount, setReconhecidosCount] = useState(0);

  // Categorias padrão
  const categoriasPadrao = [
    'Descartáveis',
    'Dentística',
    'Endodontia',
    'Ortodontia',
    'Cirurgia',
    'Anestésicos',
    'Periodontia',
    'Prótese',
    'Prevenção / Higiene',
    'Geral'
  ];

  // Buscar credencial Gemini já existente no tenant
  useEffect(() => {
    if (!isOpen || !activeTenant) return;

    const fetchTenantConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('tenant_integrations')
          .select('gemini_api_key, gemini_model')
          .eq('tenant_id', activeTenant.id)
          .maybeSingle();

        if (data && data.gemini_api_key) {
          setGeminiApiKey(data.gemini_api_key);
          if (data.gemini_model) setGeminiModel(data.gemini_model);
          setShowApiKeyInput(false);
        } else {
          setShowApiKeyInput(true);
        }
      } catch (err) {
        console.warn('Não foi possível carregar chave Gemini do tenant:', err);
        setShowApiKeyInput(true);
      }
    };

    fetchTenantConfig();
  }, [isOpen, activeTenant]);

  if (!isOpen) return null;

  // =========================================================================
  // PROCESSAMENTO DO ARQUIVO (PDF OU IMAGEM)
  // =========================================================================

  const handleProcessFile = async (file: File) => {
    if (!file) return;

    setIsProcessing(true);
    setLoadingStatus('Lendo documento fiscal e extraindo produtos com Inteligência Artificial...');

    try {
      // Se não tiver chave cadastrada, tenta buscar novamente ou pede
      let key = geminiApiKey.trim();
      if (!key) {
        // Tentar obter do Supabase mais uma vez
        if (activeTenant) {
          const { data } = await supabase
            .from('tenant_integrations')
            .select('gemini_api_key, gemini_model')
            .eq('tenant_id', activeTenant.id)
            .maybeSingle();
          if (data?.gemini_api_key) {
            key = data.gemini_api_key;
            setGeminiApiKey(key);
          }
        }
      }

      if (!key) {
        setShowApiKeyInput(true);
        throw new Error('Por favor, informe a Chave de API do Google Gemini para processar a nota fiscal por IA, ou utilize a "Nota de Exemplo".');
      }

      const extracted = await scanInvoiceWithGemini(file, key, geminiModel);

      // Reconciliar produtos usando mapeamento histórico do fornecedor e catálogo
      await reconcileWithCatalog(extracted);
      setInvoiceData(extracted);
      setStep('review');
    } catch (err: any) {
      console.error('Erro na extração da nota fiscal:', err);
      alert(err.message || 'Erro ao processar o arquivo. Verifique se o formato é válido.');
    } finally {
      setIsProcessing(false);
      setLoadingStatus('');
    }
  };

  // Carregar dados de exemplo (Doctor Shop DANFE anexada)
  const handleLoadExample = async () => {
    setIsProcessing(true);
    setLoadingStatus('Carregando dados da DANFE de exemplo (Doctor Shop)...');
    try {
      const exampleData = getDoctorShopExampleData();
      await reconcileWithCatalog(exampleData);
      setInvoiceData(exampleData);
      setStep('review');
    } catch (err) {
      console.error('Erro ao carregar exemplo:', err);
    } finally {
      setIsProcessing(false);
      setLoadingStatus('');
    }
  };

  // Vincula produtos usando a memória de compras do fornecedor e o catálogo
  const reconcileWithCatalog = async (data: InvoiceData) => {
    if (!activeTenant) return;

    try {
      // 1. Carregar mapeamentos históricos salvos para este fornecedor
      const mappings = await carregarMapeamentosFornecedor(
        supabase,
        activeTenant.id,
        data.fornecedor_nome,
        data.fornecedor_cnpj
      );

      // 2. Aplicar mapeamentos com prioridade: código fornecedor -> descrição fornecedor -> similaridade
      const { itens, reconhecidosCount: count } = aplicarMapeamentosFornecedor(
        data.itens,
        mappings,
        insumosExistentes || []
      );

      data.itens = itens;
      setReconhecidosCount(count);
    } catch (err) {
      console.warn('Erro ao consultar histórico do fornecedor:', err);
    }
  };

  // Salvar chave Gemini no tenant_integrations para conveniência futura
  const handleSaveApiKey = async () => {
    if (!activeTenant || !geminiApiKey.trim()) return;
    try {
      const { error } = await supabase
        .from('tenant_integrations')
        .upsert({
          tenant_id: activeTenant.id,
          gemini_api_key: geminiApiKey.trim(),
          gemini_model: geminiModel.trim() || 'gemini-1.5-flash'
        }, { onConflict: 'tenant_id' });

      if (error) throw error;
      alert('Chave do Gemini salva com sucesso para esta clínica!');
      setShowApiKeyInput(false);
    } catch (err: any) {
      alert('Erro ao salvar chave: ' + err.message);
    }
  };

  // =========================================================================
  // EDIÇÃO DE ITENS E CÁLCULO DE UNIDADES
  // =========================================================================

  const handleUpdateItem = (id: string, updates: Partial<InvoiceItem>) => {
    if (!invoiceData) return;

    const newItens = invoiceData.itens.map((item) => {
      if (item.id !== id) return item;

      const updated = { ...item, ...updates };

      // Recalcular quantidades e custos
      const fator = Number(updated.fator_conversao) > 0 ? Number(updated.fator_conversao) : 1;
      const qtdNota = Number(updated.quantidade_nota) || 0;
      const vTotal = Number(updated.valor_total) || 0;

      if (updated.modo_entrada === 'unidade') {
        // Entrada por unidade: quantidade multiplicada pelo fator da caixa
        updated.quantidade_entrada = Number((qtdNota * fator).toFixed(2));
        updated.custo_unitario_entrada = updated.quantidade_entrada > 0 
          ? Number((vTotal / updated.quantidade_entrada).toFixed(4)) 
          : 0;
      } else {
        // Entrada por embalagem inteira (ex: 1 caixa fechada)
        updated.quantidade_entrada = qtdNota;
        updated.custo_unitario_entrada = Number(updated.valor_unitario) || (qtdNota > 0 ? vTotal / qtdNota : 0);
      }

      return updated;
    });

    setInvoiceData({ ...invoiceData, itens: newItens });
  };

  const handleToggleModoEntrada = (id: string) => {
    if (!invoiceData) return;
    const item = invoiceData.itens.find(i => i.id === id);
    if (!item) return;

    const novoModo = item.modo_entrada === 'unidade' ? 'embalagem' : 'unidade';
    handleUpdateItem(id, { modo_entrada: novoModo });
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (!invoiceData) return;
    const newItens = invoiceData.itens.map(i => ({ ...i, selected: checked }));
    setInvoiceData({ ...invoiceData, itens: newItens });
  };

  const handleDeleteItem = (id: string) => {
    if (!invoiceData) return;
    const newItens = invoiceData.itens.filter(i => i.id !== id);
    setInvoiceData({ ...invoiceData, itens: newItens });
  };

  const handleAddNewItem = () => {
    if (!invoiceData) return;
    const novoItem: InvoiceItem = {
      id: `manual-${Date.now()}`,
      codigo_original: '',
      descricao: 'Novo Item Manual',
      unidade_nota: 'un',
      quantidade_nota: 1,
      valor_unitario: 0,
      valor_total: 0,
      fator_conversao: 1,
      unidade_estoque: 'un',
      modo_entrada: 'unidade',
      quantidade_entrada: 1,
      custo_unitario_entrada: 0,
      categoria: 'Geral',
      insumo_id: null,
      selected: true
    };
    setInvoiceData({ ...invoiceData, itens: [...invoiceData.itens, novoItem] });
  };

  // =========================================================================
  // CONFIRMAÇÃO E ENTRADA DE ESTOQUE NO BANCO
  // =========================================================================

  const handleConfirmImport = async () => {
    if (!activeTenant || !selectedUnit || !invoiceData) return;

    const selectedItens = invoiceData.itens.filter(i => i.selected);
    if (selectedItens.length === 0) {
      alert('Selecione pelo menos um produto para dar entrada no estoque.');
      return;
    }

    setIsSaving(true);

    try {
      let createdCount = 0;
      let entradaCount = 0;
      const itensMapeadosParaSalvar: InvoiceItem[] = [];

      for (const item of selectedItens) {
        let insumoId = item.insumo_id;

        // 1. Se não estiver vinculado a um insumo existente, cadastra novo insumo
        if (!insumoId) {
          const rendimento = item.modo_entrada === 'unidade' ? 1 : Number(item.fator_conversao || 1);
          const unidadeMedida = item.modo_entrada === 'unidade' ? item.unidade_estoque : item.unidade_nota;
          const precoEmbalagem = item.modo_entrada === 'unidade' 
            ? item.custo_unitario_entrada 
            : item.valor_unitario;

          const { data: newInsumo, error: insError } = await supabase
            .from('insumos')
            .insert([{
              tenant_id: activeTenant.id,
              nome: item.descricao.trim(),
              categoria: item.categoria || 'Geral',
              unidade_medida: unidadeMedida || 'un',
              quantidade_embalagem: 1,
              quantidade_rendimento: rendimento,
              preco_embalagem_atual: precoEmbalagem,
              estoque_minimo: 1,
              ativo: true
            }])
            .select('id')
            .single();

          if (insError) throw new Error(`Erro ao cadastrar insumo "${item.descricao}": ${insError.message}`);
          insumoId = newInsumo.id;
          createdCount++;
        }

        // Armazena com o insumoId garantido para salvar o vínculo do fornecedor
        itensMapeadosParaSalvar.push({
          ...item,
          insumo_id: insumoId
        });

        // 2. Dar entrada da compra chamando a RPC ou tabela compras_estoque
        // Observação importante: se o modo for 'unidade', a quantidade_comprada é a quantidade de unidades!
        const qtdCompra = item.quantidade_entrada;
        const valorUnitCompra = item.custo_unitario_entrada;
        const valorTotalCompra = item.valor_total;

        const { error: rpcError } = await supabase.rpc('processar_compra_estoque', {
          p_insumo_id: insumoId,
          p_unit_id: selectedUnit,
          p_fornecedor: invoiceData.fornecedor_nome || 'Diversos',
          p_quantidade: qtdCompra,
          p_valor_total: valorTotalCompra,
          p_valor_unitario: valorUnitCompra,
          p_nota_fiscal: invoiceData.numero_nota || null,
          p_tenant_id: activeTenant.id
        });

        if (rpcError) {
          // Fallback caso a RPC tenha formato diferente: insert direto em compras_estoque
          const { error: insertErr } = await supabase
            .from('compras_estoque')
            .insert([{
              tenant_id: activeTenant.id,
              unit_id: selectedUnit,
              insumo_id: insumoId,
              quantidade_comprada: qtdCompra,
              preco_pago_embalagem: valorUnitCompra,
              fornecedor: invoiceData.fornecedor_nome || 'Diversos',
              nota_fiscal: invoiceData.numero_nota || null,
              data_compra: invoiceData.data_emissao || new Date().toISOString().split('T')[0]
            }]);

          if (insertErr) {
            throw new Error(`Erro ao registrar entrada de "${item.descricao}": ${insertErr.message}`);
          }
        }

        entradaCount++;
      }

      // 3. Salvar os vínculos de produtos deste fornecedor para reconhecimento automático nas próximas compras
      try {
        await salvarMapeamentosFornecedor(
          supabase,
          activeTenant.id,
          invoiceData.fornecedor_nome,
          invoiceData.fornecedor_cnpj,
          itensMapeadosParaSalvar
        );
      } catch (mapErr) {
        console.warn('Erro ao salvar De-Para do fornecedor:', mapErr);
      }

      await onImportSuccess();
      alert(`Sucesso! ${entradaCount} produto(s) importados da Nota Fiscal ${invoiceData.numero_nota || ''}.\n\nOs vínculos com "${invoiceData.fornecedor_nome}" foram salvos na memória do sistema. Nas próximas compras deste fornecedor, os produtos serão associados automaticamente!`);
      onClose();
    } catch (err: any) {
      console.error('Erro ao efetivar entrada de estoque:', err);
      alert('Falha ao registrar entrada: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Totais do footer
  const selectedCount = invoiceData?.itens.filter(i => i.selected).length || 0;
  const totalValueSelected = invoiceData?.itens
    .filter(i => i.selected)
    .reduce((acc, curr) => acc + (Number(curr.valor_total) || 0), 0) || 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <div className={styles.iconBadge}>
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className={styles.modalTitle}>Importar Estoque por Nota Fiscal / Cupom</h3>
              <p className={styles.modalSubtitle}>
                {step === 'upload' 
                  ? 'Envie o arquivo PDF ou foto da NF-e / cupom fiscal para leitura automática por Inteligência Artificial' 
                  : 'Confira os produtos, ajuste as descrições e defina as entradas por unidade ou caixa'}
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* PASSO 1: UPLOAD / SELEÇÃO */}
          {step === 'upload' && (
            <>
              {/* Barra de Chave Gemini caso precise configurar */}
              {showApiKeyInput && (
                <div className={styles.apiKeyBar}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Key size={18} />
                    <span>
                      <strong>Google Gemini API Key:</strong> Insira sua chave para habilitar a leitura inteligente de fotos e PDFs.
                    </span>
                  </div>
                  <div className={styles.apiKeyInputGroup}>
                    <input 
                      type="password" 
                      className={styles.apiKeyInput}
                      placeholder="Cole sua API Key do Google AI"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                    />
                    <button 
                      type="button" 
                      onClick={handleSaveApiKey} 
                      className={styles.smBtn}
                      style={{ background: 'hsl(var(--primary))', color: '#fff', border: 'none' }}
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              )}

              {isProcessing ? (
                <div className={styles.loadingBox}>
                  <div className={styles.spinner} />
                  <h4 className={styles.loadingTitle}>Processando Documento Fiscal...</h4>
                  <p className={styles.loadingText}>{loadingStatus}</p>
                </div>
              ) : (
                <div 
                  className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleProcessFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleProcessFile(e.target.files[0]);
                      }
                    }}
                  />
                  <input 
                    type="file" 
                    ref={cameraInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleProcessFile(e.target.files[0]);
                      }
                    }}
                  />

                  <div className={styles.dropzoneIcon}>
                    <Upload size={28} />
                  </div>
                  <h4 className={styles.dropzoneTitle}>Arraste seu PDF ou Foto da Nota / Cupom</h4>
                  <p className={styles.dropzoneText}>
                    Compatível com DANFE (NF-e), NFC-e e cupons de compras odontológicas. Suporta formatos PDF, JPG, PNG e fotos da câmera.
                  </p>

                  <div className={styles.dropzoneActions} onClick={(e) => e.stopPropagation()}>
                    <button 
                      type="button" 
                      className={`${styles.actionBtn} ${styles.primaryAction}`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileText size={16} />
                      Selecionar Arquivo
                    </button>
                    <button 
                      type="button" 
                      className={`${styles.actionBtn} ${styles.secondaryAction}`}
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera size={16} />
                      Tirar Foto da Nota
                    </button>
                    <button 
                      type="button" 
                      className={`${styles.actionBtn} ${styles.exampleAction}`}
                      onClick={handleLoadExample}
                      title="Carrega os 10 produtos da DANFE Doctor Shop de exemplo"
                    >
                      <Sparkles size={16} />
                      Testar com DANFE de Exemplo (Doctor Shop)
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* PASSO 2: CONFERÊNCIA E EDIÇÃO DA NOTA */}
          {step === 'review' && invoiceData && (
            <>
              {/* Card Resumo da Nota */}
              <div className={styles.invoiceCard}>
                <div className={styles.invoiceMetaItem}>
                  <span className={styles.metaLabel}>Fornecedor / Emitente</span>
                  <input 
                    type="text" 
                    className={styles.cellInput}
                    style={{ fontWeight: 600 }}
                    value={invoiceData.fornecedor_nome}
                    onChange={(e) => setInvoiceData({ ...invoiceData, fornecedor_nome: e.target.value })}
                  />
                </div>
                <div className={styles.invoiceMetaItem}>
                  <span className={styles.metaLabel}>Nº da Nota / Cupom</span>
                  <input 
                    type="text" 
                    className={styles.cellInput}
                    value={invoiceData.numero_nota}
                    onChange={(e) => setInvoiceData({ ...invoiceData, numero_nota: e.target.value })}
                  />
                </div>
                <div className={styles.invoiceMetaItem}>
                  <span className={styles.metaLabel}>Data de Emissão</span>
                  <input 
                    type="date" 
                    className={styles.cellInput}
                    value={invoiceData.data_emissao}
                    onChange={(e) => setInvoiceData({ ...invoiceData, data_emissao: e.target.value })}
                  />
                </div>
                <div className={styles.invoiceMetaItem}>
                  <span className={styles.metaLabel}>Valor Total da Nota</span>
                  <span className={styles.metaValue} style={{ color: 'hsl(var(--success))', fontSize: '16px' }}>
                    {invoiceData.valor_total_nota.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              {/* Aviso explicativo sobre Embalagens vs Unidades */}
              <div className={styles.conversionNotice}>
                <Layers size={20} style={{ color: 'hsl(var(--primary))', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Atenção à Conversão de Unidades:</strong> Quando você compra por caixa/pacote (ex: <em>Sugador C/40</em> ou <em>Lençol de Borracha C/26</em>), 
                  o sistema detecta automaticamente o fator e permite que você escolha se deseja dar entrada pelas <strong>unidades fracionadas avulsas</strong> (calculando o custo unitário exato por uso) 
                  ou pela <strong>caixa/pacote fechado</strong>. Você também pode editar livremente qualquer descrição e valor!
                </div>
              </div>

              {/* Banner de reconhecimento automático do fornecedor */}
              {reconhecidosCount > 0 && (
                <div className={styles.supplierNotice}>
                  <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Memória do Fornecedor Ativada:</strong> O sistema reconheceu automaticamente <strong>{reconhecidosCount} produto(s)</strong> que você já comprou anteriormente da <strong>{invoiceData.fornecedor_nome}</strong> e vinculou ao seu catálogo sem precisar refazer o vínculo!
                  </div>
                </div>
              )}

              {/* Tabela de Produtos */}
              <div className={styles.tableContainer}>
                <div className={styles.tableHeaderBar}>
                  <span className={styles.tableTitle}>
                    Itens Identificados na Nota ({invoiceData.itens.length})
                  </span>
                  <div className={styles.tableActions}>
                    <button type="button" onClick={handleAddNewItem} className={styles.smBtn}>
                      <Plus size={14} /> Adicionar Item Manual
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleToggleSelectAll(!invoiceData.itens.every(i => i.selected))} 
                      className={styles.smBtn}
                    >
                      <Check size={14} /> {invoiceData.itens.every(i => i.selected) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                  </div>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ width: '36px', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={invoiceData.itens.length > 0 && invoiceData.itens.every(i => i.selected)}
                            onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          />
                        </th>
                        <th style={{ minWidth: '280px' }}>Descrição do Produto (Editável)</th>
                        <th style={{ minWidth: '220px' }}>Vínculo no Catálogo</th>
                        <th style={{ minWidth: '85px', textAlign: 'center' }}>Qtd Nota</th>
                        <th style={{ minWidth: '75px', textAlign: 'center' }}>Un. Nota</th>
                        <th style={{ minWidth: '95px', textAlign: 'center' }}>Itens p/ Caixa</th>
                        <th style={{ minWidth: '130px', textAlign: 'center' }}>Modo de Entrada</th>
                        <th style={{ minWidth: '120px' }}>Saldo a Entrar</th>
                        <th style={{ minWidth: '100px', textAlign: 'right' }}>Valor Unit.</th>
                        <th style={{ minWidth: '100px', textAlign: 'right' }}>Valor Total</th>
                        <th style={{ minWidth: '130px' }}>Categoria</th>
                        <th style={{ width: '45px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceData.itens.map((item) => (
                        <tr key={item.id} className={!item.selected ? styles.rowDisabled : ''}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={item.selected}
                              onChange={(e) => handleUpdateItem(item.id, { selected: e.target.checked })}
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              className={styles.cellInput}
                              value={item.descricao}
                              onChange={(e) => handleUpdateItem(item.id, { descricao: e.target.value })}
                              placeholder="Descrição do produto"
                            />
                          </td>
                          <td>
                            <select 
                              className={styles.cellSelect}
                              style={{ width: '100%' }}
                              value={item.insumo_id || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                  const matched = insumosExistentes.find(ins => ins.id === val);
                                  handleUpdateItem(item.id, { 
                                    insumo_id: val,
                                    categoria: matched?.categoria || item.categoria,
                                    unidade_estoque: matched?.unidade_medida || item.unidade_estoque,
                                    mapeamento_fornecedor: false,
                                    vinculado_automatico: false
                                  });
                                } else {
                                  handleUpdateItem(item.id, { 
                                    insumo_id: null, 
                                    mapeamento_fornecedor: false, 
                                    vinculado_automatico: false 
                                  });
                                }
                              }}
                            >
                              <option value="">✨ Cadastrar como Novo Insumo</option>
                              {insumosExistentes.filter(ins => ins.ativo).map(ins => (
                                <option key={ins.id} value={ins.id}>
                                  {ins.nome} ({ins.unidade_medida || 'un'})
                                </option>
                              ))}
                            </select>

                            {item.mapeamento_fornecedor && (
                              <div className={styles.badgeMapped} title="Item identificado automaticamente a partir do histórico deste fornecedor">
                                <Link2 size={11} /> Vinculado do Fornecedor
                              </div>
                            )}
                            {!item.mapeamento_fornecedor && item.vinculado_automatico && (
                              <div className={styles.badgeFuzzy} title="Sugestão automática baseada na similaridade do nome com o catálogo">
                                <Sparkles size={10} /> Sugestão Automática
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="number" 
                              step="0.01"
                              className={styles.cellInput}
                              style={{ width: '80px', textAlign: 'center' }}
                              value={item.quantidade_nota}
                              onChange={(e) => handleUpdateItem(item.id, { quantidade_nota: Number(e.target.value) })}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={styles.badgeUnit}>{item.unidade_nota}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="number" 
                              step="1"
                              min="1"
                              className={styles.cellInput}
                              style={{ width: '80px', textAlign: 'center' }}
                              value={item.fator_conversao}
                              onChange={(e) => handleUpdateItem(item.id, { fator_conversao: Number(e.target.value) })}
                              title="Quantidade de unidades contidas nesta embalagem (ex: 40 para C/40)"
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              type="button" 
                              className={`${styles.modeToggleBtn} ${item.modo_entrada === 'unidade' ? styles.modeUnit : styles.modeBox}`}
                              onClick={() => handleToggleModoEntrada(item.id)}
                              title="Clique para alternar entre entrada por unidades individuais ou embalagem fechada"
                            >
                              {item.modo_entrada === 'unidade' ? (
                                <>
                                  <Package size={13} />
                                  <span>Por Unidade</span>
                                </>
                              ) : (
                                <>
                                  <Layers size={13} />
                                  <span>Por Caixa</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td>
                            <div className={styles.badgeHighlight}>
                              +{item.quantidade_entrada} {item.modo_entrada === 'unidade' ? item.unidade_estoque : item.unidade_nota}
                            </div>
                            <div style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                              Custo: R$ {item.custo_unitario_entrada.toFixed(2)}/un
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input 
                              type="number" 
                              step="0.01"
                              className={styles.cellInput}
                              style={{ width: '95px', textAlign: 'right' }}
                              value={item.valor_unitario}
                              onChange={(e) => {
                                const vu = Number(e.target.value);
                                const vt = Number((vu * item.quantidade_nota).toFixed(2));
                                handleUpdateItem(item.id, { valor_unitario: vu, valor_total: vt });
                              }}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input 
                              type="number" 
                              step="0.01"
                              className={styles.cellInput}
                              style={{ width: '95px', textAlign: 'right' }}
                              value={item.valor_total}
                              onChange={(e) => {
                                const vt = Number(e.target.value);
                                const vu = item.quantidade_nota > 0 ? Number((vt / item.quantidade_nota).toFixed(4)) : vt;
                                handleUpdateItem(item.id, { valor_total: vt, valor_unitario: vu });
                              }}
                            />
                          </td>
                          <td>
                            <select 
                              className={styles.cellSelect}
                              style={{ width: '100%' }}
                              value={item.categoria}
                              onChange={(e) => handleUpdateItem(item.id, { categoria: e.target.value })}
                            >
                              {categoriasPadrao.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              type="button" 
                              onClick={() => handleDeleteItem(item.id)}
                              className={styles.deleteItemBtn}
                              title="Remover este item da importação"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          {step === 'upload' ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <div className={styles.footerSummary}>
                <span>
                  Produtos Selecionados: <strong>{selectedCount}</strong> de {invoiceData?.itens.length}
                </span>
                <span>
                  Valor Total: <strong>{totalValueSelected.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                </span>
              </div>
              <div className={styles.footerActions}>
                <button 
                  type="button" 
                  className={styles.cancelBtn} 
                  onClick={() => setStep('upload')}
                  disabled={isSaving}
                >
                  Voltar / Enviar Outro
                </button>
                <button 
                  type="button" 
                  className={styles.confirmBtn}
                  onClick={handleConfirmImport}
                  disabled={isSaving || selectedCount === 0}
                >
                  {isSaving ? (
                    <>
                      <div className={styles.spinner} style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                      Registrando Entradas...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Confirmar Entrada no Estoque ({selectedCount})
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
