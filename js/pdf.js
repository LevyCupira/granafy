// ====================================================
// PDF.JS - Exportar relatorio PDF
// ====================================================

function exportPDF() {
  var jsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDF) return alert('Biblioteca PDF nao carregada.');
  if (!activeClient) return alert('Selecione um cliente.');

  var c = data.clients[activeClient];
  var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var W = 210;
  var M = 14;
  var y = M;
  var hoje = new Date().toLocaleDateString('pt-BR');

  var fmtVal = function(v) {
    return 'R$ ' + Math.abs(Number(v || 0)).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };
  var fmtPos = function(v) { return fmtVal(v); };
  var fmtNeg = function(v) { return '- ' + fmtVal(v); };
  var fmtSigned = function(v) { return (Number(v || 0) < 0 ? '- ' : '') + fmtVal(v); };

  var periodosFiltro = Array.isArray(window._graficosPeriodos)
    ? window._graficosPeriodos.filter(Boolean)
    : [];
  var periodoSet = new Set(periodosFiltro);
  var mesFiltro = periodosFiltro.length === 1 ? periodosFiltro[0] : '';
  var periodoLabel = periodosFiltro.length
    ? periodosFiltro.map(formatPeriodoLabel).join(', ')
    : 'Periodo selecionado';

  var isAbatimento = function(l) {
    return typeof isAbatimentoDespesaResumo === 'function' && isAbatimentoDespesaResumo(l);
  };

  doc.setFillColor(30, 35, 54);
  doc.rect(0, 0, W, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('Granafy', M, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatorio Financeiro - ' + c.name, M + 30, 12);
  doc.text('Periodo: ' + periodoLabel, M + 30, 18);
  doc.text('Gerado em ' + hoje, W - M, 19, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(150, 175, 220);
  doc.text('Desenvolvido por Levy Lima - Teste Beta Granafy', M, 23);
  y = 36;

  var todasBase = getTransacoes(activeClient);
  var todas = periodosFiltro.length
    ? todasBase.filter(function(l) { return periodoSet.has((l.data || '').slice(0, 7)); })
    : todasBase;
  var consolidado = typeof consolidarTransacoesAnaliticas === 'function'
    ? consolidarTransacoesAnaliticas(todas)
    : null;
  var cartaoFiltrado = periodosFiltro.length
    ? (c.cartao || []).filter(function(it) { return periodoSet.has((it.data || '').slice(0, 7)); })
    : (c.cartao || []);
  var extratoFiltrado = periodosFiltro.length
    ? (c.extrato || []).filter(function(l) { return periodoSet.has((l.data || '').slice(0, 7)); })
    : (c.extrato || []);

  var tR = consolidado
    ? consolidado.totalReceitas
    : todas.filter(function(l) { return l.tipo === 'credito'; }).reduce(function(s, l) { return s + l.valor; }, 0);
  var tD = consolidado
    ? consolidado.totalDespesas
    : todas.filter(function(l) { return l.tipo === 'debito'; }).reduce(function(s, l) { return s + l.valor; }, 0);
  var saldo = tR - tD;
  var faturaTotal = cartaoFiltrado.reduce(function(s, it) {
    if (it.tipo === 'pagamento') return s;
    return s + (it.tipo === 'estorno' ? -Number(it.valor || 0) : Number(it.valor || 0));
  }, 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 35, 54);
  doc.text('RESUMO GERAL - ' + periodoLabel, M, y);
  y += 6;
  doc.setDrawColor(91, 140, 255);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 5;

  var cards = [
    ['Total Receitas', fmtPos(tR), '#1fad90'],
    ['Total Despesas', fmtNeg(tD), '#e03b3b'],
    ['Resultado', fmtSigned(saldo), saldo >= 0 ? '#1fad90' : '#e03b3b'],
    ['Fatura Cartao', fmtNeg(faturaTotal), '#d4900a']
  ];
  var cw = (W - M * 2 - 9) / 4;
  cards.forEach(function(card, i) {
    var lbl = card[0];
    var val = card[1];
    var cor = card[2];
    var cx = M + i * (cw + 3);
    doc.setFillColor(240, 242, 248);
    doc.roundedRect(cx, y, cw, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(90, 96, 122);
    doc.text(lbl.toUpperCase(), cx + cw / 2, y + 6, { align: 'center' });
    var rgb = cor === '#1fad90' ? [31, 173, 144] : cor === '#e03b3b' ? [224, 59, 59] : [212, 144, 10];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.text(val, cx + cw / 2, y + 13, { align: 'center' });
  });
  y += 26;

  var despesasAnaliticas = consolidado ? consolidado.despesas : [];
  var fixas = despesasAnaliticas.filter(function(l) { return l.classe === 'fixa'; });
  var variaveis = despesasAnaliticas.filter(function(l) { return l.classe !== 'fixa'; });
  var tFix = fixas.reduce(function(s, l) { return s + l.valor; }, 0);
  var tVar = variaveis.reduce(function(s, l) { return s + l.valor; }, 0);
  var txPoup = tR > 0 ? ((tR - tD) / tR * 100).toFixed(1) + '%' : '-';

  if (y > 230) {
    doc.addPage();
    y = M;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 35, 54);
  doc.text('DRE - DEMONSTRACAO DO RESULTADO', M, y);
  y += 4;
  doc.setDrawColor(91, 140, 255);
  doc.line(M, y, W - M, y);
  y += 3;
  doc.autoTable({
    startY: y,
    head: [['Descricao', 'Valor']],
    body: [
      ['(+) Receita Total', fmtPos(tR)],
      ['(-) Despesas Fixas', fmtNeg(tFix)],
      ['(-) Despesas Variaveis', fmtNeg(tVar)],
      ['(=) Resultado Liquido', fmtSigned(tR - tD)],
      ['Taxa de Poupanca', txPoup]
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [91, 140, 255], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 250] },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: M, right: M }
  });
  y = doc.lastAutoTable.finalY + 10;

  var meses = periodosFiltro.length
    ? periodosFiltro.slice().sort().reverse()
    : Array.from(new Set(todas.map(function(l) { return (l.data || '').slice(0, 7); }).filter(Boolean))).sort().reverse().slice(0, 6);

  if (meses.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = M;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 35, 54);
    doc.text('RECEITAS E DESPESAS POR MES', M, y);
    y += 4;
    doc.setDrawColor(91, 140, 255);
    doc.line(M, y, W - M, y);
    y += 3;

    var rows = meses.reverse().map(function(m) {
      var parts = m.split('-');
      var yr = parts[0];
      var mo = parts[1];
      var cons = consolidarTransacoesAnaliticas(todas.filter(function(l) {
        return (l.data || '').startsWith(m);
      }));
      var r = cons.totalReceitas;
      var d = cons.totalDespesas;
      return [mo + '/' + yr, fmtPos(r), fmtNeg(d), fmtSigned(r - d)];
    });

    doc.autoTable({
      startY: y,
      head: [['Mes', 'Receitas', 'Despesas', 'Resultado']],
      body: rows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [91, 140, 255], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 246, 250] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  var cartao = cartaoFiltrado;
  if (cartao.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = M;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 35, 54);
    doc.text('LANCAMENTOS DO CARTAO (ultimos 50)', M, y);
    y += 4;
    doc.setDrawColor(255, 198, 107);
    doc.line(M, y, W - M, y);
    y += 3;

    var ccRows = cartao
      .slice()
      .sort(function(a, b) { return (b.data || '').localeCompare(a.data || ''); })
      .slice(0, 50)
      .map(function(it) {
        var cc = (c.cartoes || []).find(function(x) { return x.id === it.cartaoId; });
        return [
          it.data ? it.data.split('-').reverse().join('/') : '-',
          cc ? cc.nome : '-',
          it.desc,
          it.cat || '-',
          it.tipo === 'estorno' ? 'Estorno' : (it.tipo === 'pagamento' ? 'Pagamento' : 'Lancamento'),
          it.tipo === 'estorno' ? fmtPos(it.valor) : fmtNeg(it.valor)
        ];
      });

    doc.autoTable({
      startY: y,
      head: [['Data', 'Cartao', 'Descricao', 'Categoria', 'Tipo', 'Valor']],
      body: ccRows,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [255, 198, 107], textColor: [30, 35, 54], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 246, 250] },
      columnStyles: { 5: { halign: 'right' } },
      margin: { left: M, right: M }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  var extrato = extratoFiltrado;
  if (extrato.length > 0) {
    if (y > 230) {
      doc.addPage();
      y = M;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 35, 54);
    doc.text('CONTA CORRENTE (ultimos 50)', M, y);
    y += 4;
    doc.setDrawColor(62, 207, 176);
    doc.line(M, y, W - M, y);
    y += 3;

    var exRows = extrato
      .slice()
      .sort(function(a, b) { return (b.data || '').localeCompare(a.data || ''); })
      .slice(0, 50)
      .map(function(l) {
        var abatimento = isAbatimento(l);
        return [
          l.data ? l.data.split('-').reverse().join('/') : '-',
          abatimento ? String(l.desc || '') + ' (abatimento de despesa)' : l.desc,
          l.cat || '-',
          abatimento ? 'Abatimento' : (l.tipo === 'credito' ? 'Receita' : 'Despesa'),
          abatimento ? fmtPos(l.valor) : (l.tipo === 'credito' ? fmtPos(l.valor) : fmtNeg(l.valor))
        ];
      });

    doc.autoTable({
      startY: y,
      head: [['Data', 'Descricao', 'Categoria', 'Tipo', 'Valor']],
      body: exRows,
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [62, 207, 176], textColor: [30, 35, 54], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 246, 250] },
      columnStyles: { 4: { halign: 'right' } },
      margin: { left: M, right: M }
    });
  }

  var pages = doc.internal.getNumberOfPages();
  for (var p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 155, 170);
    doc.text('Granafy - ' + c.name + ' - ' + hoje, M, 295);
    doc.setFont('helvetica', 'italic');
    doc.text('Desenvolvido por Levy Lima - Teste Beta Granafy', W / 2, 295, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text('Pagina ' + p + '/' + pages, W - M, 295, { align: 'right' });
  }

  doc.save(
    'granafy_relatorio_'
    + c.name.toLowerCase().replace(/\s+/g, '_')
    + '_'
    + new Date().toISOString().slice(0, 10)
    + '.pdf'
  );
}
