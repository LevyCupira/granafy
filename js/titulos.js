// Financeiro PJ: contas a receber / contas a pagar.

var _tfNatureza = 'receber';
var _tfStatus = 'todos';
var _tfDescricao = '';
var _tfBusca = '';
var _tfAuditoriaEvento = 'todos';
var _tfAuditoriaPeriodo = '30';
var _tfAuditoriaBusca = '';
var _tfPanels = {
  novo: false
};

var COLS_TITULOS = [
  { key: 'vencimento', label: 'Vencimento', render: item => '<span style="color:var(--muted);font-size:.78rem">' + esc(formatDate(item.vencimento)) + '</span>' },
  { key: 'pessoa', label: 'Pessoa', render: item => '<strong>' + esc(item.pessoaNome || '-') + '</strong>' },
  { key: 'descricao', label: 'Descriçãoo', render: item => esc(item.descricao || '-') + (tfDescribeRecorrencia(item) ? '<div class="installment-note">' + esc(tfDescribeRecorrencia(item)) + '</div>' : '') + (item.observacao ? '<div class="installment-note">' + esc(item.observacao) + '</div>' : '') },
  { key: 'status', label: 'Status', render: item => '<span class="tf-status-badge ' + esc(tfStatusOf(item)) + '">' + esc(tfStatusLabel(tfStatusOf(item))) + '</span>' },
  { key: 'total', label: 'Total', render: item => '<span class="val ' + (_tfNatureza === 'receber' ? 'val-pos' : 'val-neg') + '">' + (_tfNatureza === 'receber' ? fmt(item.valorTotal || 0) : ('- ' + fmt(item.valorTotal || 0)) ) + '</span>' },
  { key: 'baixado', label: 'Baixado', render: item => '<span style="color:var(--accent3);font-weight:700">' + fmt(tfTotalBaixado(item)) + '</span>' },
  { key: 'saldo', label: 'Saldo', render: item => '<span style="color:' + (tfSaldo(item) > 0 ? 'var(--warning)' : 'var(--success)') + ';font-weight:700">' + fmt(tfSaldo(item)) + '</span>' },
  { key: '_del', label: '', render: () => '' }
];

function tfClienteAtivo() {
  return activeClient && data && data.clients ? data.clients[activeClient] : null;
}

function tfClienteEhPJ() {
  var cliente = tfClienteAtivo();
  return !!(cliente && String(cliente.tipoCliente || '').toLowerCase() === 'pj');
}

function tfTitulosCliente() {
  var cliente = tfClienteAtivo();
  return cliente && Array.isArray(cliente.titulos) ? cliente.titulos : [];
}

function tfTitulosDisponiveisParaNatureza(natureza) {
  return tfSortItems(tfTitulosCliente().filter(function(item) {
    return item.natureza === natureza && tfSaldo(item) > 0;
  }));
}

function tfBaixasPorLancamentoId(lancamentoId, natureza) {
  if (!lancamentoId) return [];
  var resultados = [];
  tfTitulosCliente().forEach(function(item) {
    if (natureza && item.natureza !== natureza) return;
    (item.baixas || []).forEach(function(baixa) {
      if (baixa.lancamentoId === lancamentoId) {
        resultados.push({
          tituloId: item.id,
          tituloPessoa: item.pessoaNome || '',
          tituloDescricao: item.descricao || '',
          tituloNatureza: item.natureza,
          baixa: baixa
        });
      }
    });
  });
  return resultados;
}

function tfValorConciliadoLancamento(lancamentoId, natureza) {
  return tfBaixasPorLancamentoId(lancamentoId, natureza).reduce(function(sum, item) {
    return sum + Number(item.baixa.valor || 0);
  }, 0);
}

function tfNormalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tfParseAmountFromInput(id) {
  return parseMoney(document.getElementById(id));
}

function tfTotalBaixado(item) {
  return Number((item.baixas || []).reduce(function(sum, baixa) {
    return sum + Number(baixa.valor || 0);
  }, 0));
}

function tfSaldo(item) {
  return Math.max(0, Number(item.valorTotal || 0) - tfTotalBaixado(item));
}

function tfIsOverdue(item) {
  if (!item || !item.vencimento || tfSaldo(item) <= 0) return false;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var due = new Date(String(item.vencimento).slice(0, 10) + 'T00:00:00');
  if (isNaN(due.getTime())) return false;
  return due < today;
}

function tfStatusOf(item) {
  var baixado = tfTotalBaixado(item);
  var total = Number(item.valorTotal || 0);
  if (total > 0 && baixado >= total) return 'quitado';
  if (baixado > 0) return 'parcial';
  if (tfIsOverdue(item)) return 'atrasado';
  return 'aberto';
}

function tfStatusLabel(status) {
  if (status === 'quitado') return _tfNatureza === 'receber' ? 'Recebido' : 'Pago';
  if (status === 'parcial') return _tfNatureza === 'receber' ? 'Recebido parcial' : 'Pago parcial';
  if (status === 'atrasado') return 'Atrasado';
  return 'Em aberto';
}

function tfSortItems(items) {
  return items.slice().sort(function(a, b) {
    var statusOrder = { atrasado: 0, aberto: 1, parcial: 2, quitado: 3 };
    var sa = statusOrder[tfStatusOf(a)] || 9;
    var sb = statusOrder[tfStatusOf(b)] || 9;
    if (sa !== sb) return sa - sb;
    var da = String(a.vencimento || '9999-99-99');
    var db = String(b.vencimento || '9999-99-99');
    if (da !== db) return da.localeCompare(db);
    return String(a.pessoaNome || '').localeCompare(String(b.pessoaNome || ''), 'pt-BR');
  });
}

function tfFilteredItems() {
  return tfSortItems(tfTitulosCliente().filter(function(item) {
    if (item.natureza !== _tfNatureza) return false;
    if (_tfStatus !== 'todos' && tfStatusOf(item) !== _tfStatus) return false;
    if (_tfDescricao) {
      var descricao = tfNormalizeText(item.descricao || '');
      if (descricao.indexOf(tfNormalizeText(_tfDescricao)) === -1) return false;
    }
    if (_tfBusca) {
      var hay = tfNormalizeText([item.pessoaNome, item.observacao].join(' '));
      if (hay.indexOf(tfNormalizeText(_tfBusca)) === -1) return false;
    }
    return true;
  }));
}

function tfSummaryValues() {
  var items = tfTitulosCliente();
  var receber = 0;
  var pagar = 0;
  var recebido = 0;
  var pago = 0;
  var vencidos = 0;

  items.forEach(function(item) {
    var saldo = tfSaldo(item);
    var baixado = tfTotalBaixado(item);
    if (item.natureza === 'receber') receber += saldo;
    if (item.natureza === 'pagar') pagar += saldo;
    if (item.natureza === 'receber') recebido += baixado;
    if (item.natureza === 'pagar') pago += baixado;
    if (tfIsOverdue(item)) vencidos++;
  });

  return {
    receber: receber,
    pagar: pagar,
    recebido: recebido,
    pago: pago,
    vencidos: vencidos,
    total: items.length
  };
}

