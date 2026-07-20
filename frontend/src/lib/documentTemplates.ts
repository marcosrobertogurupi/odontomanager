// =============================================================
// documentTemplates.ts
// Templates baseados nos PDFs reais da Dra. Talissa Iurko
// CRO 3906-TO | Gurupi - Tocantins
// =============================================================

export interface DocumentField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'select' | 'number' | 'checkbox_list';
  placeholder?: string;
  required?: boolean;
  options?: string[];
  rows?: number;
}

export interface DocumentTemplate {
  id: string;
  category: 'clinico' | 'tcle' | 'contrato' | 'encaminhamento' | 'orientacao';
  name: string;
  description: string;
  icon: string;
  fields: DocumentField[];
  bodyTemplate: (data: Record<string, any>) => string;
}

// =============================================================
// HELPERS
// =============================================================
const formatDate = (d?: string) => {
  if (!d) return '_______';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('pt-BR');
};

const blankLine = (label = '', len = 40) => `${label}${'_'.repeat(len)}`;

const signatureBlock = (patientName?: string) => `
<div class="signature-block">
  <div class="sig-line">_____________________________________________</div>
  <div class="sig-label">Assinatura do paciente${patientName ? ` — ${patientName}` : ''} ou Responsável legal</div>
</div>`;

// =============================================================
// CATEGORIA 1: CLÍNICOS GERAIS
// =============================================================

const receituario: DocumentTemplate = {
  id: 'receituario',
  category: 'clinico',
  name: 'Receituário',
  description: 'Prescrição de medicamentos',
  icon: 'Pill',
  fields: [
    { id: 'medications', label: 'Medicamentos e Posologia', type: 'textarea', rows: 10, placeholder: 'Ex:\n1. Amoxicilina 500mg — tomar 1 cápsula a cada 8h por 7 dias\n2. Nimesulida 100mg — tomar 1 comprimido a cada 12h por 3 dias\n3. Dipirona 500mg — tomar 2 comprimidos em caso de dor', required: true },
    { id: 'observations', label: 'Observações', type: 'textarea', rows: 3, placeholder: 'Observações adicionais (opcional)' },
  ],
  bodyTemplate: (d) => `
<div class="doc-section">
  <pre class="prescription-text">${d.medications || ''}</pre>
  ${d.observations ? `<p class="obs"><strong>Obs:</strong> ${d.observations}</p>` : ''}
</div>`,
};

const anamnese: DocumentTemplate = {
  id: 'anamnese',
  category: 'clinico',
  name: 'Ficha de Anamnese',
  description: 'Questionário completo de saúde geral e bucal',
  icon: 'ClipboardList',
  fields: [
    { id: 'queixa_principal', label: 'Queixa Principal', type: 'textarea', rows: 2, placeholder: 'Ex: Dor no dente 46, sensibilidade ao frio' },
    { id: 'alergia', label: 'Tem alergia a algum remédio ou alimento?', type: 'select', options: ['Não', 'Sim'], required: true },
    { id: 'alergia_quais', label: 'Se sim, quais?', type: 'text', placeholder: 'Ex: Penicilina, dipirona' },
    { id: 'problemas_saude', label: 'Descreva os problemas de saúde que já teve', type: 'textarea', rows: 2 },
    { id: 'trata_saude', label: 'Atualmente trata de algum problema de saúde?', type: 'textarea', rows: 2 },
    { id: 'medicamentos', label: 'Toma algum medicamento?', type: 'select', options: ['Não', 'Sim'], required: true },
    { id: 'medicamentos_quais', label: 'Se sim, quais?', type: 'textarea', rows: 2 },
    { id: 'profissao', label: 'Profissão', type: 'text' },
    { id: 'indicacao', label: 'Como nos conheceu / Indicação', type: 'text' },
    { id: 'redes_sociais', label: 'Redes Sociais', type: 'text' },
  ],
  bodyTemplate: (d) => `
<div class="anamnese-grid">
  <div class="field-row"><strong>Queixa Principal:</strong> ${d.queixa_principal || blankLine()}</div>
  <div class="field-row"><strong>Alergia:</strong> ${d.alergia || 'SIM ( )  NÃO ( )'} ${d.alergia_quais ? `— Qual(is): ${d.alergia_quais}` : ''}</div>
  <div class="field-row"><strong>Problemas de saúde anteriores:</strong> ${d.problemas_saude || blankLine('', 80)}</div>
  <div class="field-row"><strong>Tratamento atual:</strong> ${d.trata_saude || blankLine('', 80)}</div>
  <div class="field-row"><strong>Medicamentos:</strong> ${d.medicamentos || 'SIM ( )  NÃO ( )'} ${d.medicamentos_quais ? `— Quais: ${d.medicamentos_quais}` : ''}</div>
  <div class="field-row"><strong>Profissão:</strong> ${d.profissao || blankLine()} &nbsp; <strong>Indicação:</strong> ${d.indicacao || blankLine()}</div>

  <h4 style="margin-top:12px">Sobre sua saúde BUCAL:</h4>
  <div class="checkbox-grid">
    <span>Dente quebrado?  SIM ( ) NÃO ( )</span>
    <span>Boca seca?  SIM ( ) NÃO ( )</span>
    <span>Dentes amarelados?  SIM ( ) NÃO ( )</span>
    <span>Mau hálito?  SIM ( ) NÃO ( )</span>
    <span>Dente sensível?  SIM ( ) NÃO ( )</span>
    <span>Dor na articulação?  SIM ( ) NÃO ( )</span>
    <span>Dor em algum dente?  SIM ( ) NÃO ( )</span>
    <span>Dente mole?  SIM ( ) NÃO ( )</span>
    <span>Dor na bochecha?  SIM ( ) NÃO ( )</span>
    <span>Língua arde?  SIM ( ) NÃO ( )</span>
  </div>

  <h4 style="margin-top:12px">Sobre sua saúde em geral:</h4>
  <div class="checkbox-grid">
    <span>Diabetes?  SIM ( ) NÃO ( )</span>
    <span>Epilepsia/convulsões?  SIM ( ) NÃO ( )</span>
    <span>Intestino regulado?  SIM ( ) NÃO ( )</span>
    <span>Alterações cardíacas?  SIM ( ) NÃO ( )</span>
    <span>Marcapasso?  SIM ( ) NÃO ( )</span>
    <span>Câncer?  SIM ( ) NÃO ( )</span>
    <span>Gestante?  SIM ( ) NÃO ( )</span>
    <span>Asma?  SIM ( ) NÃO ( )</span>
  </div>

  <h4 style="margin-top:12px">Sobre seus hábitos:</h4>
  <div class="field-row">Usa fio dental? _____ Quantas vezes? _____ Qual creme dental? _________________</div>
  <div class="field-row">Escova/raspa a língua? _____ Range ou aperta os dentes? _____</div>
  <div class="field-row">Morde bochechas/língua/lábio? _____ Usa enxaguatório? _____</div>

  <h4 style="margin-top:12px">Uso de substâncias:</h4>
  <div class="checkbox-grid small">
    <span>Carvão ativado ( )</span><span>Cúrcuma na escovação ( )</span><span>Shots de limão ( )</span>
    <span>Bochecho com vinagre ( )</span><span>Bebidas alcoólicas ( )</span><span>Energético ( )</span>
    <span>Café ( )</span><span>Cigarro ( )</span><span>Vape ( )</span><span>Maconha ( )</span>
    <span>Bicarbonato de sódio ( )</span><span>Palito de dentes ( )</span><span>Bochecho com sal ( )</span>
  </div>

  <p style="margin-top:14px; font-size:11px">Declaro para fins de direito que as informações acima prestadas são verdadeiras.</p>
  <p style="font-size:10px; color:#555">Este documento é confidencial e segue a LGPD 13.709/2018 - Lei Geral de Proteção de Dados Pessoais</p>
</div>`,
};

const evolucaoClinica: DocumentTemplate = {
  id: 'evolucao_clinica',
  category: 'clinico',
  name: 'Evolução Clínica',
  description: 'Registro de evolução por consulta',
  icon: 'ClipboardEdit',
  fields: [
    { id: 'entries', label: 'Registros (serão adicionados nas consultas)', type: 'textarea', rows: 4, placeholder: 'Este campo é preenchido pelo dentista a cada consulta.' },
  ],
  bodyTemplate: () => `
<table class="evolution-table">
  <thead>
    <tr><th>Data</th><th>Descrição do Atendimento</th><th>Assinatura Dentista</th><th>Rubrica Paciente</th></tr>
  </thead>
  <tbody>
    ${Array(12).fill('<tr><td class="date-col">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>').join('')}
  </tbody>
</table>`,
};

const controlePagamento: DocumentTemplate = {
  id: 'controle_pagamento',
  category: 'clinico',
  name: 'Controle de Pagamento',
  description: 'Registro de parcelas e formas de pagamento',
  icon: 'Receipt',
  fields: [
    { id: 'total_value', label: 'Valor Total do Tratamento', type: 'text', placeholder: 'Ex: R$ 3.500,00' },
  ],
  bodyTemplate: (d) => `
${d.total_value ? `<p><strong>Valor Total do Tratamento:</strong> ${d.total_value}</p>` : ''}
<table class="payment-table">
  <thead>
    <tr>
      <th>Data</th><th>Valor</th><th>Forma de Pagamento</th>
      <th>Data</th><th>Valor</th><th>Forma de Pagamento</th>
    </tr>
  </thead>
  <tbody>
    ${Array(10).fill('<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>').join('')}
  </tbody>
</table>`,
};

