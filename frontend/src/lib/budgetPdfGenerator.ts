// ============================================================================
// budgetPdfGenerator.ts
// Gerador nativo de PDF A4 (PDF 1.4 + WinAnsiEncoding para acentuação PT-BR)
// Gera o documento de Orçamento e Plano de Tratamento em Base64 (application/pdf)
// ============================================================================

import type { BudgetPatient, BudgetLineItem, BudgetStatus } from '../components/PatientBudget';

export interface BudgetPdfParams {
  clinicName: string;
  dentistName: string;
  dentistCro: string;
  clinicAddress: string;
  clinicPhone: string;
  clinicCity: string;
  patient: BudgetPatient;
  items: BudgetLineItem[];
  subtotal: number;
  discountType: 'value' | 'percent';
  discountInput: number;
  discountAmount: number;
  total: number;
  paymentConditions: string;
  validityDays: number;
  observations?: string;
  status: BudgetStatus;
  createdAt?: string;
}

const formatCurrency = (val: number) =>
  Number(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDateShort = (dateStr?: string) => {
  if (!dateStr) return 'Não informada';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

// Mapa de caracteres Unicode especiais para códigos WinAnsi (Windows-1252)
const WIN_ANSI_MAP: Record<number, number> = {
  0x20ac: 128, // €
  0x201a: 130, // ‚
  0x0192: 131, // ƒ
  0x201e: 132, // „
  0x2026: 133, // …
  0x2020: 134, // †
  0x2021: 135, // ‡
  0x02c6: 136, // ˆ
  0x2030: 137, // ‰
  0x0160: 138, // Š
  0x2039: 139, // ‹
  0x0152: 140, // Œ
  0x017d: 142, // Ž
  0x2018: 145, // ‘
  0x2019: 146, // ’
  0x201c: 147, // “
  0x201d: 148, // ”
  0x2022: 149, // •
  0x2013: 150, // –
  0x2014: 151, // —
  0x02dc: 152, // ˜
  0x2122: 153, // ™
  0x0161: 154, // š
  0x203a: 155, // ›
  0x0153: 156, // œ
  0x017e: 158, // ž
  0x0178: 159, // Ÿ
};

/**
 * Escapa uma string JS para literal de texto PDF usando WinAnsiEncoding.
 */
function pdfEscapeWinAnsi(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    let byte = code;
    if (code > 255) {
      byte = WIN_ANSI_MAP[code] || 45; // fallback '-'
    }
    if (byte === 40) {
      out += '\\(';
    } else if (byte === 41) {
      out += '\\)';
    } else if (byte === 92) {
      out += '\\\\';
    } else if (byte < 32 || byte > 126) {
      out += '\\' + byte.toString(8).padStart(3, '0');
    } else {
      out += String.fromCharCode(byte);
    }
  }
  return out;
}

/**
 * Estima largura aproximada em pontos para fonte Helvetica de tamanho `fontSize`.
 */
function estimateTextWidth(text: string, fontSize: number): number {
  let widthUnits = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ('ilI.,:;!| '.includes(ch)) widthUnits += 0.28;
    else if ('mwMW@%'.includes(ch)) widthUnits += 0.78;
    else if (ch >= 'A' && ch <= 'Z') widthUnits += 0.65;
    else widthUnits += 0.52;
  }
  return widthUnits * fontSize;
}

/**
 * Quebra um texto longo em múltiplas linhas que caibam em `maxWidth`.
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  if (!text) return [''];
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/);
    if (words.length === 0 || (words.length === 1 && words[0] === '')) {
      lines.push('');
      continue;
    }
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${currentLine} ${words[i]}`;
      if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Gera o arquivo PDF em Base64 (Data URI: data:application/pdf;base64,...)
 */