function tfCurrentMonthKey() {
  var now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function tfReferenciaMes(dataIso) {
  return String(dataIso || '').slice(0, 7);
}

function tfMonthLabel(key) {
  var parts = String(key || '').split('-');
  if (parts.length !== 2) return key || '-';
  return parts[1] + '/' + parts[0];
}

function tfLancamentoContaComoInicial(lanc) {
  return typeof extratoLancamentoEhSaldoInicial === 'function' ? extratoLancamentoEhSaldoInicial(lanc) : false;
}

function tfResumoExecutivo() {
  var cliente = tfClienteAtivo();
  var resumo = tfSummaryValues();
  var mesAtual = tfCurrentMonthKey();
  var extrato = cliente && Array.isArray(cliente.extrato) ? cliente.extrato : [];
  var titulos = tfTitulosCliente();
  var extratoOperacional = extrato.filter(function(lanc) {
    return !tfLancamentoContaComoInicial(lanc);
  });
  var extratoMes = extratoOperacional.filter(function(lanc) {
    return String(lanc.data || '').slice(0, 7) === mesAtual;
  });
  var recebidoMes = extratoMes.filter(function(lanc) { return lanc.tipo === 'credito'; }).reduce(function(total, lanc) {
    return total + Number(lanc.valor || 0);
  }, 0);
  var pagoMes = extratoMes.filter(function(lanc) { return lanc.tipo === 'debito'; }).reduce(function(total, lanc) {
    return total + Number(lanc.valor || 0);
  }, 0);
  var devolucoesPendentes = extratoOperacional.filter(function(lanc) {
    return typeof extratoStatusEstornoValor === 'function' && extratoStatusEstornoValor(lanc) === 'pendente_estorno';
  });
  var estornosConcluidos = extratoOperacional.filter(function(lanc) {
    return typeof extratoStatusEstornoValor === 'function' && extratoStatusEstornoValor(lanc) === 'estornado';
  });
  var devolucoesPendentesValor = devolucoesPendentes.reduce(function(total, lanc) {
    return total + Math.abs(Number(lanc.valor || 0));
  }, 0);
  var estornosConcluidosValor = estornosConcluidos.reduce(function(total, lanc) {
    return total + Math.abs(Number(lanc.valor || 0));
  }, 0);
  var vencidosReceber = titulos.filter(function(item) { return item.natureza === 'receber' && tfIsOverdue(item) && tfSaldo(item) > 0; });
  var inadimplenciaValor = vencidosReceber.reduce(function(total, item) {
    return total + tfSaldo(item);
  }, 0);
  var elegiveisMes = extratoMes.filter(function(lanc) {
    return typeof extratoIgnoraConciliacao === 'function' ? !extratoIgnoraConciliacao(lanc) : true;
  });
  var conciliadosMes = elegiveisMes.filter(function(lanc) {
    return typeof extratoResolvidoConciliacao === 'function' ? extratoResolvidoConciliacao(cliente, lanc) : false;
  });
  var taxaConciliacaoMes = elegiveisMes.length ? (conciliadosMes.length / elegiveisMes.length) * 100 : 100;
  var receberAbertos = titulos.filter(function(item) {
    return item.natureza === 'receber' && tfSaldo(item) > 0;
  }).sort(function(a, b) {
    return tfSaldo(b) - tfSaldo(a);
  }).slice(0, 5);
  var pagarAbertos = titulos.filter(function(item) {
    return item.natureza === 'pagar' && tfSaldo(item) > 0;
  }).sort(function(a, b) {
    return tfSaldo(b) - tfSaldo(a);
  }).slice(0, 5);

  return {
    mesAtual: mesAtual,
    recebidoMes: recebidoMes,
    pagoMes: pagoMes,
    liquidoMes: recebidoMes - pagoMes,
    taxaConciliacaoMes: taxaConciliacaoMes,
    extratoElegiveisMes: elegiveisMes.length,
    extratoConciliadosMes: conciliadosMes.length,
    devolucoesPendentesCount: devolucoesPendentes.length,
    devolucoesPendentesValor: devolucoesPendentesValor,
    estornosConcluidosCount: estornosConcluidos.length,
    estornosConcluidosValor: estornosConcluidosValor,
    inadimplenciaTitulos: vencidosReceber.length,
    inadimplenciaValor: inadimplenciaValor,
    previsaoLiquida: resumo.receber - resumo.pagar,
    topReceber: receberAbertos,
    topPagar: pagarAbertos
  };
}

function tfResumoExecutivoListaHtml(items, natureza) {
  if (!items.length) {
    return '<div class="pending-meta">Nenhum título aberto relevante.</div>';
  }
  return '<div class="financeiro-exec-list">'
    + items.map(function(item) {
      return '<div class="financeiro-exec-item">'
        + '<strong>' + esc(item.pessoaNome || '-') + '</strong>'
        + '<span>' + esc(item.descricao || '-') + '</span>'
        + '<span class="' + (natureza === 'receber' ? 'green' : 'red') + '">' + fmt(tfSaldo(item)) + '</span>'
      + '</div>';
    }).join('')
    + '</div>';
}

function tfPendenciasResumo() {
  var cliente = tfClienteAtivo();
  var pendencias = {
    extratoNaoConciliados: { count: 0, valor: 0 },
    extratoPendentesEstorno: { count: 0, valor: 0 },
    extratoRateados: { count: 0, valor: 0 },
    receberVencido: { count: 0, valor: 0 },
    pagarVencido: { count: 0, valor: 0 },
    receberParcial: { count: 0, valor: 0 },
    pagarParcial: { count: 0, valor: 0 }
  };

  if (!cliente) return pendencias;

  (cliente.extrato || []).forEach(function(lanc) {
    var valorAbs = Math.abs(Number(lanc && lanc.valor || 0));
    if (typeof extratoPendenteConciliacao === 'function' && extratoPendenteConciliacao(cliente, lanc)) {
      pendencias.extratoNaoConciliados.count += 1;
      pendencias.extratoNaoConciliados.valor += valorAbs;
    }
    if (typeof extratoStatusEstornoValor === 'function' && extratoStatusEstornoValor(lanc) === 'pendente_estorno') {
      pendencias.extratoPendentesEstorno.count += 1;
      pendencias.extratoPendentesEstorno.valor += valorAbs;
    }
    if (typeof extratoTemRateio === 'function' && extratoTemRateio(lanc)) {
      pendencias.extratoRateados.count += 1;
      pendencias.extratoRateados.valor += valorAbs;
    }
  });

  tfTitulosCliente().forEach(function(item) {
    var status = tfStatusOf(item);
    var saldo = tfSaldo(item);
    if (item.natureza === 'receber' && status === 'atrasado') {
      pendencias.receberVencido.count += 1;
      pendencias.receberVencido.valor += saldo;
    }
    if (item.natureza === 'pagar' && status === 'atrasado') {
      pendencias.pagarVencido.count += 1;
      pendencias.pagarVencido.valor += saldo;
    }
    if (item.natureza === 'receber' && status === 'parcial') {
      pendencias.receberParcial.count += 1;
      pendencias.receberParcial.valor += saldo;
    }
    if (item.natureza === 'pagar' && status === 'parcial') {
      pendencias.pagarParcial.count += 1;
      pendencias.pagarParcial.valor += saldo;
    }
  });

  return pendencias;
}

function tfResetPendenciaExtratoFiltros() {
  _exFiltroTipo = 'todos';
  _exFiltroCat = '';
  _exFiltroPeriodoModo = 'mes';
  _exFiltroPeriodoValor = '';
  _exFiltroConta = '';
  _exFiltroRelacionamento = '';
  _exFiltroConciliacao = 'todos';
  _exFiltroEstorno = 'todos';
  _exFiltroValorModo = 'todos';
  _exFiltroValor = 0;
  _exFiltroBusca = '';
}

function tfAbrirPendenciaExtrato(tipo) {
  tfResetPendenciaExtratoFiltros();
  if (tipo === 'não_conciliados') _exFiltroConciliacao = 'não_conciliados';
  if (tipo === 'pendentes_estorno') _exFiltroEstorno = 'pendentes_estorno';
  switchTab('extrato');
}

function tfAbrirPendenciaFinanceiro(natureza, status) {
  _tfNatureza = natureza === 'pagar' ? 'pagar' : 'receber';
  _tfStatus = status || 'todos';
  _tfDescricao = '';
  _tfBusca = '';
  switchTab('financeiro');
}

function tfSetNatureza(natureza) {
  _tfNatureza = natureza === 'pagar' ? 'pagar' : 'receber';
  renderFinanceiro();
}

function tfApplyFilters() {
  var statusEl = document.getElementById('tf-filtro-status');
  var descricaoEl = document.getElementById('tf-filtro-descricao');
  var buscaEl = document.getElementById('tf-filtro-busca');
  _tfStatus = statusEl ? statusEl.value : 'todos';
  _tfDescricao = descricaoEl ? descricaoEl.value.trim() : '';
  _tfBusca = buscaEl ? buscaEl.value.trim() : '';
  renderFinanceiro();
}

function tfClearFilters() {
  _tfStatus = 'todos';
  _tfDescricao = '';
  _tfBusca = '';
  renderFinanceiro();
}

function tfTituloAtivoLabel() {
  return _tfNatureza === 'pagar' ? 'Contas a pagar' : 'Contas a receber';
}

function tfExportRows() {
  return tfFilteredItems().map(function(item) {
    return {
      Vencimento: formatDate(item.vencimento),
      Pessoa: item.pessoaNome || '',
      Descricao: item.descricao || '',
      Status: tfStatusLabel(tfStatusOf(item)),
      Total: Number(item.valorTotal || 0),
      Baixado: tfTotalBaixado(item),
      Saldo: tfSaldo(item),
      Recorrencia: tfDescribeRecorrencia(item),
      Observacao: item.observacao || ''
    };
  });
}

function tfExportXlsx() {
  if (!activeClient || !tfClienteAtivo()) return alert('Selecione um cliente.');
  var rows = tfExportRows();
  if (!rows.length) return alert('Não há dados para exportar com os filtros atuais.');
  var cliente = tfClienteAtivo();
  var resumo = [
    ['Cliente', cliente.name || ''],
    ['Tela', tfTituloAtivoLabel()],
    ['Status', _tfStatus || 'todos'],
    ['Descricao', _tfDescricao || ''],
    ['Busca', _tfBusca || ''],
    ['Gerado em', new Date().toLocaleString('pt-BR')]
  ];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Resumo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows, {
    header: ['Vencimento', 'Pessoa', 'Descricao', 'Status', 'Total', 'Baixado', 'Saldo', 'Recorrencia', 'Observacao']
  }), _tfNatureza === 'pagar' ? 'A Pagar' : 'A Receber');
  XLSX.writeFile(
    wb,
    'granafy_financeiro_' + (_tfNatureza === 'pagar' ? 'pagar' : 'receber') + '_'
      + String(cliente.name || 'cliente').toLowerCase().replace(/\s+/g, '_')
      + '_' + new Date().toISOString().slice(0, 10) + '.xlsx'
  );
}

function tfExportPDF() {
  var jsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDF) return alert('Biblioteca PDF não carregada.');
  if (!activeClient || !tfClienteAtivo()) return alert('Selecione um cliente.');
  var rows = tfExportRows();
  if (!rows.length) return alert('Nao ha dados para exportar com os filtros atuais.');
  var cliente = tfClienteAtivo();
  var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  var hoje = new Date().toLocaleString('pt-BR');
  doc.setFillColor(30, 35, 54);
  doc.rect(0, 0, 297, 24, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('Granafy', 14, 11);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(tfTituloAtivoLabel() + ' - ' + (cliente.name || ''), 14, 19);
  doc.text('Gerado em ' + hoje, 283, 19, { align: 'right' });
  doc.setFontSize(9);
  doc.setTextColor(90, 96, 122);
  doc.text('Status: ' + (_tfStatus || 'todos') + ' | Descriçãoo: ' + (_tfDescricao || '-') + ' | Busca: ' + (_tfBusca || '-'), 14, 31);
  doc.autoTable({
    startY: 36,
    head: [['Vencimento', 'Pessoa', 'Descriçãoo', 'Status', 'Total', 'Baixado', 'Saldo', 'Recorrência', 'Observaçãoo']],
    body: rows.map(function(row) {
      return [
        row.Vencimento, row.Pessoa, row.Descricao, row.Status,
        fmt(row.Total), fmt(row.Baixado), fmt(row.Saldo), row.Recorrencia, row.Observacao
      ];
    }),
    styles: { fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [91, 140, 255], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 250] },
    columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    margin: { left: 14, right: 14 }
  });
  doc.save(
    'granafy_financeiro_' + (_tfNatureza === 'pagar' ? 'pagar' : 'receber') + '_'
    + String(cliente.name || 'cliente').toLowerCase().replace(/\s+/g, '_')
    + '_' + new Date().toISOString().slice(0, 10) + '.pdf'
  );
}

function toggleFinanceiroPanel(key) {
  _tfPanels[key] = !_tfPanels[key];
  renderFinanceiro();
}

function financeiroPanel(key, title, body) {
  var open = !!_tfPanels[key];
  return '<div class="form-card collapsible-card financeiro-collapsible-card' + (open ? ' open' : '') + '">'
    + '<button type="button" class="collapse-head" onclick="toggleFinanceiroPanel(\'' + key + '\')" aria-expanded="' + open + '">'
    + '<span>' + title + '</span>'
    + '<span class="collapse-chevron" aria-hidden="true">&#9662;</span>'
    + '</button>'
    + (open ? '<div class="collapse-body">' + body + '</div>' : '')
    + '</div>';
}

function tfFormPrefix() {
  return _tfNatureza === 'pagar' ? 'tf-pagar' : 'tf-receber';
}

function tfCentrosCustoCliente() {
  var cliente = tfClienteAtivo();
  return cliente && Array.isArray(cliente.centrosCustoMeta) ? cliente.centrosCustoMeta : [];
}

function tfNomeCentroCustoById(centroCustoId) {
  if (!centroCustoId) return '';
  var centro = tfCentrosCustoCliente().find(function(item) { return item.id === centroCustoId; });
  return centro ? String(centro.nome || '') : '';
}

function tfCentrosCustoOptionsHtml(selectedId) {
  var atual = String(selectedId || '').trim();
  var centros = tfCentrosCustoCliente().slice().sort(function(a, b) {
    return String(a && a.nome || '').localeCompare(String(b && b.nome || ''), 'pt-BR', { sensitivity: 'base' });
  });
  if (!centros.length) return '<option value="">Sem centro</option>';
  return '<option value="">Sem centro</option>' + centros.map(function(item) {
    return '<option value="' + esc(item.id) + '"' + (String(item.id) === atual ? ' selected' : '') + '>' + esc(item.nome || '') + '</option>';
  }).join('');
}