const orcamento: DocumentTemplate = {
  id: 'orcamento',
  category: 'clinico',
  name: 'Orçamento / Plano de Tratamento',
  description: 'Listagem de procedimentos com valores para o paciente',
  icon: 'FileText',
  fields: [
    { id: 'procedures_text', label: 'Procedimentos e Valores', type: 'textarea', rows: 10, placeholder: 'Ex:\nLimpeza completa .......... R$ 180,00\nRestauração dente 36 .... R$ 250,00\nTratamento de canal ....... R$ 850,00\n\nTotal: R$ 1.280,00', required: true },
    { id: 'payment_conditions', label: 'Condições de Pagamento', type: 'textarea', rows: 3, placeholder: 'Ex: Entrada de R$ 500,00 + 3x de R$ 260,00' },
    { id: 'validity_days', label: 'Validade do Orçamento (dias)', type: 'number', placeholder: '30' },
  ],
  bodyTemplate: (d) => `
<div class="doc-section">
  <pre class="procedures-text">${d.procedures_text || ''}</pre>
  ${d.payment_conditions ? `<p><strong>Condições de Pagamento:</strong> ${d.payment_conditions}</p>` : ''}
  ${d.validity_days ? `<p style="font-size:11px; margin-top:8px">* Este orçamento tem validade de ${d.validity_days} dias.</p>` : ''}
</div>`,
};

// =============================================================
// CATEGORIA 2: TCLEs
// =============================================================

const tcleCamposBase: DocumentField[] = [
  { id: 'responsible_name', label: 'Nome do Responsável Legal (se menor)', type: 'text', placeholder: 'Deixar em branco se o próprio paciente' },
];

const tcleGeral: DocumentTemplate = {
  id: 'tcle_geral',
  category: 'tcle',
  name: 'TCLE Geral',
  description: 'Termo de Consentimento Livre e Esclarecido padrão',
  icon: 'ShieldCheck',
  fields: tcleCamposBase,
  bodyTemplate: (d) => `
<div class="legal-text">
  <p>Pelo presente termo de consentimento livre e esclarecido, declaro que a cirurgiã-dentista <strong>{{DENTIST_NAME}}</strong>, devidamente inscrita no Conselho Regional de Odontologia sob o nº <strong>{{CRO}}</strong>, profissional escolhido para realizar o tratamento:</p>
  <ol>
    <li>A ficha de anamnese foi por mim preenchida e assinada, apresentando informações que correspondem à verdade dos fatos, especialmente no que diz respeito às minhas condições da saúde geral e bucal, não tendo omitido ou suprimido qualquer dado quanto a doenças pré-existentes.</li>
    <li>Considerando minha queixa principal e, após avaliação clínica e de eventuais exames complementares, a profissional me esclareceu sobre o diagnóstico e planejamento de tratamento, com alternativas e informações claras sobre os objetivos e riscos.</li>
    <li>Declaro, ainda, que estou ciente que eventuais ausências às consultas e o não atendimento das orientações profissionais prejudicarão o resultado pretendido, uma vez que a Odontologia não se trata de uma ciência exata, sofrendo limitações.</li>
    <li>Declaro que estou ciente de que deverei comparecer pontualmente no consultório do profissional nas sessões previamente agendadas.</li>
    <li>É de meu conhecimento de que devo informar à profissional qualquer alteração em decorrência do tratamento realizado, insatisfações ou dúvidas sobre o tratamento em execução.</li>
    <li>O(A) cirurgião-dentista declara que a técnica proposta e demais materiais que serão utilizados no meu tratamento possuem efetiva comprovação científica, respeitando o mais alto nível profissional.</li>
    <li>Estou ciente de que a Odontologia não é uma ciência exata e que os resultados esperados, a partir do diagnóstico, poderão não se concretizar em face da resposta biológica do meu organismo.</li>
    <li>Tenho conhecimento de que a cirurgiã-dentista possui o dever de elaborar e manter atualizado o meu prontuário, conservando-o em arquivo próprio, me garantido acesso ao mesmo.</li>
    <li>Declaro estar ciente do plano de tratamento odontológico, também de possíveis alterações que por ventura venham a ocorrer.</li>
    <li>Fui esclarecido (a) pelo profissional sobre as minhas condições atuais de saúde bucal.</li>
    <li>Fui esclarecido (a) pelo profissional que, a depender do tratamento necessário, pode apresentar riscos, como parestesia temporária ou permanente, fratura de dentes, inchaço, dor, sangramento/hemorragia, alveolite, etc.</li>
    <li>Declaro, ainda, que tenho conhecimento de que ao término do tratamento deverei retornar para consultas de acompanhamento de acordo com os critérios estabelecidos pelo profissional.</li>
  </ol>
  ${d.responsible_name ? `<p><strong>Responsável Legal:</strong> ${d.responsible_name}</p>` : ''}
</div>`,
};

const tcleClareamento: DocumentTemplate = {
  id: 'tcle_clareamento',
  category: 'tcle',
  name: 'TCLE — Clareamento Dental',
  description: 'Consentimento para clareamento dental (caseiro ou consultório)',
  icon: 'Sparkles',
  fields: [
    ...tcleCamposBase,
    { id: 'modalidade', label: 'Modalidade do Clareamento', type: 'select', options: ['Caseiro', 'Consultório'], required: true },
    { id: 'num_seringas', label: 'Nº de Seringas (se caseiro)', type: 'text', placeholder: 'Ex: 2' },
    { id: 'marca_gel', label: 'Marca do Gel', type: 'text', placeholder: 'Ex: Opalescence' },
    { id: 'concentracao', label: 'Concentração (%)', type: 'text', placeholder: 'Ex: 10%' },
    { id: 'num_sessoes', label: 'Nº de Sessões (se consultório)', type: 'text', placeholder: 'Ex: 2' },
    { id: 'duracao_sessao', label: 'Duração de cada sessão', type: 'text', placeholder: 'Ex: 45 minutos' },
  ],
  bodyTemplate: (d) => `
<div class="legal-text">
  <p>Pelo presente termo de consentimento livre e esclarecido, declaro que a cirurgiã-dentista <strong>{{DENTIST_NAME}}</strong>, CRO nº <strong>{{CRO}}</strong>, profissional escolhida para realizar o tratamento de <strong>CLAREAMENTO DENTAL</strong>.</p>
  <p>O clareamento dental é um procedimento estético que visa melhorar a cor dos dentes, com o intuito de deixá-los mais claros. Pode ser realizado de forma profissional no consultório ou com o uso de produtos fornecidos pelo dentista para aplicação em casa. Fui informado sobre as diferenças das técnicas e optei pelo clareamento realizado em:</p>
  ${d.modalidade === 'Caseiro' ? `
  <p>( X ) <strong>CASA</strong> — Foi entregue <strong>${d.num_seringas || '___'}</strong> seringa(s) da marca <strong>${d.marca_gel || '___________'}</strong> com concentração de <strong>${d.concentracao || '___'}</strong> que deverá ser aplicado em casa pelo paciente, sob orientação individualizada feita pelo cirurgião dentista.</p>` : `
  <p>( X ) <strong>CONSULTÓRIO</strong> — Serão realizadas de 1 a <strong>${d.num_sessoes || '___'}</strong> sessões com duração aproximada de <strong>${d.duracao_sessao || '___'}</strong> cada. O dentista utilizará o gel clareador da marca <strong>${d.marca_gel || '___________'}</strong> com concentração de <strong>${d.concentracao || '___'}</strong>.</p>`}
  <p>Entendo que por se tratar de um procedimento sem previsibilidade de resultados, fico ciente que o número de sessões pode variar para mais ou para menos, de acordo com a avaliação do cirurgião dentista.</p>
  <h4>POSSÍVEIS RISCOS E COMPLICAÇÕES</h4>
  <ol>
    <li>Sensibilidade temporária dos dentes;</li>
    <li>Irritação gengival;</li>
    <li>Desconforto durante e após o procedimento;</li>
    <li>Resultados insatisfatórios ou diferentes do esperado;</li>
    <li>Necessidade de tratamentos adicionais para manutenção dos resultados;</li>
    <li>Evidenciação temporária de manchas brancas por consequência do ressecamento dental.</li>
  </ol>
  <h4>INFORMAÇÕES COMPLEMENTARES</h4>
  <ol>
    <li>O resultado do clareamento pode variar conforme a estrutura e a cor natural dos dentes;</li>
    <li>Manter uma boa higiene bucal e seguir corretamente as orientações do cirurgião dentista é imprescindível para melhores resultados;</li>
    <li>O clareamento dental não é permanente e pode ser necessário realizar retoques periódicos;</li>
    <li>O clareamento altera a cor somente de dentes naturais. Restaurações, coroas, facetas, próteses <strong>não</strong> são clareadas com o gel clareador.</li>
  </ol>
  <p>Declaro que fui devidamente informado(a) sobre a natureza, os benefícios, os riscos e as possíveis complicações do clareamento dental. Compreendi todas as informações fornecidas e tive a oportunidade de fazer perguntas.</p>
  ${d.responsible_name ? `<p><strong>Responsável Legal:</strong> ${d.responsible_name}</p>` : ''}
</div>`,
};