export function generateBudgetPdfBase64(params: BudgetPdfParams): {
  dataUri: string;
  base64: string;
  fileName: string;
} {
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89; // A4
  const marginX = 42;
  const contentWidth = pageWidth - marginX * 2;

  const ops: string[] = [];
  let y = pageHeight - 46;

  // Helpers de desenho PDF
  const setFillRgb = (r: number, g: number, b: number) => {
    ops.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`);
  };

  const setStrokeRgb = (r: number, g: number, b: number) => {
    ops.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} RG`);
  };

  const drawRect = (
    x: number,
    rectY: number,
    w: number,
    h: number,
    mode: 'S' | 'f' | 'B' = 'S'
  ) => {
    ops.push(`${x.toFixed(2)} ${rectY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${mode}`);
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number, lineWidth = 1) => {
    ops.push(`${lineWidth.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  };

  const drawText = (
    text: string,
    x: number,
    textY: number,
    font: 'F1' | 'F2' | 'F3' = 'F1',
    size = 10,
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    let finalX = x;
    if (align === 'center') {
      finalX = x - estimateTextWidth(text, size) / 2;
    } else if (align === 'right') {
      finalX = x - estimateTextWidth(text, size);
    }
    ops.push(
      `BT /${font} ${size} Tf 1 0 0 1 ${finalX.toFixed(2)} ${textY.toFixed(2)} Tm (${pdfEscapeWinAnsi(
        text
      )}) Tj ET`
    );
  };

  // =========================================================================
  // 1. CABEÇALHO DA CLÍNICA E PROFISSIONAL
  // =========================================================================
  setFillRgb(17, 24, 39);
  drawText(params.clinicName || params.dentistName, marginX, y, 'F2', 14);

  const issueDate = params.createdAt
    ? new Date(params.createdAt).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');

  setFillRgb(55, 65, 81);
  drawText(`Emissão: ${issueDate}`, pageWidth - marginX, y, 'F1', 9.5, 'right');

  y -= 14;
  drawText(
    `Profissional: ${params.dentistName} — CRO: ${params.dentistCro}`,
    marginX,
    y,
    'F2',
    9.5
  );
  drawText(
    `Validade: ${params.validityDays || 30} dias`,
    pageWidth - marginX,
    y,
    'F1',
    9.5,
    'right'
  );

  y -= 13;
  setFillRgb(75, 85, 99);
  drawText(params.clinicAddress || '', marginX, y, 'F1', 9);

  const statusLabel =
    params.status === 'approved'
      ? 'Status: APROVADO'
      : params.status === 'rejected'
      ? 'Status: RECUSADO'
      : 'Status: EM AVALIAÇÃO';
  drawText(statusLabel, pageWidth - marginX, y, 'F2', 9, 'right');

  y -= 13;
  drawText(`Tel / WhatsApp: ${params.clinicPhone || ''}`, marginX, y, 'F1', 9);

  // Linha divisória azul
  y -= 10;
  setStrokeRgb(37, 99, 235);
  drawLine(marginX, y, pageWidth - marginX, y, 1.5);

  // =========================================================================
  // 2. TÍTULO DO DOCUMENTO
  // =========================================================================
  y -= 20;
  setFillRgb(17, 24, 39);
  drawText(
    'ORÇAMENTO E PLANO DE TRATAMENTO ODONTOLÓGICO',
    pageWidth / 2,
    y,
    'F2',
    12,
    'center'
  );

  // =========================================================================
  // 3. QUADRO DE DADOS DO PACIENTE
  // =========================================================================
  y -= 12;
  const patientBoxHeight = params.patient.responsible_name ? 68 : 54;
  const patientBoxBottom = y - patientBoxHeight;

  setFillRgb(248, 250, 252);
  setStrokeRgb(203, 213, 225);
  ops.push('0.75 w');
  drawRect(marginX, patientBoxBottom, contentWidth, patientBoxHeight, 'B');

  let py = y - 14;
  setFillRgb(17, 24, 39);
  drawText(`Paciente: ${params.patient.name}`, marginX + 10, py, 'F2', 9.5);
  drawText(
    `CPF: ${params.patient.cpf || 'Não informado'}`,
    marginX + contentWidth * 0.55,
    py,
    'F1',
    9.5
  );

  py -= 13;
  drawText(
    `Telefone: ${params.patient.phone || 'Não informado'}`,
    marginX + 10,
    py,
    'F1',
    9
  );
  drawText(
    `Data de Nasc.: ${formatDateShort(params.patient.birth_date)}`,
    marginX + contentWidth * 0.55,
    py,
    'F1',
    9
  );

  py -= 13;
  const fullAddr = [
    params.patient.address,
    params.patient.city ? `${params.patient.city}/${params.patient.state || 'TO'}` : '',
    params.patient.zip_code ? `CEP: ${params.patient.zip_code}` : '',
  ]
    .filter(Boolean)
    .join(' — ');
  drawText(
    `Endereço: ${fullAddr || 'Não informado'}`,
    marginX + 10,
    py,
    'F1',
    9
  );

  if (params.patient.responsible_name) {
    py -= 13;
    drawText(
      `Responsável Legal: ${params.patient.responsible_name}`,
      marginX + 10,
      py,
      'F2',
      9
    );
  }

  y = patientBoxBottom - 16;

  // =========================================================================
  // 4. TABELA DE PROCEDIMENTOS
  // =========================================================================
  const colX = {
    idx: marginX,
    name: marginX + 26,
    region: marginX + 260,
    qty: marginX + 365,
    unit: marginX + 405,
    sub: marginX + contentWidth,
  };

  const headerH = 20;
  setFillRgb(241, 245, 249);
  setStrokeRgb(203, 213, 225);
  drawRect(marginX, y - headerH, contentWidth, headerH, 'B');

  setFillRgb(30, 41, 59);
  const thY = y - 13.5;
  drawText('#', colX.idx + 6, thY, 'F2', 9);
  drawText('Procedimento / Tratamento Proposto', colX.name + 4, thY, 'F2', 9);
  drawText('Dente / Região', colX.region + 4, thY, 'F2', 9);
  drawText('Qtd', colX.qty + 18, thY, 'F2', 9, 'center');
  drawText('Valor Unit.', colX.unit + 42, thY, 'F2', 9, 'right');
  drawText('Subtotal', colX.sub - 6, thY, 'F2', 9, 'right');

  y -= headerH;

  const rowH = 19;
  params.items.forEach((item, index) => {
    if (y - rowH < 140) return; // limite seguro de página única A4
    setFillRgb(index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252, 255);
    setStrokeRgb(226, 232, 240);
    drawRect(marginX, y - rowH, contentWidth, rowH, 'B');

    const rowTextY = y - 13;
    setFillRgb(17, 24, 39);
    drawText(String(index + 1), colX.idx + 6, rowTextY, 'F1', 9);

    const procLabel =
      item.name.length > 44 ? item.name.slice(0, 41) + '...' : item.name;
    drawText(procLabel, colX.name + 4, rowTextY, 'F2', 9);

    const regLabel =
      (item.tooth_region || 'Geral').length > 20
        ? (item.tooth_region || 'Geral').slice(0, 18) + '...'
        : item.tooth_region || 'Geral';
    drawText(regLabel, colX.region + 4, rowTextY, 'F1', 9);

    drawText(String(item.quantity), colX.qty + 18, rowTextY, 'F1', 9, 'center');
    drawText(
      `R$ ${formatCurrency(item.unit_price)}`,
      colX.unit + 42,
      rowTextY,
      'F1',
      9,
      'right'
    );
    drawText(
      `R$ ${formatCurrency(item.quantity * item.unit_price)}`,
      colX.sub - 6,
      rowTextY,
      'F2',
      9,
      'right'
    );

    y -= rowH;
  });

  // =========================================================================
  // 5. CAIXA DE TOTAIS
  // =========================================================================
  y -= 12;
  const totalsBoxW = 215;
  const totalsBoxX = pageWidth - marginX - totalsBoxW;
  const totalsBoxH = params.discountAmount > 0 ? 58 : 44;

  setFillRgb(248, 250, 252);
  setStrokeRgb(203, 213, 225);
  drawRect(totalsBoxX, y - totalsBoxH, totalsBoxW, totalsBoxH, 'B');

  let ty = y - 14;
  setFillRgb(55, 65, 81);
  drawText('Subtotal Bruto:', totalsBoxX + 10, ty, 'F1', 9.5);
  drawText(
    `R$ ${formatCurrency(params.subtotal)}`,
    totalsBoxX + totalsBoxW - 10,
    ty,
    'F2',
    9.5,
    'right'
  );

  if (params.discountAmount > 0) {
    ty -= 14;
    setFillRgb(21, 128, 61);
    const discLabel =
      params.discountType === 'percent'
        ? `Desconto (${params.discountInput}%):`
        : 'Desconto:';
    drawText(discLabel, totalsBoxX + 10, ty, 'F1', 9.5);
    drawText(
      `- R$ ${formatCurrency(params.discountAmount)}`,
      totalsBoxX + totalsBoxW - 10,
      ty,
      'F2',
      9.5,
      'right'
    );
  }

  ty -= 16;
  setStrokeRgb(203, 213, 225);
  drawLine(totalsBoxX + 8, ty + 10, totalsBoxX + totalsBoxW - 8, ty + 10, 0.6);

  setFillRgb(30, 58, 138);
  drawText('VALOR TOTAL:', totalsBoxX + 10, ty - 1, 'F2', 10.5);
  drawText(
    `R$ ${formatCurrency(params.total)}`,
    totalsBoxX + totalsBoxW - 10,
    ty - 1,
    'F2',
    11,
    'right'
  );

  y -= totalsBoxH + 14;

  // =========================================================================
  // 6. CONDIÇÕES DE PAGAMENTO E OBSERVAÇÕES
  // =========================================================================
  const payLines = wrapText(
    `Forma e Condições de Pagamento: ${params.paymentConditions || 'À combinar'}`,
    contentWidth - 20,
    9.5
  );
  const payBoxH = Math.max(36, payLines.length * 13 + 22);

  setFillRgb(255, 255, 255);
  setStrokeRgb(226, 232, 240);
  drawRect(marginX, y - payBoxH, contentWidth, payBoxH, 'B');

  let payY = y - 14;
  setFillRgb(17, 24, 39);
  for (const line of payLines) {
    drawText(line, marginX + 10, payY, 'F2', 9.5);
    payY -= 13;
  }
  setFillRgb(107, 114, 128);
  drawText(
    `* Este orçamento tem validade de ${params.validityDays || 30} dias a contar da data de sua emissão.`,
    marginX + 10,
    payY,
    'F3',
    8.5
  );

  y -= payBoxH + 10;

  if (params.observations && params.observations.trim()) {
    const obsLines = wrapText(params.observations.trim(), contentWidth - 20, 9);
    const obsBoxH = Math.min(72, obsLines.length * 12 + 24);

    setFillRgb(255, 255, 255);
    setStrokeRgb(226, 232, 240);
    drawRect(marginX, y - obsBoxH, contentWidth, obsBoxH, 'B');

    let obsY = y - 13;
    setFillRgb(17, 24, 39);
    drawText('Observações Clínicas / Recomendações:', marginX + 10, obsY, 'F2', 9);
    obsY -= 13;
    setFillRgb(55, 65, 81);
    for (const line of obsLines.slice(0, 4)) {
      drawText(line, marginX + 10, obsY, 'F1', 9);
      obsY -= 12;
    }

    y -= obsBoxH + 10;
  }

  // =========================================================================
  // 7. DECLARAÇÃO E ASSINATURAS
  // =========================================================================
  y -= 6;
  setFillRgb(75, 85, 99);
  const declLines = wrapText(
    'Declaro que fui devidamente esclarecido(a) sobre o diagnóstico, plano de tratamento odontológico acima descrito, seus custos, alternativas e orientações clínicas, estando de acordo com as condições apresentadas.',
    contentWidth,
    8.5
  );
  for (const line of declLines) {
    drawText(line, marginX, y, 'F1', 8.5);
    y -= 11;
  }

  y -= 10;
  setFillRgb(17, 24, 39);
  const now = new Date();
  const longDate = `${params.clinicCity || 'Gurupi'}, ${now.getDate()} de ${now.toLocaleString(
    'pt-BR',
    { month: 'long' }
  )} de ${now.getFullYear()}.`;
  drawText(longDate, marginX, y, 'F1', 9.5);

  // Assinaturas
  y -= 42;
  const sigW = 210;
  const leftSigX = marginX + 15;
  const rightSigX = pageWidth - marginX - sigW - 15;

  setStrokeRgb(55, 65, 81);
  drawLine(leftSigX, y, leftSigX + sigW, y, 0.8);
  drawLine(rightSigX, y, rightSigX + sigW, y, 0.8);

  y -= 12;
  setFillRgb(17, 24, 39);
  drawText(
    params.patient.name,
    leftSigX + sigW / 2,
    y,
    'F2',
    9,
    'center'
  );
  drawText(
    params.dentistName,
    rightSigX + sigW / 2,
    y,
    'F2',
    9,
    'center'
  );

  y -= 11;
  setFillRgb(107, 114, 128);
  drawText(
    params.patient.cpf ? `CPF: ${params.patient.cpf}` : 'Paciente / Responsável Legal',
    leftSigX + sigW / 2,
    y,
    'F1',
    8.5,
    'center'
  );
  drawText(
    `CRO: ${params.dentistCro}`,
    rightSigX + sigW / 2,
    y,
    'F1',
    8.5,
    'center'
  );

  // =========================================================================
  // MONTAGEM DA ESTRUTURA PDF 1.4
  // =========================================================================
  const contentStream = ops.join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>\nendobj`
  );
  objects.push(
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj'
  );
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj'
  );
  objects.push(
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>\nendobj'
  );
  objects.push(
    `7 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`
  );

  let pdfBody = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(pdfBody.length);
    pdfBody += obj + '\n';
  }

  const xrefStart = pdfBody.length;
  pdfBody += `xref\n0 ${objects.length + 1}\n`;
  pdfBody += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdfBody += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdfBody += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  // Converter string ASCII do PDF para Base64
  const base64 = btoa(pdfBody);
  const safeName = (params.patient.name || 'Paciente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Orcamento_${safeName}.pdf`;

  return {
    dataUri: `data:application/pdf;base64,${base64}`,
    base64,
    fileName,
  };
}