function tfFechamentosCliente() {
  var cliente = tfClienteAtivo();
  return cliente && Array.isArray(cliente.fechamentos) ? cliente.fechamentos : [];
}

function tfAuditoriaCliente() {
  var cliente = tfClienteAtivo();
  return cliente && Array.isArray(cliente.auditoriaFinanceira) ? cliente.auditoriaFinanceira : [];
}

function tfSerieBaseId(item) {
  if (!item) return null;
  return item.origemRecorrenciaId || item.id || null;
}

function tfTitulosDaSerie(item) {
  var baseId = tfSerieBaseId(item);
  if (!baseId) return item ? [item] : [];
  return tfTitulosCliente()
    .filter(function(entry) {
      return tfSerieBaseId(entry) === baseId;
    })
    .sort(function(a, b) {
      var da = String(a.vencimento || '9999-99-99');
      var db = String(b.vencimento || '9999-99-99');
      if (da !== db) return da.localeCompare(db);
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
}

function tfTitulosFuturosDaSerie(item) {
  var serie = tfTitulosDaSerie(item);
  var idx = serie.findIndex(function(entry) { return entry.id === item.id; });
  return idx >= 0 ? serie.slice(idx) : serie;
}

function tfFechamentoPorReferencia(referencia) {
  return tfFechamentosCliente().find(function(item) {
    return item && item.referencia === referencia && item.status === 'fechado';
  }) || null;
}

function tfFechamentoAtual() {
  return tfFechamentoPorReferencia(tfCurrentMonthKey());
}

function tfPeriodoEstaFechado(referencia) {
  return !!tfFechamentoPorReferencia(referencia);
}

function tfDataSomarRecorrencia(dataIso, frequencia, passos, intervalo) {
  if (!dataIso) return null;
  var data = new Date(String(dataIso).slice(0, 10) + 'T00:00:00');
  if (isNaN(data.getTime())) return dataIso;
  var step = Math.max(1, Number(intervalo || 1)) * Math.max(1, Number(passos || 1));
  if (frequencia === 'semanal') data.setDate(data.getDate() + (step * 7));
  else data.setMonth(data.getMonth() + step);
  return data.toISOString().slice(0, 10);
}

function tfDescribeRecorrencia(item) {
  if (!item || !item.recorrenciaAtiva || !item.recorrenciaFrequencia) return '';
  var cada = Math.max(1, Number(item.recorrenciaIntervalo || 1));
  var base = item.recorrenciaFrequencia === 'semanal'
    ? (cada === 1 ? 'Recorrência semanal' : ('Recorrência a cada ' + cada + ' semanas'))
    : (cada === 1 ? 'Recorrência mensal' : ('Recorrência a cada ' + cada + ' meses'));
  if (item.recorrenciaFim) base += ' até ' + formatDate(item.recorrenciaFim);
  return base;
}

function tfReadRecorrenciaForm(prefix) {
  var ativa = !!((document.getElementById(prefix + '-recorrente') || {}).checked);
  if (!ativa) {
    return {
      ativa: false,
      frequencia: null,
      intervalo: 1,
      quantidade: 1,
      fim: null
    };
  }

  var frequencia = ((document.getElementById(prefix + '-recorrencia-freq') || {}).value || 'mensal').trim() || 'mensal';
  var intervalo = Math.max(1, Number(((document.getElementById(prefix + '-recorrencia-intervalo') || {}).value) || 1));
  var quantidade = Math.max(1, Number(((document.getElementById(prefix + '-recorrencia-quantidade') || {}).value) || 1));
  var fim = tfNormalizeDateFieldValue(prefix + '-recorrencia-fim', 'fim da recorrência');
  if (fim === null) return null;

  return {
    ativa: true,
    frequencia: frequencia === 'semanal' ? 'semanal' : 'mensal',
    intervalo: intervalo,
    quantidade: quantidade,
    fim: fim || null
  };
}

function tfToggleRecorrencia(prefix) {
  var checked = !!((document.getElementById(prefix + '-recorrente') || {}).checked);
  var targets = document.querySelectorAll('[data-tf-recorrencia="' + prefix + '"]');
  targets.forEach(function(el) {
    el.style.display = checked ? '' : 'none';
  });
}

function tfAuditoriaEventoLabel(evento) {
  var labels = {
    titulo_criado: 'Título criado',
    titulo_atualizado: 'Título atualizado',
    titulo_duplicado: 'Título duplicado',
    titulo_excluido: 'Título excluído',
    recebimento_manual: 'Recebimento manual',
    pagamento_manual: 'Pagamento manual',
    baixa_excluida: 'Baixa excluída',
    periodo_fechado: 'Período fechado',
    periodo_reaberto: 'Período reaberto'
  };
  return labels[evento] || 'Evento financeiro';
}

function tfAuditoriaRecenteHtml() {
  var itens = tfAuditoriaCliente().slice(0, 8);
  if (!itens.length) {
    return '<div class="pending-meta">Nenhum evento financeiro registrado ainda.</div>';
  }
  return '<div class="financeiro-exec-list">'
    + itens.map(function(item) {
      var detalhes = [];
      if (item && item.createdAt) detalhes.push(formatDateTime(item.createdAt));
      if (item && item.resumo) detalhes.push(item.resumo);
      return '<div class="financeiro-exec-item">'
        + '<strong>' + esc(tfAuditoriaEventoLabel(item && item.evento)) + '</strong>'
        + '<span>' + esc((detalhes.join(' · ') || '-')) + '</span>'
      + '</div>';
    }).join('')
    + '</div>';
}

async function tfAlternarFechamentoAtual() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e está disponível apenas para visualizaçãoo.');
  if (!activeClient) return;
  var referencia = tfCurrentMonthKey();
  var fechamentoAtual = tfFechamentoPorReferencia(referencia);
  var cliente = tfClienteAtivo();
  if (!cliente) return;

  if (fechamentoAtual) {
    var reabrir = await appConfirm('Reabrir o período ' + tfMonthLabel(referencia) + '? Alteraçõeses voltarão a ser permitidas.', {
      title: 'Reabrir período',
      confirmText: 'Reabrir'
    });
    if (!reabrir) return;

    var del = await applyUserScope(
      supabaseClient
        .from('fechamentos_periodo')
        .delete()
        .eq('id', fechamentoAtual.id)
    );
    if (del.error) {
      console.error(del.error);
      alert('Não foi possível reabrir o período.');
      return;
    }
    cliente.fechamentos = (cliente.fechamentos || []).filter(function(item) { return item.id !== fechamentoAtual.id; });
    await tfRegistrarAuditoria('periodo_reaberto', 'fechamento_periodo', fechamentoAtual.id, 'Período reaberto', { referencia: referencia });
    renderFinanceiro();
    return;
  }

  var fechar = await appConfirm('Fechar o período ' + tfMonthLabel(referencia) + '? O sistema passará a alertar alteraçõeses em títulos desse mês.', {
    title: 'Fechar período',
    confirmText: 'Fechar período'
  });
  if (!fechar) return;

  var insert = await supabaseClient
    .from('fechamentos_periodo')
    .insert([Object.assign({
      cliente_id: activeClient,
      referencia: referencia,
      status: 'fechado',
      observacao: 'Fechamento operacional do financeiro'
    }, getUserScopePayload())])
    .select()
    .single();

  if (insert.error) {
    console.error(insert.error);
    alert('Não foi possível fechar o período. Verifique se a migraçãoo 20260607_financeiro_recorrencia_auditoria_fechamento.sql foi aplicada no Supabase.');
    return;
  }

  if (!Array.isArray(cliente.fechamentos)) cliente.fechamentos = [];
  cliente.fechamentos.unshift({
    id: insert.data.id,
    referencia: insert.data.referencia,
    status: insert.data.status || 'fechado',
    observacao: insert.data.observacao || '',
    createdAt: insert.data.created_at || null,
    updatedAt: insert.data.updated_at || null
  });
  await tfRegistrarAuditoria('periodo_fechado', 'fechamento_periodo', insert.data.id, 'Período fechado', { referencia: referencia });
  renderFinanceiro();
}

async function tfRegistrarAuditoria(evento, entidade, entidadeId, resumo, detalhes, modulo) {
  if (!activeClient || !currentUserId()) return;
  try {
    var payload = {
      cliente_id: activeClient,
      user_id: currentUserId(),
      modulo: modulo || 'financeiro',
      evento: evento,
      entidade: entidade,
      entidade_id: entidadeId || null,
      resumo: resumo,
      detalhes: detalhes || {}
    };
    var response = await supabaseClient
      .from('auditoria_financeira')
      .insert([payload])
      .select()
      .single();

    if (response.error) {
      var msg = String((response.error.message || '') + ' ' + (response.error.details || '')).toLowerCase();
      if (response.error.code === '42P01' || response.error.code === 'PGRST205' || msg.includes('auditoria_financeira')) {
        return;
      }
      console.warn('Não foi possível registrar auditoria financeira:', response.error);
      return;
    }

    var cliente = tfClienteAtivo();
    if (cliente) {
      if (!Array.isArray(cliente.auditoriaFinanceira)) cliente.auditoriaFinanceira = [];
      cliente.auditoriaFinanceira.unshift({
        id: response.data.id,
        modulo: response.data.modulo || 'financeiro',
        evento: response.data.evento || '',
        entidade: response.data.entidade || '',
        entidadeId: response.data.entidade_id || null,
        resumo: response.data.resumo || '',
        detalhes: response.data.detalhes || {},
        createdAt: response.data.created_at || null,
        userId: response.data.user_id || null
      });
      if (cliente.auditoriaFinanceira.length > 100) cliente.auditoriaFinanceira.length = 100;
    }
  } catch (error) {
    console.warn('Falha inesperada ao registrar auditoria financeira:', error);
  }
}

function tfNormalizeDateFieldValue(fieldId, label) {
  var el = document.getElementById(fieldId);
  if (!el) return '';
  var raw = String(el.value || '').trim();
  if (!raw) return '';
  var normalized = readFlexibleDateInput(el);
  if (!normalized) {
    alert('Informe uma data valida para ' + label + '. Use dd/mm ou dd/mm/aaaa.');
    el.focus();
    return null;
  }
  el.value = formatDate(normalized);
  return normalized;
}

function tfReadFormPayload(prefix) {
  var pessoa = (document.getElementById(prefix + '-pessoa') || {}).value || '';
  var descricao = (document.getElementById(prefix + '-descricao') || {}).value || '';
  var centroCustoId = ((document.getElementById(prefix + '-centro-custo') || {}).value || '').trim() || null;
  var vencimento = tfNormalizeDateFieldValue(prefix + '-vencimento', 'vencimento');
  var valor = tfParseAmountFromInput(prefix + '-valor');
  var observacao = (document.getElementById(prefix + '-observacao') || {}).value || '';
  var recorrencia = tfReadRecorrenciaForm(prefix);

  if (vencimento === null) return null;
  if (recorrencia === null) return null;

  return {
    natureza: prefix === 'tf-pagar' ? 'pagar' : 'receber',
    pessoaNome: formatDescriptionTitleCase(pessoa),
    descricao: formatDescriptionTitleCase(descricao),
    categoria: null,
    centroCustoId: centroCustoId,
    vencimento: vencimento || null,
    valorTotal: Number(valor || 0),
    observacao: observacao.trim(),
    recorrencia: recorrencia
  };
}

function tfResetForm(prefix) {
  ['pessoa', 'descricao', 'centro-custo', 'vencimento', 'observacao', 'recorrencia-fim'].forEach(function(suffix) {
    var el = document.getElementById(prefix + '-' + suffix);
    if (el) el.value = '';
    if (el && suffix === 'vencimento') delete el.dataset.isoDate;
    if (el && suffix === 'recorrencia-fim') delete el.dataset.isoDate;
  });
  var valorEl = document.getElementById(prefix + '-valor');
  if (valorEl) {
    valorEl.value = '0,00';
    valorEl.dataset.cents = '0';
  }
  var recorrenteEl = document.getElementById(prefix + '-recorrente');
  if (recorrenteEl) recorrenteEl.checked = false;
  var freqEl = document.getElementById(prefix + '-recorrencia-freq');
  if (freqEl) freqEl.value = 'mensal';
  var intEl = document.getElementById(prefix + '-recorrencia-intervalo');
  if (intEl) intEl.value = '1';
  var qtdEl = document.getElementById(prefix + '-recorrencia-quantidade');
  if (qtdEl) qtdEl.value = '1';
  tfToggleRecorrencia(prefix);
}

async function tfAddTitulo() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e está disponível apenas para visualização.');
  var payload = tfReadFormPayload(tfFormPrefix());
  if (!payload) return;
  if (!payload.pessoaNome || !payload.descricao || payload.valorTotal <= 0) {
    alert('Preencha pessoa, descriçãoo e valor do título.');
    return;
  }

  if (payload.vencimento && tfPeriodoEstaFechado(tfReferenciaMes(payload.vencimento))) {
    var seguir = await appConfirm('O período ' + tfMonthLabel(tfReferenciaMes(payload.vencimento)) + ' está fechado. Deseja cadastrar este título mesmo assim?', { title: 'Período fechado', confirmText: 'Cadastrar mesmo assim' });
    if (!seguir) return;
  }

  var recorrencia = payload.recorrencia || { ativa: false, frequencia: null, intervalo: 1, quantidade: 1, fim: null };
  var quantidade = recorrencia.ativa ? Math.max(1, Number(recorrencia.quantidade || 1)) : 1;
  var basePayload = {
    cliente_id: activeClient,
    natureza: payload.natureza,
    pessoa_nome: payload.pessoaNome,
    descricao: payload.descricao,
    categoria: payload.categoria || null,
    centro_custo_id: payload.centroCustoId || null,
    vencimento: payload.vencimento,
    valor_total: payload.valorTotal,
    observacao: payload.observacao || null,
    recorrencia_ativa: !!recorrencia.ativa,
    recorrencia_frequencia: recorrencia.ativa ? recorrencia.frequencia : null,
    recorrencia_intervalo: recorrencia.ativa ? recorrencia.intervalo : 1,
    recorrencia_fim: recorrencia.ativa ? recorrencia.fim : null
  };
  var createdRows = [];
  var origemRecorrenciaId = null;

  for (var idx = 0; idx < quantidade; idx++) {
    var vencimentoSerie = idx === 0
      ? basePayload.vencimento
      : tfDataSomarRecorrencia(basePayload.vencimento, recorrencia.frequencia, idx, recorrencia.intervalo);

    if (recorrencia.ativa && recorrencia.fim && vencimentoSerie && vencimentoSerie > recorrencia.fim) break;

    var insertPayload = Object.assign({}, basePayload, getUserScopePayload(), {
      vencimento: vencimentoSerie,
      origem_recorrencia_id: origemRecorrenciaId
    });

    var response = await supabaseClient
      .from('titulos_financeiros')
      .insert([insertPayload])
      .select()
      .single();

    if (response.error) {
      console.error(response.error);
      alert('Não foi possível cadastrar o título. Verifique se a migraçãoo 20260607_financeiro_recorrencia_auditoria_fechamento.sql já foi aplicada no Supabase.');
      return;
    }

    if (!origemRecorrenciaId) origemRecorrenciaId = response.data.id;
    createdRows.push(response.data);
  }

  var cliente = tfClienteAtivo();
  if (!Array.isArray(cliente.titulos)) cliente.titulos = [];
  createdRows.forEach(function(row) {
    cliente.titulos.push({
      id: row.id,
      natureza: row.natureza,
      pessoaNome: row.pessoa_nome || '',
      descricao: row.descricao || '',
      centroCustoId: row.centro_custo_id || null,
      centroCusto: tfNomeCentroCustoById(row.centro_custo_id || null),
      vencimento: row.vencimento || null,
      valorTotal: Number(row.valor_total || 0),
      observacao: row.observacao || '',
      recorrenciaAtiva: !!row.recorrencia_ativa,
      recorrenciaFrequencia: row.recorrencia_frequencia || null,
      recorrenciaIntervalo: Number(row.recorrencia_intervalo || 1),
      recorrenciaFim: row.recorrencia_fim || null,
      origemRecorrenciaId: row.origem_recorrencia_id || null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
      baixas: [],
      userId: row.user_id || null
    });
  });

  await tfRegistrarAuditoria(
    'titulo_criado',
    'titulo_financeiro',
    origemRecorrenciaId || (createdRows[0] && createdRows[0].id),
    (payload.natureza === 'receber' ? 'Título a receber criado' : 'Título a pagar criado') + (createdRows.length > 1 ? (' em série (' + createdRows.length + ')') : ''),
    {
      natureza: payload.natureza,
      pessoa: payload.pessoaNome,
      descricao: payload.descricao,
      valor: payload.valorTotal,
      vencimento: payload.vencimento,
      recorrencia: recorrencia
    }
  );

  tfResetForm(tfFormPrefix());
  renderFinanceiro();
}