const tcleEndodontia: DocumentTemplate = {
  id: 'tcle_endodontia',
  category: 'tcle',
  name: 'TCLE — Endodontia (Canal)',
  description: 'Consentimento para tratamento de canal',
  icon: 'Zap',
  fields: tcleCamposBase,
  bodyTemplate: (d) => `
<div class="legal-text">
  <p>Pelo presente termo de consentimento livre e esclarecido, declaro que a cirurgiã-dentista <strong>{{DENTIST_NAME}}</strong>, CRO nº <strong>{{CRO}}</strong>, profissional escolhida para realizar o tratamento:</p>
  <ol>
    <li>O procedimento de endodontia ("canal") visa eliminar focos infecciosos no interior da(s) raiz(es) dos dentes, através da limpeza e vedação dos condutos radiculares.</li>
    <li>As bactérias presentes podem ocasionar desordens sistêmicas (endocardite bacteriana, pneumonia, sinusites, infecções generalizadas, entre outras), além de dor aguda, desconforto, sensibilidade dental, dificuldade ao mastigar, abscessos, entre outros.</li>
    <li>Estou ciente da necessidade da reabilitação do(s) elemento(s) dentário(s) após o tratamento endodôntico. Os dentes com "canal" tratado devem ser restaurados ou receber peça protética, sendo um novo tratamento a ser realizado posteriormente.</li>
    <li>Estou ciente de que podem ocorrer intercorrências inerentes ao tratamento de canal, como fratura dental, perfurações radiculares, quebra de instrumentos dentro do conduto, podendo até ocasionar a perda do elemento dental. O cirurgião-dentista se compromete a conduzir todo tratamento e possíveis intercorrências de acordo com a ciência.</li>
    <li>São esperadas algumas reações comuns após o tratamento endodôntico, como dor e/ou sensibilidade. Se a dor se estender por mais de 3 dias, ou se houver inchaço local e/ou febre, o cirurgião dentista deve ser informado imediatamente.</li>
    <li>Fui orientado(a) a fazer o uso correto de toda medicação prescrita e demais cuidados locais de higiene.</li>
    <li>Fui informado que o tratamento endodôntico geralmente é realizado em uma única sessão, porém de acordo com a complexidade do caso pode se fazer necessário mais sessões.</li>
    <li>Estou ciente que devo comparecer a todas as consultas e retornar para a finalização do tratamento dentário nos dias e horários previamente acordados.</li>
    <li>As custas do tratamento endodôntico e do tratamento reabilitador deverão ser de total responsabilidade do PACIENTE.</li>
  </ol>
  <p><strong>Eu concordo com a realização do tratamento endodôntico ("canal") conforme descrito acima.</strong></p>
  ${d.responsible_name ? `<p><strong>Responsável Legal:</strong> ${d.responsible_name}</p>` : ''}
</div>`,
};

const tcleExodontia: DocumentTemplate = {
  id: 'tcle_exodontia',
  category: 'tcle',
  name: 'TCLE — Exodontia (Extração)',
  description: 'Consentimento para extração dentária',
  icon: 'Scissors',
  fields: tcleCamposBase,
  bodyTemplate: (d) => `
<div class="legal-text">
  <p>Pelo presente termo de consentimento livre e esclarecido, declaro que a cirurgiã-dentista <strong>{{DENTIST_NAME}}</strong>, CRO nº <strong>{{CRO}}</strong>, profissional escolhida para realizar o tratamento:</p>
  <ol>
    <li>O procedimento de extração dentária ("remoção do dente") visa eliminar focos infecciosos intraorais como: raízes dentárias, dentes cariados e/ou com comprometimento endodôntico sem possibilidades de tratamento, ou ainda a remoção de um elemento dentário para finalidade ortodôntica e/ou reabilitadora protética.</li>
    <li>As bactérias presentes podem ocasionar doenças sistêmicas (endocardite bacteriana, pneumonia, infecções generalizadas, entre outras). Estou ciente da necessidade da reabilitação do(s) elemento(s) dentário(s) perdido(s) afim de reestabelecer a função e a estética.</li>
    <li>O cirurgião dentista se compromete a utilizar técnica, materiais adequados e exames complementares, porém fico ciente que pode haver complicações durante e/ou após o ato cirúrgico. As mais comuns são: hemorragias, dor, fratura do dente, alveolite, trismo, edema, equimose, parestesia (reversível ou permanente).</li>
    <li>Estou ciente que devo manter o cirurgião dentista constantemente informado sobre a evolução do caso e devo esclarecer todas minhas dúvidas até a total cicatrização da cirurgia.</li>
    <li>Fui orientado verbalmente e foi me entregue por escrito todos os cuidados que devo manter pós cirúrgicos em relação a repouso, alimentação, higiene, entre outros.</li>
  </ol>
  ${d.responsible_name ? `<p><strong>Responsável Legal:</strong> ${d.responsible_name}</p>` : ''}
</div>`,
};

const tcleExodontiaDeciduo: DocumentTemplate = {
  id: 'tcle_exodontia_deciduo',
  category: 'tcle',
  name: 'TCLE — Exodontia Dente Decíduo',
  description: 'Consentimento para extração de dente de leite (menores)',
  icon: 'Baby',
  fields: [
    { id: 'responsible_name', label: 'Nome do Responsável Legal', type: 'text', required: true },
    { id: 'dente_deciduo', label: 'Dente a ser extraído (por extenso)', type: 'text', placeholder: 'Ex: primeiro molar inferior esquerdo (elemento 74)', required: true },
    { id: 'weight_kg', label: 'Peso da criança (Kg)', type: 'number', placeholder: 'Ex: 25', required: true },
    { id: 'num_tubetes', label: 'Quantidade máxima de tubetes anestésicos', type: 'number', placeholder: 'Ex: 2' },
  ],
  bodyTemplate: (d) => `
<div class="legal-text">
  <p>Eu, <strong>${d.responsible_name || blankLine()}</strong>, portador do CPF: <strong>{{PATIENT_CPF}}</strong>, após ter recebido e compreendido todas as informações necessárias sobre o procedimento de exodontia (extração) do dente decíduo <strong>${d.dente_deciduo || blankLine()}</strong>, consinto livremente com a realização deste procedimento, pelo profissional <strong>{{DENTIST_NAME}}</strong>, CRO: <strong>{{CRO}}</strong>.</p>
  <h4>Informações Recebidas:</h4>
  <p>Fui informado de que o procedimento de exodontia do dente decíduo ("dente de leite") envolve a remoção do dente mencionado, e que este procedimento será realizado sob anestesia local, na quantidade máxima calculada de <strong>${d.num_tubetes || '___'}</strong> tubete(s), de acordo com o peso do paciente de <strong>${d.weight_kg || '___'} Kg</strong>, informado por mim na data de hoje.</p>
  <p>Fui esclarecido(a) sobre os possíveis riscos e complicações associados à exodontia, incluindo, mas não se limitando a, dor, sangramento, infecção, e possíveis complicações com o desenvolvimento dos dentes permanentes.</p>
  <p>Fui informado(a) sobre as alternativas ao procedimento de exodontia, incluindo a opção de monitorar o dente decíduo.</p>
  <p>Recebi orientações verbais e por escrito sobre os cuidados que devo ter após a extração e pude esclarecer todas as minhas dúvidas de forma satisfatória.</p>
  <p><strong>Eu concordo com a realização do procedimento de exodontia do dente decíduo conforme descrito acima.</strong></p>
  <div class="signature-block">
    <div class="sig-line">__________________________</div>
    <div class="sig-label">Assinatura do Responsável: ${d.responsible_name || ''}</div>
  </div>
</div>`,
};

const tcleGengivoplastia: DocumentTemplate = {
  id: 'tcle_gengivoplastia',
  category: 'tcle',
  name: 'TCLE — Gengivoplastia e Osteotomia',
  description: 'Consentimento para cirurgia gengival e óssea',
  icon: 'Scissors',
  fields: tcleCamposBase,
  bodyTemplate: (d) => `
<div class="legal-text">
  <p>Pelo presente termo de consentimento livre e esclarecido, declaro que a cirurgiã-dentista <strong>{{DENTIST_NAME}}</strong>, CRO nº <strong>{{CRO}}</strong>, profissional escolhida para realizar o tratamento:</p>
  <ol>
    <li>O procedimento de gengivoplastia e osteotomia ("plástica gengival e óssea") consiste na remoção parcial de gengiva e osso ao redor dos dentes, visando melhorar a estética do sorriso no caso de pacientes com os chamados "sorrisos gengivais" e melhorar a higienização dos dentes que podem estar "cobertos" por excessos gengivais.</li>
    <li>Os dentes podem estar "cobertos" por excessos gengivais por diversos fatores: falha ou atraso na erupção dentária, anomalias ósseas, hiperplasia gengival por uso de medicamentos ou infecção bacteriana local.</li>
    <li>Fui esclarecido que, em casos de anomalias de desenvolvimento ósseo como protrusão de maxila, o tratamento indicado é a cirurgia ortognática realizada em centro cirúrgico hospitalar por equipe de bucomaxilofacial.</li>
    <li>A cirurgia será realizada em consultório, sob anestesia local, podendo ser em 1 (uma) ou 2 (duas) etapas, a depender da avaliação do cirurgião dentista.</li>
    <li>Fui esclarecido sobre os riscos cirúrgicos: hemorragia, edema (inchaço), equimose (mancha roxa na pele), dor, infecções locais, exposição radicular, sensibilidade dentária, necrose óssea, entre outros.</li>
    <li>O cirurgião dentista se compromete a utilizar técnica e materiais adequados com embasamento científico.</li>
    <li>Estou ciente que devo manter o cirurgião dentista constantemente informado sobre a evolução do caso.</li>
    <li>Fui orientado verbalmente e recebido por escrito todos os cuidados pós-cirúrgicos.</li>
  </ol>
  ${d.responsible_name ? `<p><strong>Responsável Legal:</strong> ${d.responsible_name}</p>` : ''}
</div>`,
};

const tcleAumentoCoroa: DocumentTemplate = {
  id: 'tcle_aumento_coroa',
  category: 'tcle',
  name: 'TCLE — Aumento de Coroa Clínica',
  description: 'Consentimento para cirurgia de aumento de coroa',
  icon: 'ArrowUp',
  fields: tcleCamposBase,
  bodyTemplate: (d) => `
<div class="legal-text">
  <p>Pelo presente termo de consentimento livre e esclarecido, declaro que a cirurgiã-dentista <strong>{{DENTIST_NAME}}</strong>, CRO nº <strong>{{CRO}}</strong>, profissional escolhida para realizar o tratamento:</p>
  <ol>
    <li>O procedimento de aumento de coroa clínica trata-se de uma cirurgia de remoção parcial de gengiva e osso ao redor dos dentes, visando aumentar a área visível do dente acima da gengiva.</li>
    <li>A cirurgia é indicada em casos de fraturas dentárias abaixo do nível gengival, lesões de cárie abaixo na linha gengival, hiperplasias gengivais causadas por uso de medicamentos ou por infecções.</li>
    <li>A cirurgia será realizada em consultório, sob anestesia local.</li>
    <li>A cirurgia é normalmente realizada em 1 (uma) etapa, no entanto poderá ser necessário refazer em casos de recidivas.</li>
    <li>Fui esclarecido sobre os riscos cirúrgicos: hemorragia, edema, equimose, dor, infecções locais, exposição radicular, sensibilidade dentária, exposição óssea, necrose óssea, entre outros.</li>
    <li>O cirurgião dentista se compromete a utilizar técnica, materiais adequados e exames complementares caso necessário.</li>
    <li>Estou ciente que devo manter o cirurgião dentista constantemente informado sobre a evolução do caso.</li>
    <li>Fui orientado verbalmente e recebido por escrito todos os cuidados pós-cirúrgicos.</li>
  </ol>
  ${d.responsible_name ? `<p><strong>Responsável Legal:</strong> ${d.responsible_name}</p>` : ''}
</div>`,
};

const tcleProtese = (id: string, name: string, tipo: string, descricao: string): DocumentTemplate => ({
  id,
  category: 'tcle',
  name,
  description: descricao,
  icon: 'Smile',
  fields: tcleCamposBase,
  bodyTemplate: (d) => `
<div class="legal-text">
  <p>Pelo presente termo de consentimento livre e esclarecido, declaro que a cirurgiã-dentista <strong>{{DENTIST_NAME}}</strong>, CRO nº <strong>{{CRO}}</strong>, profissional escolhida para realizar o tratamento de <strong>${tipo}</strong>:</p>
  <ol>
    <li>${tipo} tem como finalidade substituir os dentes perdidos e/ou extraídos com o objetivo de reestabelecer a capacidade funcional de mastigação e fala, além de reequilibrar a estética do sorriso.</li>
    <li>Entendo que é de extrema importância a avaliação de todas as estruturas internas da boca. Sendo assim, pode haver a necessidade de extrações dentárias e correções cirúrgicas prévias à confecção da prótese.</li>
    <li>O tratamento proposto é realizado normalmente em 5 (cinco) etapas, entre moldagens, medições, escolha de cor e formato dos dentes, e somente após minha aprovação, seguirá para a fase final e entrega da prótese.</li>
    <li>Estou ciente que eventuais ausências às consultas e o não cumprimento das orientações profissionais prejudicarão o resultado pretendido.</li>
    <li>Devo manter todos os meus dados cadastrais sempre atualizados e informando eventuais mudanças de endereço, telefone etc.</li>
    <li>Entendo a importância da saúde bucal e me comprometo a seguir as orientações da equipe odontológica, assim como a retornar às consultas de orientações programadas.</li>
    <li>A Odontologia não é uma ciência exata e, por isso, o resultado não é certo e não pode ser garantido.</li>
    <li>Fui esclarecido sobre os cuidados com a prótese e estou ciente da importância da manutenção diária de higienização oral.</li>
    <li>Estou ciente de que o hábito de fumar pode causar prejuízos à peça protética e a toda cavidade bucal.</li>
    <li>Caso haja qualquer alteração de saúde bucal, é de minha responsabilidade manter contato com o(a) profissional.</li>
    <li>Tenho conhecimento de que, ao término do tratamento, deverei retornar para consultas de acompanhamento.</li>
  </ol>
  ${d.responsible_name ? `<p><strong>Responsável Legal:</strong> ${d.responsible_name}</p>` : ''}
</div>`,
});

const tcleFacetas = (id: string, name: string, material: string): DocumentTemplate => ({
  id,
  category: 'tcle',
  name,
  description: `Consentimento para facetas em ${material}`,
  icon: 'Star',
  fields: tcleCamposBase,
  bodyTemplate: (d) => `
<div class="legal-text">
  <p>Pelo presente termo de consentimento livre e esclarecido, declaro que a cirurgiã-dentista <strong>{{DENTIST_NAME}}</strong>, CRO nº <strong>{{CRO}}</strong>, profissional escolhida para realizar o tratamento:</p>
  <ol>
    <li>O procedimento de "Facetas em ${material}" consiste no recobrimento total de uma face de um ou mais dentes com ${material}, com o intuito de melhorar a estética e função dos dentes.</li>
    <li>Estou ciente que há necessidade de mínimos desgastes dentários, baseados em evidências científicas, para a correta adaptação da faceta ao meu dente.</li>
    <li>Fui apresentado alternativas para meu tratamento e, após esclarecer todas minhas dúvidas, foi escolhido em comum acordo as Facetas em ${material}.</li>
    <li>Entendo que os desgastes são <strong>irreversíveis</strong>, ou seja, uma vez que a estrutura natural do meu dente é desgastada ela não voltará a ser como antes.</li>
    <li>Estou ciente de que a odontologia não é uma ciência exata e podem ocorrer intercorrências, como sensibilidade dentinária podendo levar até a necessidade de tratamento endodôntico.</li>
    <li>Dentes escurecidos ou com manchas podem ter alteração de cor mesmo após a confecção das facetas.</li>
    <li>Fui orientado sobre os cuidados que devo ter ao mastigar alimentos mais rígidos e sobre a necessidade de placa de bruxismo caso necessário.</li>
    <li>Devo comparecer a todas as consultas e retornar para a finalização do tratamento nos dias e horários previamente acordados.</li>
  </ol>
  <p><strong>Eu concordo com a realização do tratamento de "Facetas em ${material}" conforme descrito acima.</strong></p>
  ${d.responsible_name ? `<p><strong>Responsável Legal:</strong> ${d.responsible_name}</p>` : ''}
</div>`,
});

// =============================================================
// CATEGORIA 3: CONTRATOS E TERMOS
// =============================================================

const contratoServicos: DocumentTemplate = {
  id: 'contrato_servicos',
  category: 'contrato',
  name: 'Contrato de Prestação de Serviços',
  description: 'Contrato odontológico entre dentista e paciente',
  icon: 'FileSignature',
  fields: [
    { id: 'area_tratamento', label: 'Área do Tratamento', type: 'text', placeholder: 'Ex: Endodontia, Prótese Fixa, Clareamento' },
    { id: 'prazo_tratamento', label: 'Prazo Estimado', type: 'text', placeholder: 'Ex: 60 dias, 3 meses' },
    { id: 'valor_total', label: 'Valor Total (R$)', type: 'text', placeholder: 'Ex: 2.500,00', required: true },
    { id: 'valor_extenso', label: 'Valor por Extenso', type: 'text', placeholder: 'Ex: Dois mil e quinhentos reais', required: true },
    { id: 'patient_rg', label: 'RG do Paciente', type: 'text' },
    { id: 'patient_address', label: 'Endereço Completo do Paciente', type: 'text' },
    { id: 'patient_city', label: 'Cidade', type: 'text', placeholder: 'Gurupi' },
    { id: 'patient_cep', label: 'CEP', type: 'text' },
    { id: 'responsible_name', label: 'Nome do Responsável Legal (se menor)', type: 'text' },
    { id: 'responsible_rg', label: 'RG do Responsável Legal', type: 'text' },
  ],
  bodyTemplate: (d) => `
<div class="legal-text small">
  <h3 style="text-align:center">CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS</h3>
  <p>Pelo presente instrumento particular de contrato de prestação de serviços odontológicos, os contratantes, de um lado o(a) cirurgião(ã)-dentista <strong>{{DENTIST_NAME}}</strong>, devidamente inscrito(a) no Conselho Regional de Odontologia sob o nº <strong>{{CRO}}</strong>, doravante denominada <strong>CONTRATADA</strong> e, do outro lado o(a) Sr(a) <strong>{{PATIENT_NAME}}</strong>${d.responsible_name ? ` (responsável legal do menor ${d.responsible_name})` : ''}, portador(a) do RG nº <strong>${d.patient_rg || '___________'}</strong>, CPF nº <strong>{{PATIENT_CPF}}</strong>, residente a <strong>${d.patient_address || '___________________________'}</strong>, (cidade) <strong>${d.patient_city || '___________'}</strong>, CEP <strong>${d.patient_cep || '_________'}</strong>, doravante denominado(a) <strong>CONTRATANTE</strong>, têm entre si justo e acordado as seguintes condições:</p>

  <p><strong>DO OBJETO DO CONTRATO</strong><br>
  Cláusula Primeira – O(A) CONTRATADO(A) prestará ao CONTRATANTE serviços odontológicos, especificamente na área de <strong>${d.area_tratamento || '___________'}</strong>, importando na realização dos procedimentos constantes no plano de tratamento e planejamento de custos apresentado e aceito pelas partes.<br>
  Parágrafo Único – O tratamento proposto será realizado aproximadamente em <strong>${d.prazo_tratamento || '___________'}</strong>, podendo sofrer prorrogação ou alteração, de acordo com eventual complexidade do caso.</p>

  <p><strong>DO VALOR E DO PAGAMENTO</strong><br>
  Cláusula Segunda – O valor total relativo aos serviços odontológicos prestados é <strong>R$ ${d.valor_total || '___________'} (${d.valor_extenso || '___________________________'})</strong> e seu pagamento deverá ser efetuado nas datas indicadas no planejamento de custos apresentado e aprovado.<br>
  Parágrafo Segundo – Os pagamentos vencidos e efetuados fora dos prazos previstos, estarão sujeitos a atualização monetária e a multa de mora de 2% (dois por cento) e juros de 1% (um por cento) ao mês.</p>

  <p><strong>DAS OBRIGAÇÕES DO(A) CONTRATANTE</strong><br>
  Cláusula Terceira – Neste ato, obriga-se o(a) CONTRATANTE:<br>
  a) Comparecer pontualmente no consultório nas sessões previamente agendadas, cuja ausência, sem aviso prévio de 24 (vinte e quatro) horas, acarretará a cobrança de uma consulta;<br>
  b) Seguir, rigorosamente, as prescrições e orientações fornecidas pelo(a) CONTRATADO(A);<br>
  c) Informar ao(à) CONTRATADO(A) qualquer alteração em decorrência do tratamento realizado;<br>
  d) Manter seus dados cadastrais sempre atualizados.</p>

  <p><strong>DAS GARANTIAS E OBRIGAÇÕES DO(A) CONTRATADO(A)</strong><br>
  Cláusula Quarta – O(A) CONTRATADO(A) declara que a técnica proposta e demais materiais utilizados possuem efetiva comprovação científica.<br>
  Parágrafo Único – O(A) CONTRATANTE foi devidamente esclarecido sobre os propósitos, custos, riscos e alternativas de tratamento, bem como que a Odontologia não é uma ciência exata e que os resultados esperados poderão não se concretizar.</p>

  <p><strong>DO FORO</strong><br>
  Fica eleito o foro da Comarca de Gurupi/TO para dirimir eventuais dúvidas ou litígios decorrentes deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>

  <p>E por estarem assim justos e acordados, firmam o presente instrumento, na presença de duas testemunhas.</p>

  <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:24px">
    <div class="signature-block">
      <div class="sig-line">__________________________</div>
      <div class="sig-label">CONTRATANTE: {{PATIENT_NAME}}</div>
    </div>
    <div class="signature-block">
      <div class="sig-line">__________________________</div>
      <div class="sig-label">CONTRATADA: {{DENTIST_NAME}}</div>
    </div>
  </div>
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:16px">
    <div class="signature-block">
      <div class="sig-line">__________________________</div><div class="sig-label">Testemunha 1 — CPF:</div>
    </div>
    <div class="signature-block">
      <div class="sig-line">__________________________</div><div class="sig-label">Testemunha 2 — CPF:</div>
    </div>
  </div>
</div>`,
};