function tfFindTituloById(id) {
  return tfTitulosCliente().find(function(item) { return item.id === id; }) || null;
}

function tfUpdateLocalTitulo(row) {
  var cliente = tfClienteAtivo();
  if (!cliente || !Array.isArray(cliente.titulos)) return;
  var idx = cliente.titulos.findIndex(function(item) { return item.id === row.id; });
  if (idx < 0) return;
  cliente.titulos[idx] = Object.assign({}, cliente.titulos[idx], {
    pessoaNome: row.pessoa_nome || '',
    descricao: row.descricao || '',
    centroCustoId: row.centro_custo_id || null,
    centroCusto: tfNomeCentroCustoById(row.centro_custo_id || null),
    vencimento: row.vencimento || null,
    valorTotal: Number(row.valor_total || 0),
    observacao: row.observacao || '',
    recorrenciaAtiva: !!row.recorrencia_ativa,
    recorrenciaFrequencia: row.recorrencia_frequencia || null,
    recorrenciaIntervalo: Number(row.recorrencia_intervalo || 1),
    recorrenciaFim: row.recorrencia_fim || null,
    origemRecorrenciaId: row.origem_recorrencia_id || null,
    updatedAt: row.updated_at || null
  });
}

function tfOpenTituloModal(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var naturezaLabel = item.natureza === 'receber' ? 'Conta a receber' : 'Conta a pagar';
  var baixarLabel = item.natureza === 'receber' ? 'Registrar recebimento' : 'Registrar pagamento';
  var recorrenciaLabel = tfDescribeRecorrencia(item);
  var baixasHtml = (item.baixas || []).length
    ? item.baixas.slice().sort(function(a, b) {
        return String(b.data || '').localeCompare(String(a.data || ''));
      }).map(function(baixa) {
        return '<div class="tf-baixa-item">'
          + '<div><strong>' + esc(formatDate(baixa.data)) + '</strong><small>' + esc(baixa.origem === 'extrato' ? 'Conciliado com extrato' : 'Baixa manual') + (baixa.observacao ? ' · ' + esc(baixa.observacao) : '') + '</small></div>'
          + '<div style="display:flex;align-items:center;gap:10px"><strong style="color:var(--accent3)">' + fmt(baixa.valor) + '</strong><button class="btn-icon danger" onclick="tfDeleteBaixa(\'' + id + '\',\'' + baixa.id + '\')" title="Excluir baixa">&#128465;</button></div>'
          + '</div>';
      }).join('')
    : '<div class="empty-state" style="padding:22px 12px">Nenhuma baixa registrada ainda.</div>';

  document.getElementById('modalTitle').textContent = naturezaLabel;
  document.getElementById('modalBody').innerHTML =
    '<div class="settings-card-badges" style="margin:0 0 18px 0">'
      + '<span class="settings-card-badge">' + esc(item.natureza === 'receber' ? 'Receber' : 'Pagar') + '</span>'
      + '<span class="settings-card-badge subtle">Total ' + fmt(item.valorTotal) + '</span>'
      + '<span class="settings-card-badge subtle">Baixado ' + fmt(tfTotalBaixado(item)) + '</span>'
      + '<span class="settings-card-badge subtle">Saldo ' + fmt(tfSaldo(item)) + '</span>'
      + (recorrenciaLabel ? '<span class="settings-card-badge subtle">' + esc(recorrenciaLabel) + '</span>' : '')
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group"><label>' + (item.natureza === 'receber' ? 'Cliente pagador' : 'Favorecido / fornecedor') + '</label><input type="text" id="tf-edit-pessoa" value="' + esc(item.pessoaNome || '') + '"/></div>'
      + '<div class="form-group"><label>Descriçãoo</label><input type="text" id="tf-edit-descricao" value="' + esc(item.descricao || '') + '"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group" style="max-width:170px"><label>Vencimento</label><input type="text" id="tf-edit-vencimento" class="flex-date-input" value="' + esc(item.vencimento ? formatDate(item.vencimento) : '') + '" placeholder="dd/mm ou dd/mm/aaaa"/></div>'
      + '<div class="form-group" style="max-width:170px"><label>Valor total</label><input type="text" id="tf-edit-valor" class="money-input" value="' + esc((Number(item.valorTotal || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group"><label>Observaçãoo</label><textarea id="tf-edit-observacao" rows="3" placeholder="Informaçõeses importantes deste título">' + esc(item.observacao || '') + '</textarea></div>'
    + '</div>'
    + '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin:4px 0 18px">'
      + '<button class="btn-sm" type="button" onclick="tfDuplicarTitulo(\'' + id + '\')">Duplicar título</button>'
      + '<button class="btn-sm red" type="button" onclick="closeModal()">Fechar</button>'
      + '<button class="btn-add" type="button" style="margin-top:0" onclick="tfSaveTitulo(\'' + id + '\')">Salvar título</button>'
    + '</div>'
    + '<div class="settings-section-card">'
      + '<div class="settings-card-head"><div><h5>Baixas registradas</h5><p>Registre recebimentos ou pagamentos parciais para acompanhar o saldo deste título.</p></div></div>'
      + baixasHtml
      + '<div class="form-row" style="margin-top:16px">'
        + '<div class="form-group" style="max-width:170px"><label>Data da baixa</label><input type="text" id="tf-baixa-data" class="flex-date-input" value="' + esc(formatDate(new Date().toISOString().slice(0, 10))) + '" placeholder="dd/mm ou dd/mm/aaaa"/></div>'
        + '<div class="form-group" style="max-width:170px"><label>Valor</label><input type="text" id="tf-baixa-valor" class="money-input" value="' + esc(Math.max(tfSaldo(item), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '"/></div>'
        + '<div class="form-group"><label>Observaçãoo</label><input type="text" id="tf-baixa-observacao" placeholder="Ex.: Pix, TED, boleto"/></div>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end"><button class="btn-add" type="button" style="margin-top:6px" onclick="tfRegistrarBaixa(\'' + id + '\')">' + baixarLabel + '</button></div>'
    + '</div>';

  document.getElementById('modalOverlay').classList.add('open');
  document.addEventListener('keydown', handleMainModalEscape);
  initMoneyInputs(document.getElementById('modalBody'));
  initFlexibleDateInputs(document.getElementById('modalBody'));
}

async function tfSaveTitulo(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var payload = {
    pessoa_nome: formatDescriptionTitleCase((document.getElementById('tf-edit-pessoa') || {}).value || ''),
    descricao: formatDescriptionTitleCase((document.getElementById('tf-edit-descricao') || {}).value || ''),
    categoria: null,
    centro_custo_id: ((document.getElementById('tf-edit-centro-custo') || {}).value || '').trim() || null,
    vencimento: tfNormalizeDateFieldValue('tf-edit-vencimento', 'vencimento'),
    valor_total: tfParseAmountFromInput('tf-edit-valor'),
    observacao: ((document.getElementById('tf-edit-observacao') || {}).value || '').trim() || null
  };

  if (payload.vencimento === null) return;

  if (!payload.pessoa_nome || !payload.descricao || payload.valor_total <= 0) {
    alert('Preencha pessoa, descriçãoo e valor do título.');
    return;
  }

  if (payload.vencimento && tfPeriodoEstaFechado(tfReferenciaMes(payload.vencimento))) {
    var seguir = await appConfirm('O período ' + tfMonthLabel(tfReferenciaMes(payload.vencimento)) + ' está fechado. Deseja salvar mesmo assim?', { title: 'Período fechado', confirmText: 'Salvar mesmo assim' });
    if (!seguir) return;
  }

  var response = await applyUserScope(
    supabaseClient
      .from('titulos_financeiros')
      .update(payload)
      .eq('id', id)
  ).select().single();

  if (response.error) {
    console.error(response.error);
    alert('Não foi possível salvar o título.');
    return;
  }

  tfUpdateLocalTitulo(response.data);
  await tfRegistrarAuditoria(
    'titulo_atualizado',
    'titulo_financeiro',
    id,
    'Título financeiro atualizado',
    {
      natureza: item.natureza,
      pessoa: payload.pessoa_nome,
      descricao: payload.descricao,
      valor: payload.valor_total,
      vencimento: payload.vencimento
    }
  );
  closeModal();
  renderFinanceiro();
}

async function tfDuplicarTitulo(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var frequencia = item.recorrenciaFrequencia || 'mensal';
  var intervalo = Math.max(1, Number(item.recorrenciaIntervalo || 1));
  var novoVencimento = tfDataSomarRecorrencia(item.vencimento, frequencia, 1, intervalo);
  var ok = await appConfirm('Duplicar este título com vencimento em ' + formatDate(novoVencimento) + '?', { title: 'Duplicar título', confirmText: 'Duplicar' });
  if (!ok) return;

  var payload = Object.assign({
    cliente_id: activeClient,
    natureza: item.natureza,
    pessoa_nome: item.pessoaNome || '',
    descricao: item.descricao || '',
    categoria: null,
    centro_custo_id: item.centroCustoId || null,
    vencimento: novoVencimento,
    valor_total: Number(item.valorTotal || 0),
    observacao: item.observacao || null,
    recorrencia_ativa: !!item.recorrenciaAtiva,
    recorrencia_frequencia: item.recorrenciaFrequencia || null,
    recorrencia_intervalo: Number(item.recorrenciaIntervalo || 1),
    recorrencia_fim: item.recorrenciaFim || null,
    origem_recorrencia_id: item.origemRecorrenciaId || item.id
  }, getUserScopePayload());

  var response = await supabaseClient.from('titulos_financeiros').insert([payload]).select().single();
  if (response.error) {
    console.error(response.error);
    alert('Não foi possível duplicar o título.');
    return;
  }

  var cliente = tfClienteAtivo();
  if (!Array.isArray(cliente.titulos)) cliente.titulos = [];
  cliente.titulos.push({
    id: response.data.id,
    natureza: response.data.natureza,
    pessoaNome: response.data.pessoa_nome || '',
    descricao: response.data.descricao || '',
    centroCustoId: response.data.centro_custo_id || null,
    centroCusto: tfNomeCentroCustoById(response.data.centro_custo_id || null),
    vencimento: response.data.vencimento || null,
    valorTotal: Number(response.data.valor_total || 0),
    observacao: response.data.observacao || '',
    recorrenciaAtiva: !!response.data.recorrencia_ativa,
    recorrenciaFrequencia: response.data.recorrencia_frequencia || null,
    recorrenciaIntervalo: Number(response.data.recorrencia_intervalo || 1),
    recorrenciaFim: response.data.recorrencia_fim || null,
    origemRecorrenciaId: response.data.origem_recorrencia_id || null,
    createdAt: response.data.created_at || null,
    updatedAt: response.data.updated_at || null,
    baixas: [],
    userId: response.data.user_id || null
  });

  await tfRegistrarAuditoria('titulo_duplicado', 'titulo_financeiro', response.data.id, 'Título duplicado para recorrência operacional', {
    origemTituloId: item.id,
    novoVencimento: novoVencimento,
    natureza: item.natureza,
    valor: item.valorTotal
  });
  closeModal();
  renderFinanceiro();
}

async function tfDeleteTitulo(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var ok = await appConfirm('Excluir este título financeiro? As baixas registradas também serão removidas.', { title: 'Excluir título', confirmText: 'Excluir' });
  if (!ok) return;

  var response = await applyUserScope(
    supabaseClient
      .from('titulos_financeiros')
      .delete()
      .eq('id', id)
  );

  if (response.error) {
    console.error(response.error);
    alert('Não foi possível excluir o título.');
    return;
  }

  var cliente = tfClienteAtivo();
  cliente.titulos = (cliente.titulos || []).filter(function(entry) { return entry.id !== id; });
  await tfRegistrarAuditoria('titulo_excluido', 'titulo_financeiro', id, 'Título financeiro excluído', {
    natureza: item.natureza,
    pessoa: item.pessoaNome,
    descricao: item.descricao,
    valor: item.valorTotal
  });
  closeModal();
  renderFinanceiro();
}

async function tfRegistrarBaixa(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var dataBaixa = tfNormalizeDateFieldValue('tf-baixa-data', 'data da baixa');
  var valor = tfParseAmountFromInput('tf-baixa-valor');
  var observacao = ((document.getElementById('tf-baixa-observacao') || {}).value || '').trim();

  if (dataBaixa === null) return;
  if (!dataBaixa) dataBaixa = new Date().toISOString().slice(0, 10);

  if (valor <= 0) {
    alert('Informe um valor de baixa maior que zero.');
    return;
  }

  var response = await supabaseClient
    .from('titulos_financeiros_baixas')
    .insert([Object.assign({
      titulo_id: id,
      cliente_id: activeClient,
      data_baixa: dataBaixa,
      valor: valor,
      observacao: observacao || null,
      origem: 'manual'
    }, getUserScopePayload())])
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    alert('Não foi possível registrar a baixa.');
    return;
  }

  if (!Array.isArray(item.baixas)) item.baixas = [];
  item.baixas.push({
    id: response.data.id,
    data: response.data.data_baixa || null,
    valor: Number(response.data.valor || 0),
    observacao: response.data.observacao || '',
    origem: response.data.origem || 'manual',
    lancamentoId: response.data.extrato_lancamento_id || null,
    userId: response.data.user_id || null
  });

  await tfRegistrarAuditoria(
    item.natureza === 'receber' ? 'recebimento_manual' : 'pagamento_manual',
    'titulo_baixa',
    response.data.id,
    (item.natureza === 'receber' ? 'Baixa manual de recebimento registrada' : 'Baixa manual de pagamento registrada'),
    {
      tituloId: id,
      valor: valor,
      data: dataBaixa,
      observacao: observacao || null
    }
  );
  tfOpenTituloModal(id);
  renderFinanceiro();
}

async function tfDeleteBaixa(tituloId, baixaId) {
  var ok = await appConfirm('Excluir esta baixa registrada?', { title: 'Excluir baixa', confirmText: 'Excluir' });
  if (!ok) return;

  var response = await applyUserScope(
    supabaseClient
      .from('titulos_financeiros_baixas')
      .delete()
      .eq('id', baixaId)
  );

  if (response.error) {
    console.error(response.error);
    alert('Não foi possível excluir a baixa.');
    return;
  }

  var item = tfFindTituloById(tituloId);
  if (item) item.baixas = (item.baixas || []).filter(function(baixa) { return baixa.id !== baixaId; });
  await tfRegistrarAuditoria('baixa_excluida', 'titulo_baixa', baixaId, 'Baixa financeira excluída', {
    tituloId: tituloId
  });
  tfOpenTituloModal(tituloId);
  renderFinanceiro();
}

function renderFinanceiro() {
  var root = document.getElementById('financeiro-content');
  if (!root) return;

  if (typeof restoreActiveClientFromState === 'function') restoreActiveClientFromState();

  if (!activeClient || !tfClienteAtivo()) {
    root.innerHTML = '<div class="empty-state"><div class="icon">ðŸ‘‡</div>Selecione um cliente.</div>';
    return;
  }

  if (!tfClienteEhPJ()) {
    root.innerHTML = '<div class="empty-state"><div class="icon">ðŸ¢</div>O módulo Financeiro está disponível apenas para clientes PJ.</div>';
    return;
  }

  var resumo = tfSummaryValues();
  var pendencias = tfPendenciasResumo();
  var executivo = tfResumoExecutivo();
  var tituloAtivo = tfTituloAtivoLabel();
  var pessoaLabel = _tfNatureza === 'pagar' ? 'Favorecido / fornecedor' : 'Cliente pagador';
  var btnLabel = _tfNatureza === 'pagar' ? 'Cadastrar conta a pagar' : 'Cadastrar conta a receber';
  var itens = tfFilteredItems();
  var areaHtml = buildTable('financeiro', COLS_TITULOS, itens, function(item) {
    return COLS_TITULOS.map(function(col) {
      if (col.key === '_del') {
        return '<td><div class="row-actions"><button class="btn-icon" onclick="tfOpenTituloModal(\'' + item.id + '\')" title="Abrir título">&#9998;</button><button class="btn-icon danger" onclick="tfDeleteTitulo(\'' + item.id + '\')" title="Excluir título">&#128465;</button></div></td>';
      }
      return '<td>' + col.render(item) + '</td>';
    }).join('');
  }, function(item) {
    return tfStatusOf(item) === 'atrasado' ? 'row-overdue' : '';
  });

  root.innerHTML =
    '<div class="summary-grid">'
      + (_tfNatureza === 'receber'
        ? '<div class="summary-card"><div class="s-label">A receber em aberto</div><div class="s-val green">' + fmt(resumo.receber) + '</div></div>'
          + '<div class="summary-card"><div class="s-label">Já recebido</div><div class="s-val green">' + fmt(resumo.recebido) + '</div></div>'
        : '<div class="summary-card"><div class="s-label">A pagar em aberto</div><div class="s-val red">' + fmt(resumo.pagar) + '</div></div>'
          + '<div class="summary-card"><div class="s-label">Já pago</div><div class="s-val red">' + fmt(resumo.pago) + '</div></div>')
      + '<div class="summary-card"><div class="s-label">Vencidos</div><div class="s-val yellow">' + resumo.vencidos + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Títulos</div><div class="s-val blue">' + resumo.total + '</div></div>'
    + '</div>'
    + '<div class="form-card">'
      + '<h3>Dashboard executivo</h3>'
      + '<p class="cartao-helper-text">Leitura rápida do caixa e da operaçãoo financeira em ' + esc(tfMonthLabel(executivo.mesAtual)) + '.</p>'
      + '<div class="summary-grid pending-grid">'
        + '<div class="summary-card pending-card"><div class="s-label">Recebido no mês</div><div class="s-val green">' + fmt(executivo.recebidoMes) + '</div><div class="pending-meta">' + esc(tfMonthLabel(executivo.mesAtual)) + '</div></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Pago no mês</div><div class="s-val red">' + fmt(executivo.pagoMes) + '</div><div class="pending-meta">' + esc(tfMonthLabel(executivo.mesAtual)) + '</div></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Líquido do mês</div><div class="s-val ' + (executivo.liquidoMes >= 0 ? 'green' : 'red') + '">' + fmt(executivo.liquidoMes) + '</div><div class="pending-meta">Recebido menos pago</div></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Conciliaçãoo do mês</div><div class="s-val blue">' + Number(executivo.taxaConciliacaoMes || 0).toFixed(0) + '%</div><div class="pending-meta">' + executivo.extratoConciliadosMes + ' de ' + executivo.extratoElegiveisMes + ' resolvidos</div></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Devoluçõeses pendentes</div><div class="s-val yellow">' + executivo.devolucoesPendentesCount + '</div><div class="pending-meta">' + fmt(executivo.devolucoesPendentesValor) + '</div></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Previsão líquida</div><div class="s-val ' + (executivo.previsaoLiquida >= 0 ? 'green' : 'red') + '">' + fmt(executivo.previsaoLiquida) + '</div><div class="pending-meta">A receber aberto menos a pagar aberto</div></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Inadimplência</div><div class="s-val red">' + executivo.inadimplenciaTitulos + '</div><div class="pending-meta">' + fmt(executivo.inadimplenciaValor) + '</div></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Já estornados</div><div class="s-val blue">' + executivo.estornosConcluidosCount + '</div><div class="pending-meta">' + fmt(executivo.estornosConcluidosValor) + '</div></div>'
      + '</div>'
      + '<div class="financeiro-exec-split">'
        + '<div class="settings-section-card"><div class="settings-card-head"><div><h5>Maiores valores a receber</h5><p>Títulos abertos com maior impacto no caixa.</p></div></div>' + tfResumoExecutivoListaHtml(executivo.topReceber, 'receber') + '</div>'
        + '<div class="settings-section-card"><div class="settings-card-head"><div><h5>Maiores valores a pagar</h5><p>Saídas abertas que merecem acompanhamento de perto.</p></div></div>' + tfResumoExecutivoListaHtml(executivo.topPagar, 'pagar') + '</div>'
      + '</div>'
      + '<div class="financeiro-exec-split">'
        + '<div class="settings-section-card"><div class="settings-card-head"><div><h5>Fechamento do período</h5><p>' + (tfFechamentoAtual() ? ('Período ' + esc(tfMonthLabel(tfCurrentMonthKey())) + ' fechado para revisão.') : ('Período ' + esc(tfMonthLabel(tfCurrentMonthKey())) + ' ainda aberto para ediçãoo.')) + '</p></div><button class="btn-sm" type="button" onclick="tfAlternarFechamentoAtual()">' + (tfFechamentoAtual() ? 'Reabrir período' : 'Fechar período') + '</button></div></div>'
        + '<div class="settings-section-card"><div class="settings-card-head"><div><h5>Auditoria recente</h5><p>Últimos eventos da operaçãoo financeira deste cliente.</p></div></div>' + tfAuditoriaRecenteHtml() + '</div>'
      + '</div>'
    + '</div>'
    + '<div class="form-card">'
      + '<h3>Painel de pendências</h3>'
      + '<p class="cartao-helper-text">Atalhos para o que ainda precisa de atençãoo no Extrato e no Financeiro.</p>'
      + '<div class="summary-grid pending-grid">'
        + '<div class="summary-card pending-card"><div class="s-label">Não conciliados</div><div class="s-val yellow">' + pendencias.extratoNaoConciliados.count + '</div><div class="pending-meta">' + fmt(pendencias.extratoNaoConciliados.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaExtrato(\'não_conciliados\')">Abrir no Extrato</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Pendentes de estorno</div><div class="s-val red">' + pendencias.extratoPendentesEstorno.count + '</div><div class="pending-meta">' + fmt(pendencias.extratoPendentesEstorno.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaExtrato(\'pendentes_estorno\')">Abrir no Extrato</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Lançamentos rateados</div><div class="s-val blue">' + pendencias.extratoRateados.count + '</div><div class="pending-meta">' + fmt(pendencias.extratoRateados.valor) + '</div><button class="btn-sm" onclick="switchTab(\'extrato\')">Abrir no Extrato</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">A receber vencido</div><div class="s-val red">' + pendencias.receberVencido.count + '</div><div class="pending-meta">' + fmt(pendencias.receberVencido.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'receber\', \'atrasado\')">Abrir no Financeiro</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">A pagar vencido</div><div class="s-val red">' + pendencias.pagarVencido.count + '</div><div class="pending-meta">' + fmt(pendencias.pagarVencido.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'pagar\', \'atrasado\')">Abrir no Financeiro</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Receber parcial</div><div class="s-val yellow">' + pendencias.receberParcial.count + '</div><div class="pending-meta">' + fmt(pendencias.receberParcial.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'receber\', \'parcial\')">Abrir no Financeiro</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Pagar parcial</div><div class="s-val yellow">' + pendencias.pagarParcial.count + '</div><div class="pending-meta">' + fmt(pendencias.pagarParcial.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'pagar\', \'parcial\')">Abrir no Financeiro</button></div>'
      + '</div>'
    + '</div>'
    + '<div class="form-card">'
      + '<h3>Financeiro PJ</h3>'
      + '<p class="cartao-helper-text">Cadastre os títulos a receber e a pagar da empresa. No próximo passo, vamos poder conciliar essas baixas diretamente com o Extrato.</p>'
      + '<div class="tipo-toggle" style="margin-top:14px">'
        + '<button type="button" class="tipo-btn credito' + (_tfNatureza === 'receber' ? ' active' : '') + '" onclick="tfSetNatureza(\'receber\')">A Receber</button>'
        + '<button type="button" class="tipo-btn debito' + (_tfNatureza === 'pagar' ? ' active' : '') + '" onclick="tfSetNatureza(\'pagar\')">A Pagar</button>'
      + '</div>'
    + '</div>'
    + financeiroPanel('novo', '+ Novo título - ' + tituloAtivo,
      '<div class="form-row">'
        + '<div class="form-group"><label>' + pessoaLabel + '</label><input type="text" id="' + tfFormPrefix() + '-pessoa" placeholder="Quem está envolvido neste título"/></div>'
        + '<div class="form-group"><label>Descriçãoo</label><input type="text" id="' + tfFormPrefix() + '-descricao" placeholder="Ex.: Mensalidade, imposto, fornecedor"/></div>'
      + '</div>'
      + '<div class="form-row">'
        + '<div class="form-group" style="max-width:170px"><label>Vencimento</label><input type="text" id="' + tfFormPrefix() + '-vencimento" class="flex-date-input" placeholder="dd/mm ou dd/mm/aaaa"/></div>'
        + '<div class="form-group" style="max-width:170px"><label>Valor (R$)</label><input type="text" id="' + tfFormPrefix() + '-valor" class="money-input" value="0,00"/></div>'
      + '</div>'
      + '<div class="form-row">'
        + '<div class="form-group" style="max-width:170px"><label><input type="checkbox" id="' + tfFormPrefix() + '-recorrente" onchange="tfToggleRecorrencia(\'' + tfFormPrefix() + '\')"/> Título recorrente</label></div>'
        + '<div class="form-group" style="max-width:170px;display:none" data-tf-recorrencia="' + tfFormPrefix() + '"><label>Frequência</label><select id="' + tfFormPrefix() + '-recorrencia-freq"><option value="mensal">Mensal</option><option value="semanal">Semanal</option></select></div>'
        + '<div class="form-group" style="max-width:120px;display:none" data-tf-recorrencia="' + tfFormPrefix() + '"><label>Intervalo</label><input type="number" id="' + tfFormPrefix() + '-recorrencia-intervalo" value="1" min="1"/></div>'
        + '<div class="form-group" style="max-width:120px;display:none" data-tf-recorrencia="' + tfFormPrefix() + '"><label>Quantidade</label><input type="number" id="' + tfFormPrefix() + '-recorrencia-quantidade" value="1" min="1"/></div>'
        + '<div class="form-group" style="max-width:170px;display:none" data-tf-recorrencia="' + tfFormPrefix() + '"><label>Fim da recorrência</label><input type="text" id="' + tfFormPrefix() + '-recorrencia-fim" class="flex-date-input" placeholder="Opcional"/></div>'
      + '</div>'
      + '<div class="form-row">'
        + '<div class="form-group"><label>Observaçãoo</label><textarea id="' + tfFormPrefix() + '-observacao" rows="3" placeholder="Informaçõeses complementares deste título"></textarea></div>'
      + '</div>'
      + '<button class="btn-add" onclick="tfAddTitulo()">' + btnLabel + '</button>'
    )
      + '<div class="form-card">'
        + '<h3>Filtros</h3>'
        + '<div class="form-row">'
          + '<div class="form-group" style="max-width:180px"><label>Status</label><select id="tf-filtro-status"><option value="todos"' + (_tfStatus === 'todos' ? ' selected' : '') + '>Todos</option><option value="aberto"' + (_tfStatus === 'aberto' ? ' selected' : '') + '>Em aberto</option><option value="parcial"' + (_tfStatus === 'parcial' ? ' selected' : '') + '>Parcial</option><option value="quitado"' + (_tfStatus === 'quitado' ? ' selected' : '') + '>Quitado</option><option value="atrasado"' + (_tfStatus === 'atrasado' ? ' selected' : '') + '>Atrasado</option></select></div>'
          + '<div class="form-group"><label>Descriçãoo</label><input type="text" id="tf-filtro-descricao" value="' + esc(_tfDescricao) + '" placeholder="Filtrar pela descriçãoo do título" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
          + '<div class="form-group"><label>Busca</label><input type="text" id="tf-filtro-busca" value="' + esc(_tfBusca) + '" placeholder="Pessoa ou observaçãoo" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
        + '</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn-sm" onclick="tfApplyFilters()">Aplicar filtros</button><button class="btn-sm red" onclick="tfClearFilters()">Limpar</button><button class="btn-sm" onclick="tfExportPDF()">Exportar PDF</button><button class="btn-sm" onclick="tfExportXlsx()">Exportar XLSX</button></div>'
      + '</div>'
    + '<p class="section-title">' + tituloAtivo + '</p>'
    + areaHtml;

  initMoneyInputs(root);
  initFlexibleDateInputs(root);
  tfToggleRecorrencia(tfFormPrefix());
  initDrag('financeiro', COLS_TITULOS, renderFinanceiro);
}

function tfAuditoriaEventoLabel(evento) {
  var labels = {
    titulo_criado: 'Título criado',
    titulo_atualizado: 'Título atualizado',
    titulo_duplicado: 'Título duplicado',
    titulo_excluido: 'Título excluído',
    recebimento_manual: 'Recebimento manual',
    pagamento_manual: 'Pagamento manual',
    baixa_excluida: 'Baixa excluída',
    periodo_fechado: 'Período fechado',
    periodo_reaberto: 'Período reaberto',
    recorrencia_aplicada: 'Recorrência aplicada à série',
    recorrencia_pausada: 'Recorrência pausada',
    recorrencia_encerrada: 'Recorrência encerrada'
  };
  return labels[evento] || 'Evento financeiro';
}

function tfAuditoriaEventosDisponiveis() {
  return Array.from(new Set(tfAuditoriaCliente().map(function(item) {
    return item && item.evento ? item.evento : '';
  }).filter(Boolean))).sort(function(a, b) {
    return tfAuditoriaEventoLabel(a).localeCompare(tfAuditoriaEventoLabel(b), 'pt-BR');
  });
}

function tfAuditoriaFiltrada() {
  var agora = Date.now();
  var periodoDias = Number(_tfAuditoriaPeriodo || 0);
  var busca = tfNormalizeText(_tfAuditoriaBusca || '');
  return tfAuditoriaCliente().filter(function(item) {
    if (!item) return false;
    if (_tfAuditoriaEvento !== 'todos' && item.evento !== _tfAuditoriaEvento) return false;
    if (periodoDias > 0 && item.createdAt) {
      var when = new Date(item.createdAt).getTime();
      if (!isNaN(when)) {
        var diffDias = (agora - when) / 86400000;
        if (diffDias > periodoDias) return false;
      }
    }
    if (busca) {
      var hay = tfNormalizeText([item.resumo, item.evento, item.entidade, JSON.stringify(item.detalhes || {})].join(' '));
      if (hay.indexOf(busca) === -1) return false;
    }
    return true;
  });
}

function tfApplyAuditoriaFilters() {
  var eventoEl = document.getElementById('tf-auditoria-evento');
  var periodoEl = document.getElementById('tf-auditoria-periodo');
  var buscaEl = document.getElementById('tf-auditoria-busca');
  _tfAuditoriaEvento = eventoEl ? eventoEl.value : 'todos';
  _tfAuditoriaPeriodo = periodoEl ? periodoEl.value : '30';
  _tfAuditoriaBusca = buscaEl ? buscaEl.value.trim() : '';
  renderFinanceiro();
}

function tfClearAuditoriaFilters() {
  _tfAuditoriaEvento = 'todos';
  _tfAuditoriaPeriodo = '30';
  _tfAuditoriaBusca = '';
  renderFinanceiro();
}

function tfAuditoriaRecenteHtml() {
  var eventos = tfAuditoriaEventosDisponiveis();
  var itens = tfAuditoriaFiltrada().slice(0, 12);
  var filtrosHtml = '<div class="form-row" style="margin-bottom:12px">'
    + '<div class="form-group" style="max-width:190px"><label>Evento</label><select id="tf-auditoria-evento"><option value="todos">Todos</option>'
    + eventos.map(function(evento) {
      return '<option value="' + esc(evento) + '"' + (_tfAuditoriaEvento === evento ? ' selected' : '') + '>' + esc(tfAuditoriaEventoLabel(evento)) + '</option>';
    }).join('')
    + '</select></div>'
    + '<div class="form-group" style="max-width:150px"><label>Período</label><select id="tf-auditoria-periodo"><option value="7"' + (_tfAuditoriaPeriodo === '7' ? ' selected' : '') + '>7 dias</option><option value="30"' + (_tfAuditoriaPeriodo === '30' ? ' selected' : '') + '>30 dias</option><option value="90"' + (_tfAuditoriaPeriodo === '90' ? ' selected' : '') + '>90 dias</option><option value="0"' + (_tfAuditoriaPeriodo === '0' ? ' selected' : '') + '>Tudo</option></select></div>'
    + '<div class="form-group"><label>Busca</label><input type="text" id="tf-auditoria-busca" value="' + esc(_tfAuditoriaBusca) + '" placeholder="Resumo ou detalhe" onkeydown="if(event.key===\'Enter\')tfApplyAuditoriaFilters()"/></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn-sm" type="button" onclick="tfApplyAuditoriaFilters()">Aplicar</button><button class="btn-sm red" type="button" onclick="tfClearAuditoriaFilters()">Limpar</button></div>';
  if (!itens.length) {
    return filtrosHtml + '<div class="pending-meta">Nenhum evento financeiro encontrado com os filtros atuais.</div>';
  }
  return filtrosHtml + '<div class="financeiro-exec-list">'
    + itens.map(function(item) {
      var detalhes = [];
      if (item && item.createdAt) detalhes.push(formatDateTime(item.createdAt));
      if (item && item.resumo) detalhes.push(item.resumo);
      return '<div class="financeiro-exec-item">'
        + '<strong>' + esc(tfAuditoriaEventoLabel(item && item.evento)) + '</strong>'
        + '<span>' + esc((detalhes.join(' · ') || '-')) + '</span>'
      + '</div>';
    }).join('')
    + '</div>';
}

function tfEditRecorrenciaHtml(item) {
  var serie = tfTitulosDaSerie(item);
  var ativa = !!item.recorrenciaAtiva;
  var frequencia = item.recorrenciaFrequencia || 'mensal';
  var intervalo = Math.max(1, Number(item.recorrenciaIntervalo || 1));
  var fim = item.recorrenciaFim ? formatDate(item.recorrenciaFim) : '';
  return '<div class="settings-section-card" style="margin-bottom:18px">'
    + '<div class="settings-card-head"><div><h5>Recorrência</h5><p>' + (serie.length > 1 ? ('Série com ' + serie.length + ' títulos vinculados.') : 'Controle a repetiçãoo deste título.') + '</p></div></div>'
    + '<div class="form-row">'
      + '<div class="form-group" style="max-width:170px"><label><input type="checkbox" id="tf-edit-recorrente" onchange="tfToggleRecorrencia(\'tf-edit\')"' + (ativa ? ' checked' : '') + '/> Título recorrente</label></div>'
      + '<div class="form-group" style="max-width:170px;' + (ativa ? '' : 'display:none') + '" data-tf-recorrencia="tf-edit"><label>Frequência</label><select id="tf-edit-recorrencia-freq"><option value="mensal"' + (frequencia === 'mensal' ? ' selected' : '') + '>Mensal</option><option value="semanal"' + (frequencia === 'semanal' ? ' selected' : '') + '>Semanal</option></select></div>'
      + '<div class="form-group" style="max-width:120px;' + (ativa ? '' : 'display:none') + '" data-tf-recorrencia="tf-edit"><label>Intervalo</label><input type="number" id="tf-edit-recorrencia-intervalo" value="' + intervalo + '" min="1"/></div>'
      + '<div class="form-group" style="max-width:170px;' + (ativa ? '' : 'display:none') + '" data-tf-recorrencia="tf-edit"><label>Fim da recorrência</label><input type="text" id="tf-edit-recorrencia-fim" class="flex-date-input" value="' + esc(fim) + '" placeholder="Opcional"/></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="btn-sm" type="button" onclick="tfAplicarSerieTitulo(\'' + item.id + '\')">Aplicar à série</button>'
      + '<button class="btn-sm" type="button" onclick="tfPausarSerieTitulo(\'' + item.id + '\')">Pausar recorrência</button>'
      + '<button class="btn-sm red" type="button" onclick="tfEncerrarSerieTitulo(\'' + item.id + '\')">Encerrar série</button>'
    + '</div>'
  + '</div>';
}

function tfAtualizarSerieTitulos(item, modo) {
  return (async function() {
    var recorrencia = tfReadRecorrenciaForm('tf-edit');
    if (recorrencia === null) return;
    var pessoa = formatDescriptionTitleCase((document.getElementById('tf-edit-pessoa') || {}).value || '');
    var descricao = formatDescriptionTitleCase((document.getElementById('tf-edit-descricao') || {}).value || '');
    var vencimentoBase = tfNormalizeDateFieldValue('tf-edit-vencimento', 'vencimento');
    var valorTotal = tfParseAmountFromInput('tf-edit-valor');
    var observacao = ((document.getElementById('tf-edit-observacao') || {}).value || '').trim() || null;
    if (vencimentoBase === null) return;
    if (!pessoa || !descricao || valorTotal <= 0) {
      alert('Preencha pessoa, descriçãoo e valor do título.');
      return;
    }
    var serie = tfTitulosFuturosDaSerie(item);
    if (!serie.length) serie = [item];
    var ok = await appConfirm(
      modo === 'aplicar' ? 'Aplicar estas alteraçõeses aos títulos futuros da série?' :
      (modo === 'pausar' ? 'Pausar a recorrência desta série?' : 'Encerrar esta série recorrente a partir deste título?'),
      {
        title: modo === 'aplicar' ? 'Aplicar à série' : (modo === 'pausar' ? 'Pausar recorrência' : 'Encerrar série'),
        confirmText: modo === 'aplicar' ? 'Aplicar' : (modo === 'pausar' ? 'Pausar' : 'Encerrar')
      }
    );
    if (!ok) return;

    for (var idx = 0; idx < serie.length; idx++) {
      var entry = serie[idx];
      var payload = {
        pessoa_nome: pessoa,
        descricao: descricao,
        categoria: null,
        centro_custo_id: null,
        valor_total: valorTotal,
        observacao: observacao
      };
      if (modo === 'aplicar') {
        payload.vencimento = idx === 0 ? vencimentoBase : tfDataSomarRecorrencia(vencimentoBase, recorrencia.frequencia || 'mensal', idx, recorrencia.intervalo || 1);
        payload.recorrencia_ativa = !!recorrencia.ativa;
        payload.recorrencia_frequencia = recorrencia.ativa ? recorrencia.frequencia : null;
        payload.recorrencia_intervalo = recorrencia.ativa ? recorrencia.intervalo : 1;
        payload.recorrencia_fim = recorrencia.ativa ? recorrencia.fim : null;
      } else if (modo === 'pausar') {
        payload.vencimento = entry.vencimento;
        payload.recorrencia_ativa = false;
        payload.recorrencia_frequencia = entry.recorrenciaFrequencia || recorrencia.frequencia || null;
        payload.recorrencia_intervalo = Number(entry.recorrenciaIntervalo || recorrencia.intervalo || 1);
        payload.recorrencia_fim = entry.recorrenciaFim || recorrencia.fim || null;
      } else {
        payload.vencimento = entry.vencimento;
        payload.recorrencia_ativa = false;
        payload.recorrencia_frequencia = entry.recorrenciaFrequencia || recorrencia.frequencia || null;
        payload.recorrencia_intervalo = Number(entry.recorrenciaIntervalo || recorrencia.intervalo || 1);
        payload.recorrencia_fim = vencimentoBase || entry.vencimento || null;
      }

      var response = await applyUserScope(
        supabaseClient.from('titulos_financeiros').update(payload).eq('id', entry.id)
      ).select().single();

      if (response.error) {
        console.error(response.error);
        alert('Não foi possível atualizar a série inteira.');
        return;
      }
      tfUpdateLocalTitulo(response.data);
    }

    await tfRegistrarAuditoria(
      modo === 'aplicar' ? 'recorrencia_aplicada' : (modo === 'pausar' ? 'recorrencia_pausada' : 'recorrencia_encerrada'),
      'titulo_financeiro',
      tfSerieBaseId(item),
      modo === 'aplicar' ? 'Recorrência aplicada à série' : (modo === 'pausar' ? 'Recorrência pausada na série' : 'Recorrência encerrada na série'),
      {
        serie: tfSerieBaseId(item),
        quantidade: serie.length,
        natureza: item.natureza,
        vencimentoBase: vencimentoBase
      }
    );
    closeModal();
    renderFinanceiro();
  })();
}

function tfAplicarSerieTitulo(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  tfAtualizarSerieTitulos(item, 'aplicar');
}

function tfPausarSerieTitulo(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  tfAtualizarSerieTitulos(item, 'pausar');
}

function tfEncerrarSerieTitulo(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  tfAtualizarSerieTitulos(item, 'encerrar');
}

function tfOpenTituloModal(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var naturezaLabel = item.natureza === 'receber' ? 'Conta a receber' : 'Conta a pagar';
  var baixarLabel = item.natureza === 'receber' ? 'Registrar recebimento' : 'Registrar pagamento';
  var recorrenciaLabel = tfDescribeRecorrencia(item);
  var baixasHtml = (item.baixas || []).length
    ? item.baixas.slice().sort(function(a, b) {
        return String(b.data || '').localeCompare(String(a.data || ''));
      }).map(function(baixa) {
        return '<div class="tf-baixa-item">'
          + '<div><strong>' + esc(formatDate(baixa.data)) + '</strong><small>' + esc(baixa.origem === 'extrato' ? 'Conciliado com extrato' : 'Baixa manual') + (baixa.observacao ? ' · ' + esc(baixa.observacao) : '') + '</small></div>'
          + '<div style="display:flex;align-items:center;gap:10px"><strong style="color:var(--accent3)">' + fmt(baixa.valor) + '</strong><button class="btn-icon danger" onclick="tfDeleteBaixa(\'' + id + '\',\'' + baixa.id + '\')" title="Excluir baixa">&#128465;</button></div>'
          + '</div>';
      }).join('')
    : '<div class="empty-state" style="padding:22px 12px">Nenhuma baixa registrada ainda.</div>';

  document.getElementById('modalTitle').textContent = naturezaLabel;
  document.getElementById('modalBody').innerHTML =
    '<div class="settings-card-badges" style="margin:0 0 18px 0">'
      + '<span class="settings-card-badge">' + esc(item.natureza === 'receber' ? 'Receber' : 'Pagar') + '</span>'
      + '<span class="settings-card-badge subtle">Total ' + fmt(item.valorTotal) + '</span>'
      + '<span class="settings-card-badge subtle">Baixado ' + fmt(tfTotalBaixado(item)) + '</span>'
      + '<span class="settings-card-badge subtle">Saldo ' + fmt(tfSaldo(item)) + '</span>'
      + (recorrenciaLabel ? '<span class="settings-card-badge subtle">' + esc(recorrenciaLabel) + '</span>' : '')
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group"><label>' + (item.natureza === 'receber' ? 'Cliente pagador' : 'Favorecido / fornecedor') + '</label><input type="text" id="tf-edit-pessoa" value="' + esc(item.pessoaNome || '') + '"/></div>'
      + '<div class="form-group"><label>Descriçãoo</label><input type="text" id="tf-edit-descricao" value="' + esc(item.descricao || '') + '"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group" style="max-width:170px"><label>Vencimento</label><input type="text" id="tf-edit-vencimento" class="flex-date-input" value="' + esc(item.vencimento ? formatDate(item.vencimento) : '') + '" placeholder="dd/mm ou dd/mm/aaaa"/></div>'
      + '<div class="form-group" style="max-width:170px"><label>Valor total</label><input type="text" id="tf-edit-valor" class="money-input" value="' + esc((Number(item.valorTotal || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group"><label>Observaçãoo</label><textarea id="tf-edit-observacao" rows="3" placeholder="Informaçõeses importantes deste título">' + esc(item.observacao || '') + '</textarea></div>'
    + '</div>'
    + tfEditRecorrenciaHtml(item)
    + '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin:4px 0 18px">'
      + '<button class="btn-sm" type="button" onclick="tfDuplicarTitulo(\'' + id + '\')">Duplicar título</button>'
      + '<button class="btn-sm red" type="button" onclick="closeModal()">Fechar</button>'
      + '<button class="btn-add" type="button" style="margin-top:0" onclick="tfSaveTitulo(\'' + id + '\')">Salvar título</button>'
    + '</div>'
    + '<div class="settings-section-card">'
      + '<div class="settings-card-head"><div><h5>Baixas registradas</h5><p>Registre recebimentos ou pagamentos parciais para acompanhar o saldo deste título.</p></div></div>'
      + baixasHtml
      + '<div class="form-row" style="margin-top:16px">'
        + '<div class="form-group" style="max-width:170px"><label>Data da baixa</label><input type="text" id="tf-baixa-data" class="flex-date-input" value="' + esc(formatDate(new Date().toISOString().slice(0, 10))) + '" placeholder="dd/mm ou dd/mm/aaaa"/></div>'
        + '<div class="form-group" style="max-width:170px"><label>Valor</label><input type="text" id="tf-baixa-valor" class="money-input" value="' + esc(Math.max(tfSaldo(item), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '"/></div>'
        + '<div class="form-group"><label>Observaçãoo</label><input type="text" id="tf-baixa-observacao" placeholder="Ex.: Pix, TED, boleto"/></div>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end"><button class="btn-add" type="button" style="margin-top:6px" onclick="tfRegistrarBaixa(\'' + id + '\')">' + baixarLabel + '</button></div>'
    + '</div>';

  document.getElementById('modalOverlay').classList.add('open');
  document.addEventListener('keydown', handleMainModalEscape);
  initMoneyInputs(document.getElementById('modalBody'));
  initFlexibleDateInputs(document.getElementById('modalBody'));
  tfToggleRecorrencia('tf-edit');
}

async function tfSaveTitulo(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var recorrencia = tfReadRecorrenciaForm('tf-edit');
  if (recorrencia === null) return;
  var payload = {
    pessoa_nome: formatDescriptionTitleCase((document.getElementById('tf-edit-pessoa') || {}).value || ''),
    descricao: formatDescriptionTitleCase((document.getElementById('tf-edit-descricao') || {}).value || ''),
    categoria: null,
    centro_custo_id: ((document.getElementById('tf-edit-centro-custo') || {}).value || '').trim() || null,
    vencimento: tfNormalizeDateFieldValue('tf-edit-vencimento', 'vencimento'),
    valor_total: tfParseAmountFromInput('tf-edit-valor'),
    observacao: ((document.getElementById('tf-edit-observacao') || {}).value || '').trim() || null,
    recorrencia_ativa: !!recorrencia.ativa,
    recorrencia_frequencia: recorrencia.ativa ? recorrencia.frequencia : null,
    recorrencia_intervalo: recorrencia.ativa ? recorrencia.intervalo : 1,
    recorrencia_fim: recorrencia.ativa ? recorrencia.fim : null
  };
  if (payload.vencimento === null) return;
  if (!payload.pessoa_nome || !payload.descricao || payload.valor_total <= 0) {
    alert('Preencha pessoa, descriçãoo e valor do título.');
    return;
  }
  if (payload.vencimento && tfPeriodoEstaFechado(tfReferenciaMes(payload.vencimento))) {
    var seguir = await appConfirm('O período ' + tfMonthLabel(tfReferenciaMes(payload.vencimento)) + ' está fechado. Deseja salvar mesmo assim?', { title: 'Período fechado', confirmText: 'Salvar mesmo assim' });
    if (!seguir) return;
  }
  var response = await applyUserScope(
    supabaseClient.from('titulos_financeiros').update(payload).eq('id', id)
  ).select().single();
  if (response.error) {
    console.error(response.error);
    alert('Não foi possível salvar o título.');
    return;
  }
  tfUpdateLocalTitulo(response.data);
  await tfRegistrarAuditoria('titulo_atualizado', 'titulo_financeiro', id, 'Título financeiro atualizado', {
    natureza: item.natureza,
    pessoa: payload.pessoa_nome,
    descricao: payload.descricao,
    valor: payload.valor_total,
    vencimento: payload.vencimento
  });
  closeModal();
  renderFinanceiro();
}