const termoRecusa: DocumentTemplate = {
  id: 'termo_recusa',
  category: 'contrato',
  name: 'Termo de Recusa de Tratamento',
  description: 'Paciente recusa tratamento proposto',
  icon: 'XCircle',
  fields: [
    { id: 'problema_identificado', label: 'Problema odontológico identificado', type: 'textarea', rows: 3, placeholder: 'Ex: Cárie extensa no dente 36 com necessidade de extração', required: true },
    { id: 'motivo_recusa', label: 'Motivo da Recusa', type: 'textarea', rows: 3, placeholder: 'Ex: Motivos financeiros' },
    { id: 'patient_rg', label: 'RG do Paciente', type: 'text' },
  ],
  bodyTemplate: (d) => `
<div class="legal-text">
  <p>Declaro por meio deste termo que estou ciente e recuso o tratamento proposto pela <strong>{{DENTIST_NAME}}</strong>, inscrita no Conselho Regional de Odontologia sob o número <strong>{{CRO}}</strong>, para o problema odontológico identificado como:</p>
  <p style="border:1px solid #ccc; padding:8px; margin:8px 0">${d.problema_identificado || blankLine('', 80)}</p>
  <p>Entendo que o tratamento recomendado foi devidamente explicado pelo profissional e que a recusa do mesmo pode acarretar consequências para minha saúde bucal, incluindo complicações adicionais e agravamento do quadro atual.</p>
  <p>Declaro estar ciente dos riscos associados à não realização do tratamento indicado e isento o dentista e a clínica odontológica de qualquer responsabilidade por eventuais danos decorrentes da minha decisão de recusar o tratamento.</p>
  <p>Assumo integralmente a responsabilidade pelas consequências dessa decisão e me comprometo a buscar orientação médica ou odontológica caso necessite no futuro.</p>
  <p>Este termo de recusa é assinado de livre e espontânea vontade, sem qualquer tipo de coação por parte do profissional de odontologia ou de terceiros.</p>
  <p><strong>Motivo da recusa:</strong> ${d.motivo_recusa || blankLine('', 80)}</p>
</div>`,
};

const termoConclusao: DocumentTemplate = {
  id: 'termo_conclusao',
  category: 'contrato',
  name: 'Termo de Conclusão de Tratamento',
  description: 'Documento de encerramento do tratamento',
  icon: 'CheckCircle',
  fields: [
    { id: 'tratamento_realizado', label: 'Tratamento Realizado', type: 'textarea', rows: 4, placeholder: 'Ex: Foram realizados tratamento de canal no elemento 46, restauração do elemento 36 e limpeza profilática.', required: true },
    { id: 'orientacoes_manutencao', label: 'Orientações de Manutenção', type: 'textarea', rows: 3, placeholder: 'Ex: Retorno semestral para profilaxia, uso de fio dental diário.' },
  ],
  bodyTemplate: (d) => `
<div class="legal-text">
  <h3 style="text-align:center">TERMO DE CONCLUSÃO DE TRATAMENTO ODONTOLÓGICO</h3>
  <p>Eu, <strong>{{PATIENT_NAME}}</strong>, CPF nº <strong>{{PATIENT_CPF}}</strong>, declaro que conclui o tratamento odontológico sob responsabilidade da <strong>{{DENTIST_NAME}}</strong>, CRO nº <strong>{{CRO}}</strong>.</p>
  <p><strong>Tratamento realizado:</strong></p>
  <p style="border:1px solid #ccc; padding:8px">${d.tratamento_realizado || ''}</p>
  ${d.orientacoes_manutencao ? `<p><strong>Orientações de manutenção:</strong> ${d.orientacoes_manutencao}</p>` : ''}
  <p>Declaro estar ciente de que devo retornar para consultas de acompanhamento periódico conforme orientado pelo profissional, a fim de resguardar e manter o tratamento realizado.</p>
  <p>Confirmo que recebi todas as orientações necessárias e que minhas dúvidas foram esclarecidas de forma satisfatória.</p>
</div>`,
};

const termoEntregaProntuario: DocumentTemplate = {
  id: 'termo_entrega_prontuario',
  category: 'contrato',
  name: 'Termo de Entrega de Prontuário',
  description: 'Recibo de entrega de documentação ao paciente',
  icon: 'FolderOpen',
  fields: [
    { id: 'documentos_entregues', label: 'Documentos Entregues', type: 'textarea', rows: 4, placeholder: 'Ex:\n- Radiografia panorâmica\n- Ficha de anamnese\n- Evolução clínica' },
  ],
  bodyTemplate: (d) => `
<div class="legal-text">
  <p>Eu, <strong>{{PATIENT_NAME}}</strong>, CPF nº <strong>{{PATIENT_CPF}}</strong>, declaro ter recebido, em boas condições, a seguinte documentação pertencente ao meu prontuário odontológico:</p>
  <div style="border:1px solid #ccc; padding:8px; margin:8px 0; min-height:80px">${(d.documentos_entregues || '').replace(/\n/g, '<br>')}</div>
  <p>Declaro estar ciente de que os documentos acima relacionados foram entregues de forma original e que, caso deseje cópias para o arquivo do consultório, as mesmas serão providenciadas com os custos de duplicação sob minha responsabilidade.</p>
</div>`,
};

const termoUsoImagem: DocumentTemplate = {
  id: 'termo_uso_imagem',
  category: 'contrato',
  name: 'Termo de Uso de Imagem',
  description: 'Autorização de uso de imagens para fins educacionais/marketing',
  icon: 'Camera',
  fields: [
    { id: 'finalidade', label: 'Finalidade do Uso da Imagem', type: 'select', options: ['Fins educacionais e científicos', 'Divulgação em redes sociais da clínica', 'Ambos'], required: true },
    { id: 'restricoes', label: 'Restrições (opcional)', type: 'text', placeholder: 'Ex: Não divulgar nome completo' },
  ],
  bodyTemplate: (d) => `
<div class="legal-text">
  <p>Eu, <strong>{{PATIENT_NAME}}</strong>, CPF nº <strong>{{PATIENT_CPF}}</strong>, autorizo o(a) cirurgião(ã)-dentista <strong>{{DENTIST_NAME}}</strong>, CRO nº <strong>{{CRO}}</strong>, a utilizar imagens (fotografias, vídeos) do meu caso clínico para:</p>
  <p style="border:1px solid #ccc; padding:8px"><strong>${d.finalidade || '___________________________'}</strong></p>
  ${d.restricoes ? `<p><strong>Restrições:</strong> ${d.restricoes}</p>` : ''}
  <p>Esta autorização é concedida sem ônus, em caráter irrevogável e irretratável, e em conformidade com a LGPD 13.709/2018. As imagens não serão usadas de forma que exponha ou prejudique minha imagem ou privacidade.</p>
</div>`,
};

const termoSolicitacaoCid: DocumentTemplate = {
  id: 'termo_solicitacao_cid',
  category: 'contrato',
  name: 'Termo de Solicitação de CID',
  description: 'Solicitação de informação do CID do paciente',
  icon: 'FileSearch',
  fields: [
    { id: 'medico_responsavel', label: 'Médico Responsável / Instituição', type: 'text', placeholder: 'Ex: Dr. João Silva / Hospital Geral de Gurupi' },
  ],
  bodyTemplate: (d) => `
<div class="legal-text">
  <p>Eu, <strong>{{PATIENT_NAME}}</strong>, CPF nº <strong>{{PATIENT_CPF}}</strong>, autorizo a cirurgiã-dentista <strong>{{DENTIST_NAME}}</strong>, CRO nº <strong>{{CRO}}</strong>, a solicitar ao médico responsável ${d.medico_responsavel ? `<strong>${d.medico_responsavel}</strong>` : blankLine()} informações relativas ao meu diagnóstico médico (CID), necessárias para o planejamento e execução segura do meu tratamento odontológico.</p>
  <p>Declaro estar ciente de que estas informações serão utilizadas exclusivamente para fins odontológicos, com total sigilo profissional, em conformidade com a LGPD 13.709/2018 e com o Código de Ética Odontológica.</p>
</div>`,
};

// =============================================================
// CATEGORIA 4: ENCAMINHAMENTOS
// =============================================================

const makeEncaminhamento = (
  id: string, name: string, descricao: string, icon: string,
  fields: DocumentField[], body: (d: Record<string, any>) => string
): DocumentTemplate => ({ id, category: 'encaminhamento', name, description: descricao, icon, fields, bodyTemplate: body });

const encBucomaxilo = makeEncaminhamento(
  'encaminhamento_bucomaxilo', 'Encaminhamento — Bucomaxilo', 'Encaminhamento para extração cirúrgica', 'Send',
  [
    { id: 'elemento_dental', label: 'Elemento(s) dental(is)', type: 'text', placeholder: 'Ex: 48 (terceiro molar inferior direito)', required: true },
    { id: 'queixa_paciente', label: 'Queixa do Paciente', type: 'textarea', rows: 2, placeholder: 'Ex: dor espontânea, dificuldade de abertura de boca' },
    { id: 'comorbidades', label: 'Comorbidades', type: 'text', placeholder: 'Ex: Hipertensão, diabetes' },
    { id: 'medicacoes', label: 'Medicações em uso', type: 'text', placeholder: 'Ex: Losartana 50mg' },
  ],
  (d) => `
<div class="encaminhamento-text">
  <p><strong>AO COLEGA BUCOMAXILO</strong></p>
  <p>Encaminho o paciente supracitado para exodontia do(s) elemento(s) <strong>${d.elemento_dental || blankLine()}</strong>.</p>
  <p>Paciente relata <strong>${d.queixa_paciente || blankLine('', 50)}</strong>.</p>
  <p>Paciente refere ter as seguintes comorbidades: <strong>${d.comorbidades || 'durante anamnese paciente nega ter quaisquer comorbidades'}</strong> e faz uso das seguintes medicações: <strong>${d.medicacoes || 'paciente nega'}</strong>.</p>
  <p>Segue radiografia panorâmica para avaliação. Paciente orientado que, caso seja necessário, irá ser solicitado pelo colega demais exames.</p>
  <p>Fico à disposição. Atenciosamente,</p>
</div>`
);

const encBucomaxiloAbscesso = makeEncaminhamento(
  'encaminhamento_bucomaxilo_abscesso', 'Encaminhamento — Bucomaxilo (Abscesso)', 'Encaminhamento urgente para possível abscesso', 'AlertTriangle',
  [
    { id: 'regiao', label: 'Região do Abscesso', type: 'text', placeholder: 'Ex: mandíbula direita', required: true },
    { id: 'historico', label: 'Histórico do Paciente', type: 'textarea', rows: 3, placeholder: 'Ex: forte dor em região de face, febre, EVA 10, inchaço' },
    { id: 'hd', label: 'Hipótese Diagnóstica (H.D)', type: 'text', placeholder: 'Ex: Abscesso endodôntico dente 46' },
    { id: 'obs', label: 'Obs', type: 'text', placeholder: 'Ex: Paciente com histórico de alergia a Penicilina' },
  ],
  (d) => `
<div class="encaminhamento-text">
  <p><strong>AO COLEGA BUCOMAXILO</strong></p>
  <p>Encaminho a paciente supracitada para avaliação e conduta de possível abscesso em região de <strong>${d.regiao || blankLine()}</strong>.</p>
  <p><strong>Histórico:</strong> ${d.historico || blankLine('', 80)}</p>
  <p>Solicito avaliação cautelosa por risco de evolução para Angina de Ludwig.</p>
  <p><strong>H.D:</strong> ${d.hd || blankLine()}</p>
  ${d.obs ? `<p><strong>Obs:</strong> ${d.obs}</p>` : ''}
  <p>Fico à disposição. Atenciosamente,</p>
</div>`
);

const encEndodontista = makeEncaminhamento(
  'encaminhamento_endodontista', 'Encaminhamento — Endodontista', 'Encaminhamento para tratamento de canal', 'Send',
  [
    { id: 'elemento', label: 'Elemento dental / Região', type: 'text', placeholder: 'Ex: Elemento 46 / Quadrante III', required: true },
    { id: 'achados_clinicos', label: 'Achados clínicos', type: 'text', placeholder: 'Ex: dor espontânea, fístula, abscesso' },
    { id: 'comorbidades', label: 'Comorbidades', type: 'text', placeholder: 'Ex: Diabetes' },
    { id: 'medicacoes', label: 'Medicações em uso', type: 'text', placeholder: 'Ex: Metformina 500mg' },
  ],
  (d) => `
<div class="encaminhamento-text">
  <p><strong>AO COLEGA ENDODONTISTA</strong></p>
  <p>Encaminho o paciente supracitado para avaliação e conduta endodôntica.</p>
  <p>Ao exame clínico apresenta: <strong>${d.achados_clinicos || blankLine()}</strong></p>
  <p>Elemento: <strong>${d.elemento || blankLine()}</strong></p>
  <p>Durante a anamnese, paciente refere ter as seguintes comorbidades: <strong>${d.comorbidades || 'paciente nega ter quaisquer comorbidades'}</strong> e faz uso das seguintes medicações: <strong>${d.medicacoes || 'paciente nega'}</strong>.</p>
  <p>Paciente ciente que poderá ser solicitado exames complementares para diagnóstico.</p>
  <p>Qualquer dúvida, estou à disposição. Atenciosamente,</p>
</div>`
);

const encOrtodontista = makeEncaminhamento(
  'encaminhamento_ortodontista', 'Encaminhamento — Ortodontista', 'Encaminhamento para avaliação ortodôntica', 'Send',
  [
    { id: 'adequacao_realizada', label: 'Adequação já realizada', type: 'text', placeholder: 'Ex: tratamento periodontal, restauração dente 36' },
    { id: 'preferencia_paciente', label: 'Preferência do Paciente', type: 'text', placeholder: 'Ex: alinhadores, ortodontia convencional' },
    { id: 'queixa_principal', label: 'Queixa Principal', type: 'text', placeholder: 'Ex: dentes tortos, vergonha de sorrir' },
    { id: 'conduta_posterior', label: 'Conduta Clínica Posterior', type: 'text', placeholder: 'Ex: levantamento de mordida para implante no elemento 36' },
    { id: 'retorno_meses', label: 'Retorno a cada (meses)', type: 'number', placeholder: '6' },
  ],
  (d) => `
<div class="encaminhamento-text">
  <p><strong>AO COLEGA ORTODONTISTA</strong></p>
  <p>Encaminho o paciente supracitado para avaliação e conduta ortodôntica.</p>
  <p>Já foi realizada toda adequação do meio bucal: <strong>${d.adequacao_realizada || blankLine()}</strong></p>
  <p>Paciente possui interesse em: <strong>${d.preferencia_paciente || blankLine()}</strong></p>
  <p>Queixa principal: <strong>${d.queixa_principal || blankLine()}</strong></p>
  ${d.conduta_posterior ? `<p>Conduta clínica posterior: <strong>${d.conduta_posterior}</strong></p>` : ''}
  ${d.retorno_meses ? `<p>Por gentileza, peço que a cada <strong>${d.retorno_meses}</strong> meses reencaminhe o mesmo de volta para mantermos a adequação e reforço de higiene oral.</p>` : ''}
  <p>Qualquer dúvida, estou à disposição. Atenciosamente,</p>
</div>`
);

const encImplantodontista = makeEncaminhamento(
  'encaminhamento_implantodontista', 'Encaminhamento — Implantodontista', 'Encaminhamento para avaliação de implante', 'Send',
  [
    { id: 'regiao', label: 'Região', type: 'text', placeholder: 'Ex: maxila / elemento 26', required: true },
    { id: 'exames_solicitados', label: 'Exames já solicitados', type: 'select', options: ['Tomografia', 'Radiografia panorâmica', 'Ambos', 'Nenhum'], required: true },
    { id: 'queixa', label: 'Queixa e Informações Relevantes', type: 'textarea', rows: 2, placeholder: 'Ex: histórico de perda de implante anterior, bruxismo' },
    { id: 'fumante', label: 'Tabagismo', type: 'select', options: ['Não fumante', 'Fumante'], required: true },
    { id: 'comorbidades', label: 'Comorbidades', type: 'text', placeholder: 'Ex: Diabetes tipo 2' },
    { id: 'medicacoes', label: 'Medicações em uso', type: 'text', placeholder: 'Ex: Metformina' },
  ],
  (d) => `
<div class="encaminhamento-text">
  <p><strong>AO COLEGA IMPLANTODONTISTA,</strong></p>
  <p>Encaminho o paciente supracitado para avaliação e conduta na região de <strong>${d.regiao || blankLine()}</strong>.</p>
  <p>Paciente relata tais comorbidades: <strong>${d.comorbidades || 'paciente nega'}</strong> e faz uso contínuo das seguintes medicações: <strong>${d.medicacoes || 'paciente nega'}</strong>.</p>
  <p><strong>Foi solicitado:</strong> ${d.exames_solicitados || blankLine()}</p>
  ${d.queixa ? `<p>Informações adicionais: <strong>${d.queixa}</strong></p>` : ''}
  <p>Paciente: <strong>${d.fumante || blankLine()}</strong></p>
  <p>Qualquer dúvida, estou à disposição. Atenciosamente,</p>
</div>`
);

const encDtm = makeEncaminhamento(
  'encaminhamento_dtm', 'Encaminhamento — Especialista DTM', 'Encaminhamento para disfunção temporomandibular', 'Send',
  [
    { id: 'queixa', label: 'Queixa do Paciente', type: 'textarea', rows: 3, placeholder: 'Ex: estalido, dor na articulação direita, bruxismo, zumbido, dor de cabeça', required: true },
  ],
  (d) => `
<div class="encaminhamento-text">
  <p><strong>AO COLEGA ESPECIALISTA EM DTM/DOR OROFACIAL</strong></p>
  <p>Encaminho o paciente supracitado para avaliação e conduta.</p>
  <p>Paciente relata: <strong>${d.queixa || blankLine('', 80)}</strong></p>
  <p>Qualquer dúvida, estou à disposição. Atenciosamente,</p>
</div>`
);

const encGineco = makeEncaminhamento(
  'encaminhamento_gineco', 'Encaminhamento — Ginecologista/Obstetra', 'Solicitação de avaliação obstétrica', 'Send',
  [
    { id: 'procedimento', label: 'Procedimento a Realizar', type: 'text', placeholder: 'Ex: exodontia do elemento 47', required: true },
    { id: 'motivo', label: 'Motivo', type: 'text', placeholder: 'Ex: foco de infecção local' },
    { id: 'duracao', label: 'Duração estimada (minutos)', type: 'number', placeholder: '30' },
    { id: 'anestesico', label: 'Sal anestésico e vasoconstritor', type: 'text', placeholder: 'Ex: Lidocaína 2% com Epinefrina 1:100.000' },
    { id: 'semanas_gestacao', label: 'Semanas de Gestação', type: 'number', placeholder: '18' },
    { id: 'medicacao_gestante', label: 'Medicação em uso', type: 'text', placeholder: 'Ex: Ácido fólico' },
    { id: 'comorbidade', label: 'Comorbidade para controle', type: 'text', placeholder: 'Ex: hipertensão gestacional' },
    { id: 'pa', label: 'PA na consulta (mmHg)', type: 'text', placeholder: 'Ex: 120 X 80' },
  ],
  (d) => `
<div class="encaminhamento-text">
  <p><strong>SOLICITAÇÃO DE AVALIAÇÃO OBSTÉTRICA — AO COLEGA GINECOLOGISTA/OBSTETRA</strong></p>
  <p>Encaminho a paciente supracitada que deverá ser submetida ao procedimento de <strong>${d.procedimento || blankLine()}</strong>, devido a <strong>${d.motivo || blankLine()}</strong>, com duração aproximada de <strong>${d.duracao || '___'}</strong> minutos, sob anestesia local (<strong>${d.anestesico || blankLine()}</strong>).</p>
  <p>Durante anamnese relatou estar gestante de <strong>${d.semanas_gestacao || '___'}</strong> semanas e fazer uso de <strong>${d.medicacao_gestante || blankLine()}</strong> diário para controle de <strong>${d.comorbidade || blankLine()}</strong>.</p>
  ${d.pa ? `<p>Ao exame físico apresentou PA = <strong>${d.pa} mmHg</strong>.</p>` : ''}
  <p>Solicito avaliação, conduta, e carta de liberação por escrito para darmos sequência ao atendimento.</p>
  <p>Qualquer dúvida, estou à disposição. Atenciosamente,</p>
</div>`
);

const encPatologista = makeEncaminhamento(
  'encaminhamento_patologista', 'Encaminhamento — Patologista', 'Encaminhamento para avaliação de lesão', 'Microscope',
  [
    { id: 'regiao', label: 'Região', type: 'text', placeholder: 'Ex: Mucosa jugal', required: true },
    { id: 'posicao', label: 'Posição', type: 'text', placeholder: 'Ex: direita, superior' },
    { id: 'dias_percepcao', label: 'Há quantos dias foi percebida', type: 'number', placeholder: '15' },
    { id: 'por_quem', label: 'Percebida por', type: 'text', placeholder: 'Ex: cirurgião dentista / paciente' },
    { id: 'tamanho_mm', label: 'Tamanho aproximado (mm)', type: 'number', placeholder: '5' },
    { id: 'coloracao', label: 'Coloração', type: 'select', options: ['rosada', 'branca', 'avermelhada', 'roxa', 'marrom', 'amarelada'] },
    { id: 'aspecto', label: 'Aspecto', type: 'select', options: ['rugoso', 'descamativo', 'bolhoso', 'ulcerado', 'liso', 'pedunculado', 'endurecido', 'séssil'] },
    { id: 'bordas', label: 'Bordas', type: 'select', options: ['bem definidas', 'desformes'] },
    { id: 'dor', label: 'Sintomatologia', type: 'select', options: ['indolor', 'com dor'] },
    { id: 'relato_paciente', label: 'Relato do Paciente', type: 'textarea', rows: 3, placeholder: 'Ex: já teve caso parecido, lesão após trauma, faz uso de cigarro...' },
  ],
  (d) => `
<div class="encaminhamento-text">
  <p><strong>AO COLEGA PATOLOGISTA</strong></p>
  <p>Solicito: Avaliação de lesão na região de <strong>${d.regiao || blankLine()}</strong>, <strong>${d.posicao || blankLine()}</strong>, perceptível há <strong>${d.dias_percepcao || '___'}</strong> dias pelo <strong>${d.por_quem || blankLine()}</strong>.</p>
  <p>Características clínicas: Lesão de aproximadamente <strong>${d.tamanho_mm || '___'}mm</strong>, com coloração <strong>${d.coloracao || blankLine()}</strong>, de aspecto <strong>${d.aspecto || blankLine()}</strong> e bordas <strong>${d.bordas || blankLine()}</strong>, <strong>${d.dor || blankLine()}</strong>.</p>
  ${d.relato_paciente ? `<p><strong>Relato do paciente:</strong> ${d.relato_paciente}</p>` : ''}
  <p>Biópsia, caso necessário. CID10: K132</p>
  <p>Fico à disposição. Atenciosamente,</p>
</div>`
);

const listaBifosfonato: DocumentTemplate = {
  id: 'lista_bifosfonato',
  category: 'encaminhamento',
  name: 'Lista de Bisfosfonatos (Triagem)',
  description: 'Triagem de uso de bisfosfonatos antes de cirurgias',
  icon: 'AlertCircle',
  fields: [],
  bodyTemplate: () => `
<div class="legal-text">
  <p>De acordo com as publicações científicas da literatura médico-odontológica, considerando a possibilidade de efeitos colaterais sobre os ossos maxilares, torna-se extremamente importante saber se você faz ou fez uso de um dos medicamentos a base de <strong>BISFOSFONATOS</strong>.</p>
  <div class="bifosfonato-grid">
    ${['ÁCIDO ALENDRÔNICO','ÁCIDO ZOLEDRÔNICO','ACLASTA','ACTONEL','ALENDIL','ALENDIL CÁLCIO D','ALENDRONATO SÓDICO','ARIMIDEX','BLAZTERE','BONALEN','BONEFÓS','BONEPREV','BONVIVA','BONVIVA IV','OSTEOFAR','OSTEOFORM','OSTEORAL','OSTEOTEC','OSTEOTRAT','PAMIDROM','PAMIDRONATO DISSÓDICO','RECALFE','RESIDRONATO SÓDICO','RESIDROSS','RISONATO','TEROST','ZOLIBBS','ZOMETA','CLEVERON','ENDRONAX','ENDROSTAN','ENDROX','FAULDPAMI','FOSAMAX','FOSAMAX D','IBANDRONATO DE SÓDIO','MINUSORB','MIOCALVEN','OSSOMAX','OSTENAN','OSTEOBAN','OSTEOBLOCK']
      .map(m => `<span>( ) ${m}</span>`).join('')}
  </div>
  <p style="margin-top:12px">
    ( ) Esclareço que utilizo ou utilizei o(s) medicamento(s) acima marcados.<br>
    ( ) Declaro para todos os fins que <strong>não</strong> utilizo nem utilizei nenhum dos medicamentos listados acima.
  </p>
</div>`,
};

// =============================================================
// CATEGORIA 5: ORIENTAÇÕES PÓS-PROCEDIMENTO
// =============================================================

const orientacaoClareamento: DocumentTemplate = {
  id: 'orientacao_clareamento',
  category: 'orientacao',
  name: 'Orientações — Clareamento Caseiro',
  description: 'Instruções pós-clareamento para o paciente',
  icon: 'Info',
  fields: [],
  bodyTemplate: () => `
<div class="orientacao-text">
  <p>Para garantir resultados eficazes e seguros, é essencial seguir corretamente as instruções fornecidas. Em caso de dúvida, não hesite em nos perguntar!</p>
  <ol>
    <li><strong>Utilização dos Produtos:</strong> Aplique uma pequena quantidade do gel clareador (equivalente ao tamanho de um gergelim por dente) na parte interna da moldeira.</li>
    <li><strong>Tempo de Uso:</strong> O tempo de uso pode variar de 1 a 4 horas. Nós iremos orientá-lo individualmente.</li>
    <li><strong>Higienização das Moldeiras:</strong> Após cada utilização, remova as moldeiras da boca e lave-as com água corrente (não utilizar água morna). Utilize uma escova de dentes macia e detergente neutro.</li>
    <li><strong>Atenção à Sensibilidade:</strong> Algumas pessoas podem apresentar sensibilidade dentária durante o clareamento. Se isso ocorrer, evite o uso de alimentos ácidos (limão, vinagre, suco de uva, refrigerantes). Caso o desconforto continue, interrompa o uso e nos informe imediatamente.</li>
    <li><strong>Cumpra o Cronograma de Consultas:</strong> É importante comparecer às consultas de acompanhamento agendadas para avaliação do progresso do clareamento.</li>
  </ol>
  <p style="margin-top:14px"><em>*Assinatura do(a) paciente: ___________________________________</em></p>
</div>`,
};

const orientacaoPosCirurgico: DocumentTemplate = {
  id: 'orientacao_pos_cirurgico',
  category: 'orientacao',
  name: 'Cuidados Pós-Cirúrgicos',
  description: 'Instruções após cirurgia odontológica',
  icon: 'AlertCircle',
  fields: [],
  bodyTemplate: () => `
<div class="orientacao-text">
  <ol>
    <li>Tomar toda a medicação prescrita nas doses e horários indicados.</li>
    <li>Morda firmemente a compressa de gaze até chegar em casa, então retire-a com cuidado.</li>
    <li>Fazer bolsa de gelo do lado de fora da face (com intervalos de 5 minutos), principalmente nas primeiras 4 horas.</li>
    <li>Não fume por 72 horas, pois pode provocar sangramento e interferir na cicatrização.</li>
    <li>Não cuspa e nem faça sucção por canudo — isso provoca sangramento.</li>
    <li>Evite atividades físicas ou esportivas nas primeiras 72 horas após a cirurgia.</li>
    <li>Evite exposição ao sol ou a qualquer fonte de calor durante as 48 horas após a cirurgia.</li>
    <li>É importante ingerir bastante quantidade de líquidos, evitando alimentos duros e quentes.</li>
    <li>Só se alimente após a cirurgia quando a anestesia passar totalmente. Coma alimentos gelados e macios (sorvete, vitamina, iogurte).</li>
    <li>Não faça bochechos vigorosos até remover os pontos.</li>
    <li>Escove os dentes suavemente, inclusive a região operada.</li>
    <li>Mantenha sua cabeça sempre elevada com vários travesseiros. Evite deitar nas primeiras 4 horas após a cirurgia.</li>
    <li>Comparecer aos retornos programados.</li>
    <li>Caso haja princípio de sangramento na região operada, morda suavemente uma gaze úmida dobrada e aplique gelo do lado de fora da face por 20 minutos ininterruptos.</li>
  </ol>
  <h4>Situações normais após cirurgia:</h4>
  <ul>
    <li>Algum sangramento após a cirurgia na área cirúrgica é normal.</li>
    <li>Algum desconforto (dor) depois de extrair qualquer dente é normal e pode ser controlado com a medicação prescrita.</li>
    <li>Edema (inchaço) dura de 3 a 5 dias — é reação normal do organismo.</li>
    <li>Regiões arroxeadas na área da cirurgia desaparecerão entre 7 e 14 dias.</li>
  </ul>
  <h4>Entre em contato se ocorrer:</h4>
  <ul>
    <li>Sangramento muito intenso que não para com gazes mordidas.</li>
    <li>Dor muito forte que não melhora com a medicação.</li>
    <li>Febre, mal estar geral, pus ou gosto amargo na boca.</li>
    <li>Vômito ou reações alérgicas na pele ou boca.</li>
  </ul>
  <p style="margin-top:14px"><em>Assinatura do paciente ou Responsável: ___________________________________</em></p>
</div>`,
};

const orientacaoPlacaBruxismo: DocumentTemplate = {
  id: 'orientacao_placa_bruxismo',
  category: 'orientacao',
  name: 'Cuidados com a Placa de Bruxismo',
  description: 'Instruções de higienização e uso da placa de bruxismo',
  icon: 'Moon',
  fields: [],
  bodyTemplate: () => `
<div class="orientacao-text">
  <ol>
    <li><strong>Remova a placa ao acordar:</strong> Lave-a cuidadosamente com água corrente utilizando uma escova de cerdas médias e um pouco de detergente neutro.</li>
    <li><strong>Não utilize produtos abrasivos:</strong> Não utilize cremes dentais — eles possuem produtos abrasivos que podem danificar sua placa.</li>
    <li><strong>Imersão Diurna:</strong> No período que não estiver utilizando, deixe sempre sua placa imersa em água. De 2 a 3 vezes por semana coloque-a em 200ml de água com 2 a 3 gotas de água sanitária ou 1 pastilha efervescente própria para próteses (como Corega Tabs). Enxágue abundantemente antes de reutilizá-la.</li>
    <li><strong>Atenção à Higiene Bucal:</strong> Continue com a higiene bucal regular — escove os dentes com escova macia, creme dental e fio dental após as refeições. Higienize a língua.</li>
    <li><strong>Visitas Regulares ao Dentista:</strong> Agende consultas de acompanhamento para avaliar a adaptação e contatos da placa.</li>
    <li><strong>Cuidados ao Manipular a Placa:</strong> Ao remover a placa, retire-a com cuidado fazendo movimento de gangorra.</li>
    <li><strong>Adaptação:</strong> Uma placa nova pode causar estranheza e desconforto nos primeiros dias. Caso não melhore em até 3 dias, não hesite em nos procurar.</li>
  </ol>
  <p style="margin-top:14px"><em>Assinatura do paciente ou representante legal: ___________________________________</em></p>
</div>`,
};

const orientacaoProtese: DocumentTemplate = {
  id: 'orientacao_protese',
  category: 'orientacao',
  name: 'Cuidados com a Prótese',
  description: 'Instruções de uso e higienização de prótese dentária',
  icon: 'Smile',
  fields: [],
  bodyTemplate: () => `
<div class="orientacao-text">
  <ol>
    <li><strong>Remova diariamente sua prótese:</strong> Retire sua prótese após as refeições e antes de dormir. Lave-a cuidadosamente com água corrente, utilizando escova de cerdas médias e detergente neutro, escovar todas as superfícies incluindo a parte interna, externa, grampos e metais.</li>
    <li><strong>Não utilize produtos abrasivos:</strong> Não utilize cremes dentais — eles possuem produtos abrasivos que podem danificar sua prótese.</li>
    <li><strong>Imersão Noturna:</strong> Durante a noite ou no período que não estiver utilizando, deixe sempre sua prótese imersa em água. De 2 a 3 vezes por semana coloque-a em 200ml de água com 2 a 3 gotas de água sanitária ou 1 pastilha efervescente (como Corega Tabs).</li>
    <li><strong>Atenção à Higiene Bucal:</strong> Mesmo usando prótese, escove gengivas e língua, e continue higienizando os dentes naturais com escova macia, creme dental e fio dental após as refeições.</li>
    <li><strong>Visitas Regulares ao Dentista:</strong> Agende consultas de acompanhamento para avaliar a adaptação da prótese e fazer ajustes quando necessário.</li>
    <li><strong>Cuidados ao Manipular a Prótese:</strong> Ao remover ou colocar a prótese, segure-a firmemente sobre uma toalha ou superfície macia para evitar danos em caso de queda.</li>
    <li><strong>Adaptação:</strong> Uma prótese nova pode causar estranheza e desconforto nos primeiros dias. Procure consumir alimentos mais macios até a total adaptação. Podem ocorrer aftas e pequenos machucados nos primeiros dias — se não melhorar em até 3 dias, nos procure. <em>Não utilize lixas ou tesouras para tentar ajustá-la!</em></li>
  </ol>
  <p style="margin-top:14px"><em>Assinatura do paciente ou representante legal: ___________________________________</em></p>
</div>`,
};

// =============================================================
// EXPORT — Todos os 29 templates organizados
// =============================================================

export const ALL_TEMPLATES: DocumentTemplate[] = [
  // Clínicos
  receituario,
  anamnese,
  evolucaoClinica,
  controlePagamento,
  orcamento,
  // TCLEs
  tcleGeral,
  tcleClareamento,
  tcleEndodontia,
  tcleExodontia,
  tcleExodontiaDeciduo,
  tcleGengivoplastia,
  tcleAumentoCoroa,
  tcleProtese('tcle_protese_fixa', 'TCLE — Prótese Fixa', 'Prótese Fixa (coroa)', 'Consentimento para prótese fixa'),
  tcleProtese('tcle_protese_parcial_removivel', 'TCLE — Prótese Parcial Removível', 'Prótese Parcial Removível', 'Consentimento para prótese parcial removível'),
  tcleProtese('tcle_protese_provisoria', 'TCLE — Prótese Provisória Removível', 'Prótese Provisória Imediata Removível', 'Consentimento para prótese provisória'),
  tcleProtese('tcle_protese_total', 'TCLE — Prótese Total', 'Prótese Total (dentadura)', 'Consentimento para prótese total'),
  tcleFacetas('tcle_facetas_emax', 'TCLE — Facetas E.max', 'E.max (Dissilicato de Lítio)'),
  tcleFacetas('tcle_facetas_resina', 'TCLE — Facetas em Resina', 'Resina Composta'),
  // Contratos
  contratoServicos,
  termoRecusa,
  termoConclusao,
  termoEntregaProntuario,
  termoUsoImagem,
  termoSolicitacaoCid,
  // Encaminhamentos
  encBucomaxilo,
  encBucomaxiloAbscesso,
  encEndodontista,
  encOrtodontista,
  encImplantodontista,
  encDtm,
  encGineco,
  encPatologista,
  listaBifosfonato,
  // Orientações
  orientacaoClareamento,
  orientacaoPosCirurgico,
  orientacaoPlacaBruxismo,
  orientacaoProtese,
];

export const TEMPLATES_BY_CATEGORY = {
  clinico: ALL_TEMPLATES.filter(t => t.category === 'clinico'),
  tcle: ALL_TEMPLATES.filter(t => t.category === 'tcle'),
  contrato: ALL_TEMPLATES.filter(t => t.category === 'contrato'),
  encaminhamento: ALL_TEMPLATES.filter(t => t.category === 'encaminhamento'),
  orientacao: ALL_TEMPLATES.filter(t => t.category === 'orientacao'),
};

export const CATEGORY_LABELS: Record<string, string> = {
  clinico: '📋 Documentos Clínicos',
  tcle: '📄 TCLEs',
  contrato: '🤝 Contratos e Termos',
  encaminhamento: '🔬 Encaminhamentos',
  orientacao: '💊 Orientações Pós-Procedimento',
};

// Sugestão automática de TCLE com base no procedimento agendado
export const suggestTcleByProcedure = (procedureName: string): DocumentTemplate | null => {
  const lower = procedureName.toLowerCase();
  if (lower.includes('canal') || lower.includes('endodont')) return ALL_TEMPLATES.find(t => t.id === 'tcle_endodontia') || null;
  if (lower.includes('extração') || lower.includes('exodont') || lower.includes('extrac')) return ALL_TEMPLATES.find(t => t.id === 'tcle_exodontia') || null;
  if (lower.includes('clareamento')) return ALL_TEMPLATES.find(t => t.id === 'tcle_clareamento') || null;
  if (lower.includes('prótese fixa') || lower.includes('coroa')) return ALL_TEMPLATES.find(t => t.id === 'tcle_protese_fixa') || null;
  if (lower.includes('prótese total') || lower.includes('dentadura')) return ALL_TEMPLATES.find(t => t.id === 'tcle_protese_total') || null;
  if (lower.includes('e.max') || lower.includes('dissilicato')) return ALL_TEMPLATES.find(t => t.id === 'tcle_facetas_emax') || null;
  if (lower.includes('faceta') && lower.includes('resina')) return ALL_TEMPLATES.find(t => t.id === 'tcle_facetas_resina') || null;
  if (lower.includes('gengivoplast') || lower.includes('osteotom')) return ALL_TEMPLATES.find(t => t.id === 'tcle_gengivoplastia') || null;
  if (lower.includes('implante')) return ALL_TEMPLATES.find(t => t.id === 'encaminhamento_implantodontista') || null;
  return null;
};
