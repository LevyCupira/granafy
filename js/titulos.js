// Financeiro PJ: contas a receber / contas a pagar.

var _tfNatureza = 'receber';
var _tfStatus = 'todos';
var _tfDescricao = '';
var _tfPessoa = '';
var _tfVencimentoDe = '';
var _tfVencimentoAte = '';
var _tfValorModo = 'todos';
var _tfValor = 0;
var _tfCentroCusto = '';
var _tfEvento = '';
var _tfBusca = '';
var _tfEventoEditId = null;
var _tfOrcamentoEventoId = '';
var _tfOrcamentoLinhaEditId = null;
var _tfBulkSelected = new Set();
var _tfFinanceiroView = 'titulos';
var TF_MIN_SEARCH_CHARS = 3;
var _tfPanels = {
  resumo: true,
  eventos: true,
  pendencias: true,
  importar: false,
  filtros: true,
  lista: true,
  novo: false
};

var COLS_TITULOS = [
  { key: 'vencimento', label: 'Vencimento', render: item => '<span style="color:var(--muted);font-size:.78rem">' + esc(formatDate(item.vencimento)) + '</span>' },
  { key: 'pessoa', label: 'Pessoa', render: item => '<strong>' + esc(item.pessoaNome || '-') + '</strong>' },
  { key: 'descricao', label: 'Descricao', render: item => esc(item.descricao || '-') + (item.observacao ? '<div class="installment-note">' + esc(item.observacao) + '</div>' : '') },
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
  var realizacoes = typeof tfOrcamentoRealizacoesLancamento === 'function'
    ? tfOrcamentoRealizacoesLancamento(lancamentoId, natureza)
    : [];
  var linhasDiretas = new Set(realizacoes.map(function(item) { return item.orcamentoLinhaId; }).filter(Boolean));
  var financeiro = tfBaixasPorLancamentoId(lancamentoId, natureza).reduce(function(sum, item) {
    var titulo = tfFindTituloById(item.tituloId);
    if (titulo && titulo.orcamentoLinhaId && linhasDiretas.has(titulo.orcamentoLinhaId)) return sum;
    return sum + Number(item.baixa.valor || 0);
  }, 0);
  return financeiro + realizacoes.reduce(function(sum, item) { return sum + Number(item.valor || 0); }, 0);
}

function tfNormalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tfSearchTerm(value) {
  var term = tfNormalizeText(value);
  return term.length >= TF_MIN_SEARCH_CHARS ? term : '';
}

function tfSearchText(item) {
  return tfNormalizeText([
    item.pessoaNome,
    item.descricao,
    item.centroCusto,
    item.evento,
    item.observacao
  ].join(' '));
}

function tfParseAmountFromInput(id) {
  return parseMoney(document.getElementById(id));
}

function tfValorBateFiltro(item) {
  if (_tfValorModo === 'todos' || !_tfValor) return true;
  var valor = Number(item.valorTotal || 0);
  var alvo = Number(_tfValor || 0);
  if (_tfValorModo === 'acima') return valor >= alvo;
  if (_tfValorModo === 'abaixo') return valor <= alvo;
  return Math.round(valor * 100) === Math.round(alvo * 100);
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
    if (_tfNatureza === 'pagar' && _tfCentroCusto === '__sem_centro__' && item.centroCustoId) return false;
    if (_tfNatureza === 'pagar' && _tfCentroCusto && _tfCentroCusto !== '__sem_centro__' && String(item.centroCustoId || '') !== _tfCentroCusto) return false;
    if (tfEventosEnabled() && _tfEvento === '__sem_evento__' && item.eventoId) return false;
    if (tfEventosEnabled() && _tfEvento && _tfEvento !== '__sem_evento__' && String(item.eventoId || '') !== _tfEvento) return false;
    if (_tfVencimentoDe && String(item.vencimento || '') < _tfVencimentoDe) return false;
    if (_tfVencimentoAte && String(item.vencimento || '') > _tfVencimentoAte) return false;
    if (!tfValorBateFiltro(item)) return false;
    if (_tfPessoa) {
      var pessoaTerm = tfSearchTerm(_tfPessoa);
      if (pessoaTerm && tfNormalizeText(item.pessoaNome || '').indexOf(pessoaTerm) === -1) return false;
    }
    if (_tfDescricao) {
      var descricaoTerm = tfSearchTerm(_tfDescricao);
      if (descricaoTerm && tfNormalizeText(item.descricao || '').indexOf(descricaoTerm) === -1) return false;
    }
    if (_tfBusca) {
      var buscaTerm = tfSearchTerm(_tfBusca);
      if (buscaTerm && tfSearchText(item).indexOf(buscaTerm) === -1) return false;
    }
    return true;
  }));
}

function tfSummaryValues(items) {
  items = Array.isArray(items) ? items : tfTitulosCliente();
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
  if (tipo === 'nao_conciliados') _exFiltroConciliacao = 'nao_conciliados';
  if (tipo === 'pendentes_estorno') _exFiltroEstorno = 'pendentes_estorno';
  switchTab('extrato');
}

function tfAbrirPendenciaFinanceiro(natureza, status) {
  _tfNatureza = natureza === 'pagar' ? 'pagar' : 'receber';
  _tfStatus = status || 'todos';
  _tfDescricao = '';
  _tfPessoa = '';
  _tfVencimentoDe = '';
  _tfVencimentoAte = '';
  _tfValorModo = 'todos';
  _tfValor = 0;
  _tfCentroCusto = '';
  _tfEvento = '';
  _tfBusca = '';
  switchTab('financeiro');
}

function tfSetNatureza(natureza) {
  _tfNatureza = natureza === 'pagar' ? 'pagar' : 'receber';
  if (_tfNatureza !== 'pagar') _tfCentroCusto = '';
  _tfBulkSelected.clear();
  renderFinanceiro();
}

function tfSetFinanceiroView(view) {
  var views = ['titulos', 'eventos', 'pendencias', 'importar'];
  _tfFinanceiroView = views.includes(view) ? view : 'titulos';
  renderFinanceiro();
}

function tfOpenNovoTitulo() {
  _tfPanels.novo = true;
  _tfFinanceiroView = 'titulos';
  renderFinanceiro();
}

function tfApplyFilters() {
  var statusEl = document.getElementById('tf-filtro-status');
  var pessoaEl = document.getElementById('tf-filtro-pessoa');
  var descricaoEl = document.getElementById('tf-filtro-descricao');
  var vencimentoDeEl = document.getElementById('tf-filtro-vencimento-de');
  var vencimentoAteEl = document.getElementById('tf-filtro-vencimento-ate');
  var valorModoEl = document.getElementById('tf-filtro-valor-modo');
  var valorEl = document.getElementById('tf-filtro-valor');
  var centroCustoEl = document.getElementById('tf-filtro-centro-custo');
  var eventoEl = document.getElementById('tf-filtro-evento');
  var buscaEl = document.getElementById('tf-filtro-busca');
  _tfStatus = statusEl ? statusEl.value : 'todos';
  _tfPessoa = pessoaEl ? pessoaEl.value.trim() : '';
  _tfDescricao = descricaoEl ? descricaoEl.value.trim() : '';
  _tfVencimentoDe = vencimentoDeEl ? readFlexibleDateInput(vencimentoDeEl) : '';
  _tfVencimentoAte = vencimentoAteEl ? readFlexibleDateInput(vencimentoAteEl) : '';
  _tfValorModo = valorModoEl ? valorModoEl.value : 'todos';
  _tfValor = valorEl ? parseMoney(valorEl) : 0;
  _tfCentroCusto = centroCustoEl ? String(centroCustoEl.value || '').trim() : '';
  _tfEvento = eventoEl ? String(eventoEl.value || '').trim() : '';
  _tfBusca = buscaEl ? buscaEl.value.trim() : '';
  renderFinanceiro();
}

function tfClearFilters() {
  _tfStatus = 'todos';
  _tfDescricao = '';
  _tfPessoa = '';
  _tfVencimentoDe = '';
  _tfVencimentoAte = '';
  _tfValorModo = 'todos';
  _tfValor = 0;
  _tfCentroCusto = '';
  _tfEvento = '';
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
      Evento: item.evento || tfNomeEventoById(item.eventoId || null),
      Status: tfStatusLabel(tfStatusOf(item)),
      Total: Number(item.valorTotal || 0),
      Baixado: tfTotalBaixado(item),
      Saldo: tfSaldo(item),
      Observacao: item.observacao || ''
    };
  });
}

function tfExportXlsx() {
  if (!activeClient || !tfClienteAtivo()) return alert('Selecione um cliente.');
  var rows = tfExportRows();
  if (!rows.length) return alert('Nao ha dados para exportar com os filtros atuais.');
  var cliente = tfClienteAtivo();
  var resumo = [
    ['Cliente', cliente.name || ''],
    ['Tela', tfTituloAtivoLabel()],
    ['Status', _tfStatus || 'todos'],
    ['Pessoa', _tfPessoa || ''],
    ['Descricao', _tfDescricao || ''],
    ['Vencimento de', _tfVencimentoDe ? formatDate(_tfVencimentoDe) : ''],
    ['Vencimento ate', _tfVencimentoAte ? formatDate(_tfVencimentoAte) : ''],
    ['Valor', (_tfValorModo === 'todos' || !_tfValor) ? '' : (_tfValorModo + ' ' + fmt(_tfValor))],
    ['Centro de custo', _tfCentroCusto === '__sem_centro__' ? 'Sem centro' : (tfNomeCentroCustoById(_tfCentroCusto) || '')],
    [tfEventosLabel(), _tfEvento === '__sem_evento__' ? 'Sem ' + tfEventosLabel().toLowerCase() : (tfNomeEventoById(_tfEvento) || '')],
    ['Busca', _tfBusca || ''],
    ['Gerado em', new Date().toLocaleString('pt-BR')]
  ];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Resumo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows, {
    header: ['Vencimento', 'Pessoa', 'Descricao', 'Evento', 'Status', 'Total', 'Baixado', 'Saldo', 'Observacao']
  }), _tfNatureza === 'pagar' ? 'A Pagar' : 'A Receber');
  XLSX.writeFile(
    wb,
    'granafy_financeiro_' + (_tfNatureza === 'pagar' ? 'pagar' : 'receber') + '_'
      + String(cliente.name || 'cliente').toLowerCase().replace(/\s+/g, '_')
      + '_' + new Date().toISOString().slice(0, 10) + '.xlsx'
  );
}

function tfImportGuideHtml() {
  return '<div class="import-guide">'
    + '<div class="import-guide-head">Formato da planilha</div>'
    + '<div class="import-guide-grid">'
    + '<span class="import-guide-chip required">vencimento</span>'
    + '<span class="import-guide-chip required">pessoa</span>'
    + '<span class="import-guide-chip">descricao</span>'
    + '<span class="import-guide-chip required">valor</span>'
    + '<span class="import-guide-chip">observacao</span>'
    + '<span class="import-guide-chip">natureza</span>'
    + (tfEventosEnabled() ? '<span class="import-guide-chip">' + esc(tfEventosLabel().toLowerCase()) + '</span>' : '')
    + '</div>'
    + '<ul class="import-guide-list">'
    + '<li>Sem a coluna <strong>natureza</strong>, importa para a aba aberta: A Receber ou A Pagar.</li>'
    + '<li>Use <strong>receber</strong> ou <strong>pagar</strong> na coluna natureza quando quiser misturar no mesmo arquivo.</li>'
    + '<li>A coluna <strong>descricao</strong> e opcional; quando vazia, o sistema cria uma descricao automatica.</li>'
    + '<li>Linhas duplicadas iguais a titulos ja cadastrados serao ignoradas.</li>'
    + '</ul>'
    + '</div>';
}

function tfExportImportTemplate() {
  var natureza = _tfNatureza === 'pagar' ? 'pagar' : 'receber';
  var pessoa = natureza === 'pagar' ? 'Fornecedor Exemplo' : 'Cliente Exemplo';
  var descricao = natureza === 'pagar' ? 'Aluguel' : 'Mensalidade';
  var rows = [
    ['vencimento', 'pessoa', 'descricao', 'valor', 'observacao', 'natureza'].concat(tfEventosEnabled() ? [tfEventosLabel().toLowerCase()] : []),
    ['15/06/2026', pessoa, descricao, 1200.00, 'Opcional', natureza].concat(tfEventosEnabled() ? ['Evento Exemplo'] : [])
  ];
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:14},{wch:28},{wch:34},{wch:12},{wch:34},{wch:12},{wch:28}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, natureza === 'pagar' ? 'A Pagar' : 'A Receber');
  XLSX.writeFile(wb, 'modelo_financeiro_' + natureza + '_granafy.xlsx');
}

function tfAbrirImportacaoTitulos() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  if (!activeClient || !tfClienteAtivo()) return alert('Selecione um cliente primeiro.');
  var input = document.getElementById('importTitulosXlsxInput');
  if (input) input.click();
}

function tfHeaderIndex(header, termos) {
  return header.findIndex(function(h) {
    return termos.some(function(termo) { return h.includes(termo); });
  });
}

function tfNaturezaImportada(value) {
  var txt = tfNormalizeText(value);
  if (txt.includes('pagar') || txt.includes('fornecedor') || txt.includes('despesa') || txt.includes('debito')) return 'pagar';
  if (txt.includes('receber') || txt.includes('cliente') || txt.includes('receita') || txt.includes('credito')) return 'receber';
  return _tfNatureza === 'pagar' ? 'pagar' : 'receber';
}

function tfValorImportadoTitulo(rawVal) {
  if (typeof rawVal === 'number') return rawVal;
  var texto = String(rawVal || '').replace(/[^0-9,.-]/g, '').trim();
  if (!texto) return 0;
  if (texto.includes(',') && texto.includes('.')) texto = texto.replace(/\./g, '').replace(',', '.');
  else if (texto.includes(',')) texto = texto.replace(',', '.');
  return parseFloat(texto) || 0;
}

function tfDescricaoTituloFallback(natureza, pessoa) {
  var label = natureza === 'pagar' ? 'Conta a pagar' : 'Conta a receber';
  return pessoa ? label + ' - ' + pessoa : label;
}

function tfDescricaoTitulo(descricao, natureza, pessoa) {
  var texto = formatDescriptionTitleCase(String(descricao || '').trim());
  return texto || tfDescricaoTituloFallback(natureza, pessoa);
}

function tfChaveDuplicidadeTitulo(item) {
  return [
    item.natureza || '',
    item.vencimento || '',
    tfNormalizeText(item.pessoaNome || item.pessoa_nome || ''),
    tfNormalizeText(item.descricao || ''),
    Math.round(Number(item.valorTotal || item.valor_total || 0) * 100)
  ].join('|');
}

async function importTitulosXlsx(event) {
  var file = event.target.files[0];
  if (!file) return;
  if (!activeClient) return alert('Selecione um cliente primeiro.');
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');

  var reader = new FileReader();
  reader.onload = async function(e) {
    var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
    var ws = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    var header = (rows[0] || []).map(function(h) { return tfNormalizeText(h); });
    var iVenc = tfHeaderIndex(header, ['vencimento', 'data', 'due']);
    var iPessoa = tfHeaderIndex(header, ['pessoa', 'cliente', 'fornecedor', 'favorecido', 'pagador']);
    var iDesc = tfHeaderIndex(header, ['descricao', 'desc', 'titulo']);
    var iVal = tfHeaderIndex(header, ['valor', 'total', 'amount']);
    var iObs = tfHeaderIndex(header, ['observacao', 'obs', 'nota']);
    var iNat = tfHeaderIndex(header, ['natureza', 'tipo']);
    var iEvento = tfHeaderIndex(header, ['evento', 'projeto', 'obra', 'campanha', 'contrato']);

    if (iVenc < 0 || iPessoa < 0 || iVal < 0) {
      return alert('Planilha invalida. Colunas obrigatorias: vencimento, pessoa e valor.');
    }

    var cliente = tfClienteAtivo();
    var existentes = new Set((cliente.titulos || []).map(tfChaveDuplicidadeTitulo));
    var payloads = [];
    var ignorados = 0;

    rows.slice(1).forEach(function(row) {
      var vencimento = normalizarDataImportada(row[iVenc]);
      var pessoa = formatDescriptionTitleCase(String(row[iPessoa] || ''));
      var descricaoBruta = iDesc >= 0 ? String(row[iDesc] || '') : '';
      var valor = Math.abs(Number(tfValorImportadoTitulo(row[iVal]) || 0));
      var observacao = iObs >= 0 ? String(row[iObs] || '').trim() : '';
      var natureza = iNat >= 0 ? tfNaturezaImportada(row[iNat]) : (_tfNatureza === 'pagar' ? 'pagar' : 'receber');
      var descricao = tfDescricaoTitulo(descricaoBruta, natureza, pessoa);
      var eventoNome = iEvento >= 0 ? String(row[iEvento] || '').trim() : '';
      var evento = eventoNome ? tfEventosCliente(true).find(function(ev) { return tfNormalizeText(ev.nome) === tfNormalizeText(eventoNome); }) : null;

      if (!vencimento || !pessoa || valor <= 0) {
        ignorados++;
        return;
      }

      var item = {
        natureza: natureza,
        pessoaNome: pessoa,
        descricao: descricao,
        vencimento: vencimento,
        valorTotal: valor
      };
      var chave = tfChaveDuplicidadeTitulo(item);
      if (existentes.has(chave)) {
        ignorados++;
        return;
      }
      existentes.add(chave);

      var importPayload = Object.assign({
        cliente_id: activeClient,
        natureza: natureza,
        pessoa_nome: pessoa,
        descricao: descricao,
        categoria: null,
        centro_custo_id: null,
        vencimento: vencimento,
        valor_total: valor,
        observacao: observacao || null
      }, getUserScopePayload());
      if (tfEventosEnabled() || evento) importPayload.evento_id = evento ? evento.id : null;
      payloads.push(importPayload);
    });

    if (!payloads.length) {
      return alert('Nenhum titulo valido para importar.' + (ignorados ? ' ' + ignorados + ' linha(s) ignorada(s).' : ''));
    }

    var response = await supabaseClient
      .from('titulos_financeiros')
      .insert(payloads);

    if (response.error) {
      console.error('Erro ao importar titulos financeiros:', response.error);
      return alert('Nao foi possivel importar os titulos. Verifique a planilha e a migracao do Financeiro PJ.');
    }

    if (typeof notifyWorkspaceDataChanged === 'function') notifyWorkspaceDataChanged(activeClient, 'importacao_titulos');
    await loadData();
    renderFinanceiro();
    alert(payloads.length + ' titulo(s) importado(s) com sucesso!' + (ignorados ? ' ' + ignorados + ' linha(s) ignorada(s).' : ''));
  };

  reader.readAsArrayBuffer(file);
  event.target.value = '';
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
  doc.text('Status: ' + (_tfStatus || 'todos') + ' | Pessoa: ' + (_tfPessoa || '-') + ' | Descricao: ' + (_tfDescricao || '-') + ' | Busca: ' + (_tfBusca || '-'), 14, 31);
  doc.autoTable({
    startY: 36,
    head: [['Vencimento', 'Pessoa', 'Descricao', 'Status', 'Total', 'Baixado', 'Saldo', 'Observacao']],
    body: rows.map(function(row) {
      return [
        row.Vencimento, row.Pessoa, row.Descricao, row.Status,
        fmt(row.Total), fmt(row.Baixado), fmt(row.Saldo), row.Observacao
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

function tfCentrosCustoFilterOptionsHtml(selectedId) {
  var atual = String(selectedId || '').trim();
  var centros = tfCentrosCustoCliente().slice().sort(function(a, b) {
    return String(a && a.nome || '').localeCompare(String(b && b.nome || ''), 'pt-BR', { sensitivity: 'base' });
  });
  return '<option value=""' + (!atual ? ' selected' : '') + '>Todos</option>'
    + '<option value="__sem_centro__"' + (atual === '__sem_centro__' ? ' selected' : '') + '>Sem centro</option>'
    + centros.map(function(item) {
      return '<option value="' + esc(item.id) + '"' + (String(item.id) === atual ? ' selected' : '') + '>' + esc(item.nome || '') + '</option>';
    }).join('');
}

function tfEventosEnabled() {
  var cliente = tfClienteAtivo();
  return !!(cliente && String(cliente.tipoCliente || '').toLowerCase() === 'pj' && cliente.eventosEnabled);
}

function tfEventosLabel() {
  var cliente = tfClienteAtivo();
  return (cliente && cliente.eventosLabel) || 'Eventos';
}

function tfEventosCliente(includeInactive) {
  var cliente = tfClienteAtivo();
  var eventos = cliente && Array.isArray(cliente.eventos) ? cliente.eventos : [];
  if (includeInactive) return eventos;
  return eventos.filter(function(evento) { return evento.ativo !== false; });
}

function tfNomeEventoById(eventoId) {
  if (!eventoId) return '';
  var evento = tfEventosCliente(true).find(function(item) { return item.id === eventoId; });
  return evento ? String(evento.nome || '') : '';
}

function tfEventosOptionsHtml(selectedId, allowEmptyLabel) {
  var atual = String(selectedId || '').trim();
  var eventos = tfEventosCliente(false).slice().sort(function(a, b) {
    return String(a && a.nome || '').localeCompare(String(b && b.nome || ''), 'pt-BR', { sensitivity: 'base' });
  });
  var emptyLabel = allowEmptyLabel || ('Sem ' + tfEventosLabel().toLowerCase());
  return '<option value="">' + esc(emptyLabel) + '</option>' + eventos.map(function(item) {
    return '<option value="' + esc(item.id) + '"' + (String(item.id) === atual ? ' selected' : '') + '>' + esc(item.nome || '') + '</option>';
  }).join('');
}

function tfEventosFilterOptionsHtml(selectedId) {
  var atual = String(selectedId || '').trim();
  var eventos = tfEventosCliente(true).slice().sort(function(a, b) {
    return String(a && a.nome || '').localeCompare(String(b && b.nome || ''), 'pt-BR', { sensitivity: 'base' });
  });
  return '<option value=""' + (!atual ? ' selected' : '') + '>Todos</option>'
    + '<option value="__sem_evento__"' + (atual === '__sem_evento__' ? ' selected' : '') + '>Sem ' + esc(tfEventosLabel().toLowerCase()) + '</option>'
    + eventos.map(function(item) {
      return '<option value="' + esc(item.id) + '"' + (String(item.id) === atual ? ' selected' : '') + '>' + esc(item.nome || '') + (item.ativo === false ? ' (inativo)' : '') + '</option>';
    }).join('');
}

function tfNaturezaOrcamentoLabel(natureza) {
  return natureza === 'receita' ? 'Receita' : 'Despesa';
}

function tfOrcamentoStatusLabel(status) {
  if (status === 'contratado') return 'Contratado';
  if (status === 'realizado') return 'Realizado';
  if (status === 'cancelado') return 'Cancelado';
  return 'Previsto';
}

function tfOrcamentoLinhasCliente() {
  var cliente = tfClienteAtivo();
  return cliente && Array.isArray(cliente.orcamentoEventos) ? cliente.orcamentoEventos : [];
}

function tfOrcamentoLinhasEvento(eventoId) {
  return tfOrcamentoLinhasCliente().filter(function(item) { return item.eventoId === eventoId; });
}

function tfOrcamentoLinhaById(id) {
  return tfOrcamentoLinhasCliente().find(function(item) { return item.id === id; }) || null;
}

function tfTitulosPorOrcamentoLinha(linhaId) {
  if (!linhaId) return [];
  return tfTitulosCliente().filter(function(item) { return item.orcamentoLinhaId === linhaId; });
}

function tfOrcamentoRealizacoesCliente() {
  var cliente = tfClienteAtivo();
  return cliente && Array.isArray(cliente.orcamentoRealizacoes) ? cliente.orcamentoRealizacoes : [];
}

function tfOrcamentoRealizacoesLinha(linhaId) {
  if (!linhaId) return [];
  return tfOrcamentoRealizacoesCliente().filter(function(item) { return item.orcamentoLinhaId === linhaId; });
}

function tfOrcamentoRealizacoesLancamento(lancamentoId, natureza) {
  if (!lancamentoId) return [];
  return tfOrcamentoRealizacoesCliente().filter(function(item) {
    if (item.lancamentoId !== lancamentoId) return false;
    var linha = tfOrcamentoLinhaById(item.orcamentoLinhaId);
    return linha && (!natureza || tfNaturezaTituloParaOrcamento(natureza) === linha.natureza);
  });
}

function tfValorOrcamentoConciliadoLancamento(lancamentoId, natureza) {
  return tfOrcamentoRealizacoesLancamento(lancamentoId, natureza).reduce(function(sum, item) {
    return sum + Number(item.valor || 0);
  }, 0);
}

function tfNaturezaTituloParaOrcamento(naturezaTitulo) {
  return naturezaTitulo === 'receber' ? 'receita' : 'despesa';
}

function tfOrcamentoLabelLinha(linha) {
  if (!linha) return '';
  var evento = tfNomeEventoById(linha.eventoId || '') || 'Sem evento';
  var valor = tfOrcamentoPrevistoLinha(linha) || Number(linha.valorOrcado || 0);
  return evento + ' - ' + (linha.categoria || '-') + ' (' + fmt(valor) + ')';
}

function tfOrcamentoOptionsHtml(naturezaTitulo, eventoId, selectedId, includeEmptyLabel) {
  var naturezaOrcamento = tfNaturezaTituloParaOrcamento(naturezaTitulo);
  var atual = String(selectedId || '').trim();
  var linhas = tfOrcamentoLinhasCliente().filter(function(linha) {
    if (!linha || linha.natureza !== naturezaOrcamento) return false;
    if (eventoId && linha.eventoId !== eventoId) return false;
    return true;
  }).sort(function(a, b) {
    var evComp = String(tfNomeEventoById(a.eventoId) || '').localeCompare(String(tfNomeEventoById(b.eventoId) || ''), 'pt-BR', { sensitivity: 'base' });
    if (evComp) return evComp;
    return String(a.categoria || '').localeCompare(String(b.categoria || ''), 'pt-BR', { sensitivity: 'base' });
  });
  return '<option value="">' + esc(includeEmptyLabel || 'Sem vinculo com orcamento') + '</option>' + linhas.map(function(linha) {
    return '<option value="' + esc(linha.id) + '"' + (linha.id === atual ? ' selected' : '') + '>' + esc(tfOrcamentoLabelLinha(linha)) + '</option>';
  }).join('');
}

function tfSyncOrcamentoOptions(prefix, naturezaTitulo) {
  var eventoEl = document.getElementById(prefix + '-evento');
  var orcEl = document.getElementById(prefix + '-orcamento-linha');
  if (!orcEl) return;
  var eventoId = eventoEl ? ((eventoEl.value || '').trim()) : '';
  orcEl.innerHTML = tfOrcamentoOptionsHtml(naturezaTitulo, eventoId, '');
}

function tfOrcamentoLinhaCompativelComTitulo(linha, titulo) {
  if (!linha || !titulo) return false;
  if (linha.eventoId !== titulo.eventoId) return false;
  return linha.natureza === tfNaturezaTituloParaOrcamento(titulo.natureza);
}

function tfOrcamentoRealizadoLinha(linha) {
  if (!linha) return 0;
  var realizacoes = tfOrcamentoRealizacoesLinha(linha.id);
  var lancamentosDiretos = new Set(realizacoes.map(function(item) { return item.lancamentoId; }).filter(Boolean));
  var direto = realizacoes.reduce(function(sum, item) { return sum + Number(item.valor || 0); }, 0);
  var financeiro = tfTitulosPorOrcamentoLinha(linha.id).reduce(function(sum, titulo) {
    return sum + (titulo.baixas || []).reduce(function(total, baixa) {
      return total + (baixa.lancamentoId && lancamentosDiretos.has(baixa.lancamentoId) ? 0 : Number(baixa.valor || 0));
    }, 0);
  }, 0);
  return direto + financeiro;
}

function tfOrcamentoPrevistoLinha(linha) {
  return Number(linha && (linha.valorPrevisto || linha.valorOrcado) || 0);
}

function tfOrcamentoEventoResumo(eventoId) {
  var linhas = tfOrcamentoLinhasEvento(eventoId);
  var resumo = {
    receitasOrcadas: 0,
    receitasPrevistas: 0,
    receitasRealizadas: 0,
    despesasOrcadas: 0,
    despesasPrevistas: 0,
    despesasRealizadas: 0,
    linhas: linhas.length
  };
  linhas.forEach(function(linha) {
    var orcado = Number(linha.valorOrcado || 0);
    var previsto = tfOrcamentoPrevistoLinha(linha);
    var realizado = tfOrcamentoRealizadoLinha(linha);
    if (linha.natureza === 'receita') {
      resumo.receitasOrcadas += orcado;
      resumo.receitasPrevistas += previsto;
      resumo.receitasRealizadas += realizado;
    } else {
      resumo.despesasOrcadas += orcado;
      resumo.despesasPrevistas += previsto;
      resumo.despesasRealizadas += realizado;
    }
  });
  resumo.resultadoOrcado = resumo.receitasOrcadas - resumo.despesasOrcadas;
  resumo.resultadoPrevisto = resumo.receitasPrevistas - resumo.despesasPrevistas;
  resumo.resultadoRealizado = resumo.receitasRealizadas - resumo.despesasRealizadas;
  return resumo;
}

function tfStatusEventoLabel(status) {
  if (status === 'planejado') return 'Planejado';
  if (status === 'concluido') return 'Concluido';
  if (status === 'cancelado') return 'Cancelado';
  return 'Em andamento';
}

async function tfEnableEventosModulo() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  if (!tfClienteEhPJ()) return alert('O modulo de eventos/projetos esta disponivel apenas para clientes PJ.');

  var label = formatDescriptionTitleCase((document.getElementById('tf-eventos-enable-label') || {}).value || 'Eventos') || 'Eventos';
  var response = await applyUserScope(
    supabaseClient
      .from('clientes')
      .update({
        eventos_enabled: true,
        eventos_label: label
      })
      .eq('id', activeClient)
  ).select().single();

  if (response.error) {
    console.error('Erro ao habilitar eventos:', response.error);
    alert('Nao foi possivel habilitar eventos. Rode a migracao 20260613_eventos_financeiro_pj.sql no Supabase e tente novamente.');
    return;
  }

  var cliente = tfClienteAtivo();
  if (cliente) {
    cliente.eventosEnabled = true;
    cliente.eventosLabel = response.data.eventos_label || label;
  }
  renderFinanceiro();
}

function tfEventoStatusClass(status) {
  if (status === 'concluido') return 'green';
  if (status === 'cancelado') return 'red';
  if (status === 'planejado') return 'blue';
  return 'yellow';
}

function tfEventoFormHtml(evento) {
  evento = evento || {};
  var idAttr = evento.id ? 'tf-evento-edit' : 'tf-evento-new';
  return '<div class="tf-event-form">'
    + '<div class="form-row">'
      + '<div class="form-group"><label>Nome do ' + esc(tfEventosLabel().toLowerCase()) + '</label><input type="text" id="' + idAttr + '-nome" value="' + esc(evento.nome || '') + '" placeholder="Ex.: Expo Museu da Republica"/></div>'
      + '<div class="form-group" style="max-width:170px"><label>Status</label><select id="' + idAttr + '-status">'
        + '<option value="planejado"' + (evento.status === 'planejado' ? ' selected' : '') + '>Planejado</option>'
        + '<option value="em_andamento"' + ((!evento.status || evento.status === 'em_andamento') ? ' selected' : '') + '>Em andamento</option>'
        + '<option value="concluido"' + (evento.status === 'concluido' ? ' selected' : '') + '>Concluido</option>'
        + '<option value="cancelado"' + (evento.status === 'cancelado' ? ' selected' : '') + '>Cancelado</option>'
      + '</select></div>'
      + '<div class="form-group" style="max-width:150px"><label>Ativo</label><select id="' + idAttr + '-ativo"><option value="true"' + (evento.ativo !== false ? ' selected' : '') + '>Sim</option><option value="false"' + (evento.ativo === false ? ' selected' : '') + '>Nao</option></select></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group" style="max-width:170px"><label>Inicio</label><input type="text" id="' + idAttr + '-inicio" class="flex-date-input" value="' + esc(evento.dataInicio ? formatDate(evento.dataInicio) : '') + '" placeholder="dd/mm/aaaa"/></div>'
      + '<div class="form-group" style="max-width:170px"><label>Fim</label><input type="text" id="' + idAttr + '-fim" class="flex-date-input" value="' + esc(evento.dataFim ? formatDate(evento.dataFim) : '') + '" placeholder="dd/mm/aaaa"/></div>'
      + '<div class="form-group" style="max-width:190px"><label>Orcamento previsto</label><input type="text" id="' + idAttr + '-orcamento" class="money-input" value="' + esc(Number(evento.orcamentoPrevisto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '"/></div>'
    + '</div>'
    + '<div class="form-row"><div class="form-group"><label>Observacao</label><input type="text" id="' + idAttr + '-obs" value="' + esc(evento.observacao || '') + '" placeholder="Detalhes internos"/></div></div>'
    + '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">'
      + (evento.id ? '<button type="button" class="btn-sm red" onclick="tfCancelEventoEdit()">Cancelar</button>' : '')
      + '<button type="button" class="btn-add" style="margin-top:0" onclick="' + (evento.id ? 'tfSaveEvento(\'' + evento.id + '\')' : 'tfAddEvento()') + '">' + (evento.id ? 'Salvar ' : 'Cadastrar ') + esc(tfEventosLabel().slice(0, -1) || 'evento') + '</button>'
    + '</div>'
    + '</div>';
}

function tfReadEventoPayload(prefix) {
  var nome = formatDescriptionTitleCase((document.getElementById(prefix + '-nome') || {}).value || '');
  var status = ((document.getElementById(prefix + '-status') || {}).value || 'em_andamento').trim();
  var ativo = ((document.getElementById(prefix + '-ativo') || {}).value || 'true') === 'true';
  var inicioEl = document.getElementById(prefix + '-inicio');
  var fimEl = document.getElementById(prefix + '-fim');
  var dataInicio = inicioEl ? readFlexibleDateInput(inicioEl) : '';
  var dataFim = fimEl ? readFlexibleDateInput(fimEl) : '';
  if (inicioEl && inicioEl.value.trim() && !dataInicio) return alert('Informe uma data valida para inicio.'), null;
  if (fimEl && fimEl.value.trim() && !dataFim) return alert('Informe uma data valida para fim.'), null;
  return {
    nome: nome,
    status: status,
    ativo: ativo,
    data_inicio: dataInicio || null,
    data_fim: dataFim || null,
    orcamento_previsto: parseMoney(document.getElementById(prefix + '-orcamento')) || 0,
    observacao: ((document.getElementById(prefix + '-obs') || {}).value || '').trim() || null
  };
}

async function tfAddEvento() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  if (!tfEventosEnabled()) return alert('Habilite o modulo de eventos no cadastro do cliente PJ.');
  var payload = tfReadEventoPayload('tf-evento-new');
  if (!payload) return;
  if (!payload.nome) return alert('Informe o nome do ' + tfEventosLabel().toLowerCase() + '.');

  var response = await supabaseClient
    .from('eventos_cliente')
    .insert([Object.assign({
      cliente_id: activeClient
    }, payload, getUserScopePayload())])
    .select()
    .single();

  if (response.error) {
    console.error('Erro ao cadastrar evento:', response.error);
    alert('Nao foi possivel cadastrar o evento. Verifique se a migracao 20260613_eventos_financeiro_pj.sql foi aplicada.');
    return;
  }

  if (typeof notifyWorkspaceDataChanged === 'function') notifyWorkspaceDataChanged(activeClient, 'evento_criado');
  await loadData();
  renderFinanceiro();
}

function tfStartEventoEdit(id) {
  _tfEventoEditId = id;
  renderFinanceiro();
}

function tfCancelEventoEdit() {
  _tfEventoEditId = null;
  renderFinanceiro();
}

async function tfSaveEvento(id) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var payload = tfReadEventoPayload('tf-evento-edit');
  if (!payload) return;
  if (!payload.nome) return alert('Informe o nome do ' + tfEventosLabel().toLowerCase() + '.');

  var response = await applyUserScope(
    supabaseClient
      .from('eventos_cliente')
      .update(payload)
      .eq('id', id)
  ).select().single();

  if (response.error) {
    console.error('Erro ao salvar evento:', response.error);
    alert('Nao foi possivel salvar o evento.');
    return;
  }

  _tfEventoEditId = null;
  await loadData();
  renderFinanceiro();
}

async function tfDeleteEvento(id) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var usado = tfTitulosCliente().some(function(item) { return item.eventoId === id; });
  if (usado) return alert('Este evento esta vinculado a titulos financeiros. Remova o vinculo antes de excluir.');
  var temOrcamento = tfOrcamentoLinhasEvento(id).length > 0;
  if (temOrcamento) return alert('Este evento tem linhas de orcamento. Exclua o orcamento antes de remover o evento.');
  var ok = await appConfirm('Excluir este evento/projeto?', { title: 'Excluir evento', confirmText: 'Excluir' });
  if (!ok) return;

  var response = await applyUserScope(
    supabaseClient
      .from('eventos_cliente')
      .delete()
      .eq('id', id)
  );

  if (response.error) {
    console.error('Erro ao excluir evento:', response.error);
    alert('Nao foi possivel excluir o evento.');
    return;
  }

  if (typeof notifyWorkspaceDataChanged === 'function') notifyWorkspaceDataChanged(activeClient, 'evento_excluido');
  await loadData();
  renderFinanceiro();
}

function tfReadOrcamentoLinhaPayload(prefix) {
  var eventoId = ((document.getElementById(prefix + '-evento') || {}).value || '').trim();
  var natureza = ((document.getElementById(prefix + '-natureza') || {}).value || 'despesa').trim();
  var categoria = formatDescriptionTitleCase((document.getElementById(prefix + '-categoria') || {}).value || '');
  var descricao = ((document.getElementById(prefix + '-descricao') || {}).value || '').trim();
  var pessoaNome = formatDescriptionTitleCase((document.getElementById(prefix + '-pessoa') || {}).value || '');
  var valorOrcado = parseMoney(document.getElementById(prefix + '-orcado')) || 0;
  var valorPrevisto = parseMoney(document.getElementById(prefix + '-previsto')) || 0;
  var status = ((document.getElementById(prefix + '-status') || {}).value || 'previsto').trim();
  var observacao = ((document.getElementById(prefix + '-obs') || {}).value || '').trim();

  return {
    evento_id: eventoId || null,
    natureza: natureza === 'receita' ? 'receita' : 'despesa',
    categoria: categoria,
    descricao: descricao || null,
    pessoa_nome: pessoaNome || null,
    valor_orcado: Number(valorOrcado || 0),
    valor_previsto: Number(valorPrevisto || 0),
    status: status,
    observacao: observacao || null
  };
}

function tfUpdateLocalOrcamentoLinha(row) {
  var cliente = tfClienteAtivo();
  if (!cliente) return;
  if (!Array.isArray(cliente.orcamentoEventos)) cliente.orcamentoEventos = [];
  var normalized = {
    id: row.id,
    eventoId: row.evento_id || null,
    natureza: row.natureza || 'despesa',
    categoria: row.categoria || '',
    descricao: row.descricao || '',
    pessoaNome: row.pessoa_nome || '',
    valorOrcado: Number(row.valor_orcado || 0),
    valorPrevisto: Number(row.valor_previsto || 0),
    status: row.status || 'previsto',
    observacao: row.observacao || '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    userId: row.user_id || null
  };
  var idx = cliente.orcamentoEventos.findIndex(function(item) { return item.id === row.id; });
  if (idx >= 0) cliente.orcamentoEventos[idx] = Object.assign({}, cliente.orcamentoEventos[idx], normalized);
  else cliente.orcamentoEventos.push(normalized);
}

async function tfAddOrcamentoLinha() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  if (!tfEventosEnabled()) return alert('Habilite o modulo de eventos antes de cadastrar orcamento.');
  var payload = tfReadOrcamentoLinhaPayload('tf-orc-new');
  if (!payload.evento_id) return alert('Selecione o evento.');
  if (!payload.categoria) return alert('Informe a categoria do orcamento.');
  if (payload.valor_orcado <= 0 && payload.valor_previsto <= 0) return alert('Informe ao menos o valor orcado ou previsto.');

  var response = await supabaseClient
    .from('orcamento_eventos_linhas')
    .insert([Object.assign({
      cliente_id: activeClient
    }, payload, getUserScopePayload())])
    .select()
    .single();

  if (response.error) {
    console.error('Erro ao cadastrar linha de orcamento:', response.error);
    alert('Nao foi possivel cadastrar a linha. Rode a migracao 20260615_orcamento_eventos.sql no Supabase.');
    return;
  }

  tfUpdateLocalOrcamentoLinha(response.data);
  _tfOrcamentoEventoId = response.data.evento_id || _tfOrcamentoEventoId;
  renderFinanceiro();
}

function tfStartOrcamentoLinhaEdit(id) {
  _tfOrcamentoLinhaEditId = id;
  renderFinanceiro();
}

function tfCancelOrcamentoLinhaEdit() {
  _tfOrcamentoLinhaEditId = null;
  renderFinanceiro();
}

async function tfSaveOrcamentoLinha(id) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var payload = tfReadOrcamentoLinhaPayload('tf-orc-edit');
  if (!payload.evento_id) return alert('Selecione o evento.');
  if (!payload.categoria) return alert('Informe a categoria do orcamento.');

  var response = await applyUserScope(
    supabaseClient
      .from('orcamento_eventos_linhas')
      .update(payload)
      .eq('id', id)
  ).select().single();

  if (response.error) {
    console.error('Erro ao salvar linha de orcamento:', response.error);
    alert('Nao foi possivel salvar a linha de orcamento.');
    return;
  }

  _tfOrcamentoLinhaEditId = null;
  tfUpdateLocalOrcamentoLinha(response.data);
  renderFinanceiro();
}

async function tfDeleteOrcamentoLinha(id) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  if (tfTitulosPorOrcamentoLinha(id).length) return alert('Esta linha ja tem titulos financeiros vinculados. Remova o vinculo antes de excluir.');
  if (tfOrcamentoRealizacoesLinha(id).length) return alert('Esta linha tem realizacoes conciliadas no Extrato. Desconcilie os valores antes de excluir.');
  var ok = await appConfirm('Excluir esta linha de orcamento?', { title: 'Excluir orcamento', confirmText: 'Excluir' });
  if (!ok) return;

  var response = await applyUserScope(
    supabaseClient
      .from('orcamento_eventos_linhas')
      .delete()
      .eq('id', id)
  );

  if (response.error) {
    console.error('Erro ao excluir linha de orcamento:', response.error);
    alert('Nao foi possivel excluir a linha.');
    return;
  }

  var cliente = tfClienteAtivo();
  if (cliente) cliente.orcamentoEventos = (cliente.orcamentoEventos || []).filter(function(item) { return item.id !== id; });
  renderFinanceiro();
}

async function tfGerarTituloDoOrcamento(id) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var linha = tfOrcamentoLinhaById(id);
  if (!linha) return;
  if (tfTitulosPorOrcamentoLinha(linha.id).length) return alert('Esta linha do orcamento ja tem conta vinculada. Use a conta existente para registrar novas baixas.');
  var naturezaTitulo = linha.natureza === 'receita' ? 'receber' : 'pagar';
  var realizacoesDiretas = tfOrcamentoRealizacoesLinha(linha.id);
  var totalRealizadoDireto = realizacoesDiretas.reduce(function(sum, item) { return sum + Number(item.valor || 0); }, 0);
  var valor = totalRealizadoDireto > 0 ? totalRealizadoDireto : tfOrcamentoPrevistoLinha(linha);
  if (valor <= 0) return alert('Informe um valor previsto antes de gerar o titulo.');
  var pessoa = linha.pessoaNome || (naturezaTitulo === 'receber' ? 'Cliente do evento' : 'Fornecedor do evento');
  var descricao = linha.descricao || linha.categoria || tfNomeEventoById(linha.eventoId);

  var ok = await appConfirm(
    (realizacoesDiretas.length ? 'Confirmar o valor realizado e gerar' : 'Gerar') + ' conta a '
      + (naturezaTitulo === 'receber' ? 'receber' : 'pagar') + ' de ' + fmt(valor) + ' para esta linha?'
      + (realizacoesDiretas.length ? ' As ' + realizacoesDiretas.length + ' conciliacao(oes) do Extrato serao levadas para a conta.' : ''),
    { title: realizacoesDiretas.length ? 'Confirmar realizacao' : 'Gerar titulo financeiro', confirmText: realizacoesDiretas.length ? 'Confirmar e gerar' : 'Gerar' }
  );
  if (!ok) return;

  var insertPayload = Object.assign({
    cliente_id: activeClient,
    natureza: naturezaTitulo,
    pessoa_nome: pessoa,
    descricao: tfDescricaoTitulo(descricao, naturezaTitulo, pessoa),
    categoria: linha.categoria || null,
    centro_custo_id: null,
    evento_id: linha.eventoId || null,
    orcamento_linha_id: linha.id,
    vencimento: null,
    valor_total: valor,
    observacao: linha.observacao || null
  }, getUserScopePayload());

  var response = await supabaseClient
    .from('titulos_financeiros')
    .insert([insertPayload])
    .select()
    .single();

  if (response.error) {
    console.error('Erro ao gerar titulo pelo orcamento:', response.error);
    alert('Nao foi possivel gerar o titulo. Rode a migracao 20260615_orcamento_eventos.sql no Supabase.');
    return;
  }

  if (realizacoesDiretas.length) {
    var baixasPayload = realizacoesDiretas.map(function(item) {
      return Object.assign({
        titulo_id: response.data.id,
        cliente_id: activeClient,
        data_baixa: item.data || new Date().toISOString().slice(0, 10),
        valor: Number(item.valor || 0),
        observacao: item.observacao || ('Realizado diretamente pelo orcamento: ' + (linha.categoria || '')),
        origem: 'extrato',
        extrato_lancamento_id: item.lancamentoId
      }, getUserScopePayload());
    });
    var baixasResponse = await supabaseClient.from('titulos_financeiros_baixas').insert(baixasPayload);
    if (baixasResponse.error) {
      console.error('Erro ao transferir realizacoes para o titulo:', baixasResponse.error);
      await applyUserScope(supabaseClient.from('titulos_financeiros').delete().eq('id', response.data.id));
      alert('A conta nao foi gerada porque nao foi possivel transferir as conciliacoes do orcamento. Nenhuma realizacao foi perdida.');
      return;
    }

    var realizacoesIds = realizacoesDiretas.map(function(item) { return item.id; });
    var remocaoResponse = await applyUserScope(
      supabaseClient.from('orcamento_eventos_realizacoes').delete().in('id', realizacoesIds)
    );
    if (remocaoResponse.error) {
      console.error('Erro ao concluir transferencia das realizacoes:', remocaoResponse.error);
      await applyUserScope(supabaseClient.from('titulos_financeiros').delete().eq('id', response.data.id));
      alert('A conta nao foi gerada porque a transferencia nao pode ser concluida. As conciliacoes continuam no orcamento.');
      return;
    }

    var linhaResponse = await supabaseClient
      .from('orcamento_eventos_linhas')
      .update({ valor_previsto: valor, status: 'realizado' })
      .eq('id', linha.id);
    if (linhaResponse.error) console.warn('Nao foi possivel atualizar o status final da linha:', linhaResponse.error);
  }

  if (typeof notifyWorkspaceDataChanged === 'function') notifyWorkspaceDataChanged(activeClient, 'titulo_orcamento_criado');
  await loadData();
  _tfNatureza = naturezaTitulo;
  _tfEvento = linha.eventoId || '';
  _tfFinanceiroView = 'titulos';
  renderFinanceiro();
}

function tfTitulosVinculaveisOrcamento(linha) {
  if (!linha) return [];
  var naturezaTitulo = linha.natureza === 'receita' ? 'receber' : 'pagar';
  return tfTitulosCliente().filter(function(titulo) {
    if (!titulo || titulo.natureza !== naturezaTitulo) return false;
    if (titulo.eventoId && titulo.eventoId !== linha.eventoId) return false;
    return !titulo.orcamentoLinhaId || titulo.orcamentoLinhaId === linha.id;
  }).sort(function(a, b) {
    return String(b.vencimento || '').localeCompare(String(a.vencimento || ''));
  });
}

function tfOpenVincularTituloOrcamentoModal(linhaId) {
  var linha = tfOrcamentoLinhaById(linhaId);
  if (!linha) return;
  var titulos = tfTitulosVinculaveisOrcamento(linha);
  var jaVinculados = tfTitulosPorOrcamentoLinha(linha.id);
  document.getElementById('modalTitle').textContent = 'Vincular conta ao orcamento';
  document.getElementById('modalBody').innerHTML =
    '<div class="settings-card-badges" style="margin:0 0 14px 0">'
      + '<span class="settings-card-badge">' + esc(tfNaturezaOrcamentoLabel(linha.natureza)) + '</span>'
      + '<span class="settings-card-badge subtle">' + esc(tfNomeEventoById(linha.eventoId) || '-') + '</span>'
      + '<span class="settings-card-badge subtle">' + esc(linha.categoria || '-') + '</span>'
      + '<span class="settings-card-badge subtle">' + jaVinculados.length + ' vinculada(s)</span>'
    + '</div>'
    + (titulos.length
      ? '<div class="tf-link-title-list">' + titulos.map(function(titulo) {
          var vinculado = titulo.orcamentoLinhaId === linha.id;
          return '<label class="tf-link-title-item">'
            + '<input type="checkbox" value="' + esc(titulo.id) + '"' + (vinculado ? ' checked' : '') + '/>'
            + '<span><strong>' + esc(titulo.pessoaNome || '-') + '</strong><small>' + esc([titulo.descricao, formatDate(titulo.vencimento)].filter(Boolean).join(' - ')) + '</small></span>'
            + '<b>' + fmt(titulo.valorTotal || 0) + '</b>'
            + '</label>';
        }).join('') + '</div>'
      : '<div class="empty-state" style="padding:22px">Nenhuma conta compativel encontrada neste evento.</div>')
    + '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:14px">'
      + '<button class="btn-sm red" type="button" onclick="closeModal()">Fechar</button>'
      + (titulos.length ? '<button class="btn-add" type="button" style="margin-top:0" onclick="tfSalvarVinculosOrcamento(\'' + linha.id + '\')">Salvar vinculos</button>' : '')
    + '</div>';
  document.getElementById('modalOverlay').classList.add('open');
  document.addEventListener('keydown', handleMainModalEscape);
}

async function tfSalvarVinculosOrcamento(linhaId) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var linha = tfOrcamentoLinhaById(linhaId);
  if (!linha) return;
  var selecionados = Array.from(document.querySelectorAll('.tf-link-title-item input[type="checkbox"]:checked')).map(function(input) {
    return input.value;
  }).filter(Boolean);
  var candidatos = tfTitulosVinculaveisOrcamento(linha);
  var candidatoIds = candidatos.map(function(item) { return item.id; });
  var atuais = candidatos.filter(function(item) { return item.orcamentoLinhaId === linha.id; }).map(function(item) { return item.id; });
  var paraVincular = selecionados.filter(function(id) { return candidatoIds.includes(id) && !atuais.includes(id); });
  var paraDesvincular = atuais.filter(function(id) { return !selecionados.includes(id); });

  if (paraVincular.length) {
    var vincularRes = await applyUserScope(
      supabaseClient
        .from('titulos_financeiros')
        .update({ orcamento_linha_id: linha.id, evento_id: linha.eventoId || null })
        .in('id', paraVincular)
    );
    if (vincularRes.error) {
      console.error('Erro ao vincular titulos ao orcamento:', vincularRes.error);
      alert('Nao foi possivel vincular as contas ao orcamento.');
      return;
    }
  }

  if (paraDesvincular.length) {
    var desvincularRes = await applyUserScope(
      supabaseClient
        .from('titulos_financeiros')
        .update({ orcamento_linha_id: null })
        .in('id', paraDesvincular)
    );
    if (desvincularRes.error) {
      console.error('Erro ao desvincular titulos do orcamento:', desvincularRes.error);
      alert('Nao foi possivel remover alguns vinculos.');
      return;
    }
  }

  if (typeof notifyWorkspaceDataChanged === 'function') notifyWorkspaceDataChanged(activeClient, 'vinculo_orcamento');
  await loadData();
  closeModal();
  renderFinanceiro();
}

function tfEventoIndicadores(eventoId) {
  var titulos = tfTitulosCliente().filter(function(item) { return item.eventoId === eventoId; });
  var receber = titulos.filter(function(item) { return item.natureza === 'receber'; });
  var pagar = titulos.filter(function(item) { return item.natureza === 'pagar'; });
  var orcamento = tfOrcamentoEventoResumo(eventoId);
  var receitaPrevistaTitulos = receber.reduce(function(s, item) { return s + Number(item.valorTotal || 0); }, 0);
  var custoPrevistoTitulos = pagar.reduce(function(s, item) { return s + Number(item.valorTotal || 0); }, 0);
  var receitaPrevista = Math.max(orcamento.receitasPrevistas, receitaPrevistaTitulos);
  var custoPrevisto = Math.max(orcamento.despesasPrevistas, custoPrevistoTitulos);
  var recebido = receber.reduce(function(s, item) { return s + tfTotalBaixado(item); }, 0);
  var pago = pagar.reduce(function(s, item) { return s + tfTotalBaixado(item); }, 0);
  var emAbertoReceber = receber.reduce(function(s, item) { return s + tfSaldo(item); }, 0);
  var emAbertoPagar = pagar.reduce(function(s, item) { return s + tfSaldo(item); }, 0);
  return {
    titulos: titulos,
    receitaPrevista: receitaPrevista,
    custoPrevisto: custoPrevisto,
    resultadoPrevisto: receitaPrevista - custoPrevisto,
    recebido: recebido,
    pago: pago,
    resultadoRealizado: recebido - pago,
    emAbertoReceber: emAbertoReceber,
    emAbertoPagar: emAbertoPagar,
    orcamento: orcamento
  };
}

function tfEventoCustoCategorias(eventoId) {
  var map = {};
  tfTitulosCliente().filter(function(item) {
    return item.eventoId === eventoId && item.natureza === 'pagar';
  }).forEach(function(item) {
    var key = item.centroCusto || tfNomeCentroCustoById(item.centroCustoId) || 'Sem centro';
    map[key] = (map[key] || 0) + Number(item.valorTotal || 0);
  });
  return Object.entries(map).map(function(entry) {
    return { nome: entry[0], valor: entry[1] };
  }).sort(function(a, b) { return b.valor - a.valor; });
}

function tfOrcamentoFormHtml(linha) {
  linha = linha || {};
  var prefix = linha.id ? 'tf-orc-edit' : 'tf-orc-new';
  var eventoSelecionado = linha.eventoId || _tfOrcamentoEventoId || (tfEventosCliente(false)[0] || {}).id || '';
  return '<div class="tf-budget-form">'
    + '<div class="form-row">'
      + '<div class="form-group"><label>' + esc(tfEventosLabel().slice(0, -1) || 'Evento') + '</label><select id="' + prefix + '-evento">' + tfEventosOptionsHtml(eventoSelecionado, 'Selecione') + '</select></div>'
      + '<div class="form-group" style="max-width:150px"><label>Tipo</label><select id="' + prefix + '-natureza"><option value="receita"' + (linha.natureza === 'receita' ? ' selected' : '') + '>Receita</option><option value="despesa"' + (linha.natureza !== 'receita' ? ' selected' : '') + '>Despesa</option></select></div>'
      + '<div class="form-group"><label>Categoria</label><input type="text" id="' + prefix + '-categoria" value="' + esc(linha.categoria || '') + '" placeholder="Ex.: Gerador, Patrocinio, Bilheteria"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group"><label>Fornecedor / pagador</label><input type="text" id="' + prefix + '-pessoa" value="' + esc(linha.pessoaNome || '') + '" placeholder="Opcional"/></div>'
      + '<div class="form-group"><label>Descricao</label><input type="text" id="' + prefix + '-descricao" value="' + esc(linha.descricao || '') + '" placeholder="Opcional"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group" style="max-width:170px"><label>Valor orcado</label><input type="text" id="' + prefix + '-orcado" class="money-input" value="' + esc(Number(linha.valorOrcado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '"/></div>'
      + '<div class="form-group" style="max-width:170px"><label>Valor previsto</label><input type="text" id="' + prefix + '-previsto" class="money-input" value="' + esc(Number(linha.valorPrevisto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '"/></div>'
      + '<div class="form-group" style="max-width:170px"><label>Status</label><select id="' + prefix + '-status"><option value="previsto"' + ((!linha.status || linha.status === 'previsto') ? ' selected' : '') + '>Previsto</option><option value="contratado"' + (linha.status === 'contratado' ? ' selected' : '') + '>Contratado</option><option value="realizado"' + (linha.status === 'realizado' ? ' selected' : '') + '>Realizado</option><option value="cancelado"' + (linha.status === 'cancelado' ? ' selected' : '') + '>Cancelado</option></select></div>'
    + '</div>'
    + '<div class="form-row"><div class="form-group"><label>Observacao</label><input type="text" id="' + prefix + '-obs" value="' + esc(linha.observacao || '') + '" placeholder="Detalhes internos"/></div></div>'
    + '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">'
      + (linha.id ? '<button type="button" class="btn-sm red" onclick="tfCancelOrcamentoLinhaEdit()">Cancelar</button>' : '')
      + '<button type="button" class="btn-add" style="margin-top:0" onclick="' + (linha.id ? 'tfSaveOrcamentoLinha(\'' + linha.id + '\')' : 'tfAddOrcamentoLinha()') + '">' + (linha.id ? 'Salvar linha' : 'Adicionar linha') + '</button>'
    + '</div>'
    + '</div>';
}

function tfOrcamentoEventoResumoCardsHtml(eventoId) {
  var resumo = tfOrcamentoEventoResumo(eventoId);
  var diffReceita = resumo.receitasRealizadas - resumo.receitasOrcadas;
  var diffDespesa = resumo.despesasOrcadas - resumo.despesasRealizadas;
  return '<div class="tf-budget-summary">'
    + '<div><span>Receita orcada</span><strong class="green">' + fmt(resumo.receitasOrcadas) + '</strong></div>'
    + '<div><span>Receita realizada</span><strong class="green">' + fmt(resumo.receitasRealizadas) + '</strong><small class="' + (diffReceita >= 0 ? 'green' : 'red') + '">' + fmt(diffReceita) + '</small></div>'
    + '<div><span>Custo orcado</span><strong class="red">' + fmt(resumo.despesasOrcadas) + '</strong></div>'
    + '<div><span>Custo realizado</span><strong class="red">' + fmt(resumo.despesasRealizadas) + '</strong><small class="' + (diffDespesa >= 0 ? 'green' : 'red') + '">' + fmt(diffDespesa) + '</small></div>'
    + '<div><span>Resultado previsto</span><strong class="' + (resumo.resultadoPrevisto >= 0 ? 'green' : 'red') + '">' + fmt(resumo.resultadoPrevisto) + '</strong></div>'
    + '<div><span>Resultado realizado</span><strong class="' + (resumo.resultadoRealizado >= 0 ? 'green' : 'red') + '">' + fmt(resumo.resultadoRealizado) + '</strong></div>'
    + '</div>';
}

function tfOrcamentoLinhasHtml(eventoId) {
  var linhas = tfOrcamentoLinhasEvento(eventoId).slice().sort(function(a, b) {
    if (a.natureza !== b.natureza) return a.natureza === 'receita' ? -1 : 1;
    return String(a.categoria || '').localeCompare(String(b.categoria || ''), 'pt-BR', { sensitivity: 'base' });
  });
  if (!linhas.length) return '<div class="empty-state" style="padding:22px">Nenhuma linha de orcamento cadastrada para este evento.</div>';
  return '<div class="tf-budget-table">'
    + linhas.map(function(linha) {
        var previsto = tfOrcamentoPrevistoLinha(linha);
        var realizado = tfOrcamentoRealizadoLinha(linha);
        var diff = linha.natureza === 'receita' ? realizado - Number(linha.valorOrcado || 0) : Number(linha.valorOrcado || 0) - realizado;
        var titulos = tfTitulosPorOrcamentoLinha(linha.id);
        var realizacoesDiretas = tfOrcamentoRealizacoesLinha(linha.id);
        var editando = _tfOrcamentoLinhaEditId === linha.id;
        var totalContas = titulos.reduce(function(sum, titulo) { return sum + Number(titulo.valorTotal || 0); }, 0);
        var baixadoContas = titulos.reduce(function(sum, titulo) { return sum + tfTotalBaixado(titulo); }, 0);
        var saldoContas = titulos.reduce(function(sum, titulo) { return sum + tfSaldo(titulo); }, 0);
        var baseRealizacao = Math.max(0, previsto || Number(linha.valorOrcado || 0));
        var percentualRealizado = baseRealizacao > 0 ? Math.min(100, Math.round((realizado / baseRealizacao) * 100)) : 0;
        var pendente = Math.max(0, baseRealizacao - realizado);
        var descricaoCompleta = [linha.pessoaNome, linha.descricao].filter(Boolean).join(' - ');
        var vinculoResumo = titulos.length
          ? titulos.length + ' conta(s) - Total ' + fmt(totalContas) + ' - Baixado ' + fmt(baixadoContas) + ' - Saldo ' + fmt(saldoContas)
          : (realizacoesDiretas.length
            ? realizacoesDiretas.length + ' lancamento(s) do Extrato aguardando confirmacao'
            : 'Nenhuma conta vinculada');
        return (editando ? '<div class="tf-budget-edit-row">' + tfOrcamentoFormHtml(linha) + '</div>' : '')
          + '<article class="tf-budget-item">'
            + '<div class="tf-budget-item-head">'
              + '<div class="tf-budget-item-main">'
                + '<div class="tf-budget-badges"><span class="tf-budget-type ' + (linha.natureza === 'receita' ? 'green' : 'red') + '">' + esc(tfNaturezaOrcamentoLabel(linha.natureza)) + '</span><span class="tf-budget-status">' + esc(tfOrcamentoStatusLabel(linha.status)) + '</span></div>'
                + '<strong>' + esc(linha.categoria || '-') + '</strong>'
                + (descricaoCompleta ? '<p>' + esc(descricaoCompleta) + '</p>' : '')
              + '</div>'
              + '<div class="tf-budget-link-summary"><span>' + esc(vinculoResumo) + '</span></div>'
            + '</div>'
            + '<div class="tf-budget-values">'
              + '<div><span>Orcado</span><strong>' + fmt(linha.valorOrcado || 0) + '</strong></div>'
              + '<div><span>Previsto</span><strong>' + fmt(previsto) + '</strong></div>'
              + '<div><span>Realizado</span><strong class="' + (linha.natureza === 'receita' ? 'green' : 'red') + '">' + fmt(realizado) + '</strong></div>'
              + '<div><span>Diferenca</span><strong class="' + (diff >= 0 ? 'green' : 'red') + '">' + fmt(diff) + '</strong></div>'
            + '</div>'
            + '<div class="tf-budget-progress">'
              + '<div><span>Realizado ' + percentualRealizado + '%</span><strong>' + (pendente > 0 ? (fmt(pendente) + (linha.natureza === 'receita' ? ' a receber' : ' a pagar')) : 'Concluido') + '</strong></div>'
              + '<i><b style="width:' + percentualRealizado + '%"></b></i>'
            + '</div>'
            + '<div class="tf-budget-actions">'
              + (titulos.length ? '<button class="btn-sm" type="button" onclick="_tfFinanceiroView=\'titulos\';_tfEvento=\'' + esc(linha.eventoId || '') + '\';renderFinanceiro()">Ver contas</button>' : '<button class="btn-sm" type="button" onclick="tfGerarTituloDoOrcamento(\'' + linha.id + '\')">' + (realizacoesDiretas.length ? 'Confirmar e gerar conta' : 'Gerar conta') + '</button>')
              + '<button class="btn-sm" type="button" onclick="tfOpenVincularTituloOrcamentoModal(\'' + linha.id + '\')">Vincular conta</button>'
              + '<button class="btn-sm" type="button" onclick="tfStartOrcamentoLinhaEdit(\'' + linha.id + '\')">Editar</button>'
              + '<button class="btn-icon danger" type="button" onclick="tfDeleteOrcamentoLinha(\'' + linha.id + '\')" title="Excluir">&#128465;</button>'
            + '</div>'
          + '</article>';
      }).join('')
    + '</div>';
}

function tfOrcamentoEventosHtml() {
  var eventos = tfEventosCliente(true);
  if (!eventos.length) return '<div class="empty-state" style="padding:22px">Cadastre um evento antes de criar o orcamento.</div>';
  if (!_tfOrcamentoEventoId || !eventos.some(function(ev) { return ev.id === _tfOrcamentoEventoId; })) {
    _tfOrcamentoEventoId = (eventos.find(function(ev) { return ev.ativo !== false; }) || eventos[0]).id;
  }
  var eventoAtual = eventos.find(function(ev) { return ev.id === _tfOrcamentoEventoId; }) || eventos[0];
  return '<div class="tf-budget-shell">'
    + '<div class="tf-section-head">'
      + '<div><h3>Orcamento e resultado</h3><p class="cartao-helper-text">Planeje receitas e custos sem criar contas ate o valor ficar real.</p></div>'
      + '<div class="form-group" style="max-width:320px;margin:0"><label>' + esc(tfEventosLabel()) + '</label><select onchange="_tfOrcamentoEventoId=this.value;_tfOrcamentoLinhaEditId=null;renderFinanceiro()">' + eventos.map(function(ev) { return '<option value="' + esc(ev.id) + '"' + (ev.id === eventoAtual.id ? ' selected' : '') + '>' + esc(ev.nome) + (ev.ativo === false ? ' (inativo)' : '') + '</option>'; }).join('') + '</select></div>'
    + '</div>'
    + tfOrcamentoEventoResumoCardsHtml(eventoAtual.id)
    + '<div class="tf-budget-layout">'
      + '<div><h4 class="tf-event-subtitle">Nova linha</h4>' + tfOrcamentoFormHtml(null) + '</div>'
      + '<div><h4 class="tf-event-subtitle">Linhas do evento</h4>' + tfOrcamentoLinhasHtml(eventoAtual.id) + '</div>'
    + '</div>'
    + '</div>';
}

function tfEventosResumoHtml() {
  if (!tfEventosEnabled()) {
    return '<div class="settings-section-card" style="margin:0">'
      + '<div class="settings-card-head"><div><h5>Modulo de eventos/projetos desabilitado</h5><p>Ative para separar receitas, custos, recebimentos e pagamentos por evento neste cliente PJ.</p></div></div>'
      + '<div class="form-row">'
        + '<div class="form-group"><label>Nome do modulo</label><input type="text" id="tf-eventos-enable-label" value="' + esc(tfEventosLabel()) + '" placeholder="Eventos, Projetos, Obras..."/></div>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:10px">'
        + '<button type="button" class="btn-add" style="margin-top:0" onclick="tfEnableEventosModulo()">Habilitar eventos</button>'
      + '</div>'
      + '</div>';
  }

  var eventos = tfEventosCliente(true);
  var editando = eventos.find(function(item) { return item.id === _tfEventoEditId; });
  var linhas = eventos.map(function(evento) {
    var ind = tfEventoIndicadores(evento.id);
    var margem = ind.receitaPrevista > 0 ? (ind.resultadoPrevisto / ind.receitaPrevista) * 100 : 0;
    var maiorCusto = tfEventoCustoCategorias(evento.id)[0];
    return '<div class="tf-event-card">'
      + '<div class="tf-event-head"><div><strong>' + esc(evento.nome) + '</strong><span>' + esc(formatDate(evento.dataInicio) || '-') + (evento.dataFim ? ' ate ' + esc(formatDate(evento.dataFim)) : '') + '</span></div><span class="tf-event-status ' + tfEventoStatusClass(evento.status) + '">' + esc(tfStatusEventoLabel(evento.status)) + '</span></div>'
      + '<div class="tf-event-metrics">'
        + '<div><span>Receita</span><strong class="green">' + fmt(ind.receitaPrevista) + '</strong></div>'
        + '<div><span>Custo</span><strong class="red">' + fmt(ind.custoPrevisto) + '</strong></div>'
        + '<div><span>Resultado</span><strong class="' + (ind.resultadoPrevisto >= 0 ? 'green' : 'red') + '">' + fmt(ind.resultadoPrevisto) + '</strong></div>'
        + '<div><span>Realizado</span><strong class="' + (ind.resultadoRealizado >= 0 ? 'green' : 'red') + '">' + fmt(ind.resultadoRealizado) + '</strong></div>'
        + '<div><span>Margem</span><strong>' + margem.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%</strong></div>'
      + '</div>'
      + '<div class="tf-event-meta"><span>Aberto a receber: ' + fmt(ind.emAbertoReceber) + '</span><span>Aberto a pagar: ' + fmt(ind.emAbertoPagar) + '</span><span>Maior custo: ' + esc(maiorCusto ? maiorCusto.nome : '-') + (maiorCusto ? ' (' + fmt(maiorCusto.valor) + ')' : '') + '</span></div>'
      + '<div class="tf-event-actions"><button class="btn-sm" onclick="tfStartEventoEdit(\'' + evento.id + '\')">Editar</button><button class="btn-sm" onclick="_tfEvento=\'' + evento.id + '\';_tfFinanceiroView=\'titulos\';renderFinanceiro()">Ver titulos</button><button class="btn-icon danger" onclick="tfDeleteEvento(\'' + evento.id + '\')" title="Excluir evento">&#128465;</button></div>'
      + '</div>';
  }).join('');

  var ranking = eventos.map(function(evento) {
    var ind = tfEventoIndicadores(evento.id);
    return Object.assign({ evento: evento }, ind);
  }).sort(function(a, b) { return b.resultadoPrevisto - a.resultadoPrevisto; });
  var rankingHtml = ranking.length
    ? '<div class="tf-event-ranking">' + ranking.map(function(item) {
        return '<div><span>' + esc(item.evento.nome) + '</span><strong class="' + (item.resultadoPrevisto >= 0 ? 'green' : 'red') + '">' + fmt(item.resultadoPrevisto) + '</strong></div>';
      }).join('') + '</div>'
    : '<div class="empty-state" style="padding:18px">Nenhum evento cadastrado ainda.</div>';

  return '<div class="tf-event-panel-grid">'
    + '<div>'
      + '<h4 class="tf-event-subtitle">Cadastrar ' + esc(tfEventosLabel().toLowerCase()) + '</h4>'
      + (editando ? tfEventoFormHtml(editando) : tfEventoFormHtml(null))
    + '</div>'
    + '<div>'
      + '<h4 class="tf-event-subtitle">Mais rentaveis</h4>'
      + rankingHtml
    + '</div>'
    + '</div>'
    + '<div class="tf-event-list">' + (linhas || '<div class="empty-state" style="padding:22px">Cadastre o primeiro ' + esc(tfEventosLabel().toLowerCase()) + ' para comecar a comparar.</div>') + '</div>'
    + tfOrcamentoEventosHtml();
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
  var centroCustoId = _tfNatureza === 'pagar' ? (((document.getElementById(prefix + '-centro-custo') || {}).value || '').trim() || null) : null;
  var eventoId = ((document.getElementById(prefix + '-evento') || {}).value || '').trim() || null;
  var orcamentoLinhaId = ((document.getElementById(prefix + '-orcamento-linha') || {}).value || '').trim() || null;
  var orcamentoLinha = tfOrcamentoLinhaById(orcamentoLinhaId);
  if (orcamentoLinha) eventoId = orcamentoLinha.eventoId || eventoId;
  var vencimento = tfNormalizeDateFieldValue(prefix + '-vencimento', 'vencimento');
  var valor = tfParseAmountFromInput(prefix + '-valor');
  var observacao = (document.getElementById(prefix + '-observacao') || {}).value || '';

  if (vencimento === null) return null;

  return {
    natureza: prefix === 'tf-pagar' ? 'pagar' : 'receber',
    pessoaNome: formatDescriptionTitleCase(pessoa),
    descricao: tfDescricaoTitulo(descricao, prefix === 'tf-pagar' ? 'pagar' : 'receber', formatDescriptionTitleCase(pessoa)),
    categoria: null,
    centroCustoId: centroCustoId,
    eventoId: eventoId,
    orcamentoLinhaId: orcamentoLinhaId,
    vencimento: vencimento || null,
    valorTotal: Number(valor || 0),
    observacao: observacao.trim()
  };
}

function tfResetForm(prefix) {
  ['pessoa', 'descricao', 'centro-custo', 'evento', 'orcamento-linha', 'vencimento', 'observacao'].forEach(function(suffix) {
    var el = document.getElementById(prefix + '-' + suffix);
    if (el) el.value = '';
    if (el && suffix === 'vencimento') delete el.dataset.isoDate;
  });
  var valorEl = document.getElementById(prefix + '-valor');
  if (valorEl) {
    valorEl.value = '0,00';
    valorEl.dataset.cents = '0';
  }
}

async function tfAddTitulo() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e está disponível apenas para visualização.');
  var payload = tfReadFormPayload(tfFormPrefix());
  if (!payload) return;
  if (!payload.pessoaNome || payload.valorTotal <= 0) {
    alert('Preencha pessoa e valor do título.');
    return;
  }

  var insertPayload = Object.assign({
    cliente_id: activeClient,
    natureza: payload.natureza,
    pessoa_nome: payload.pessoaNome,
    descricao: payload.descricao,
    categoria: payload.categoria || null,
    centro_custo_id: payload.natureza === 'pagar' ? (payload.centroCustoId || null) : null,
    vencimento: payload.vencimento,
    valor_total: payload.valorTotal,
    observacao: payload.observacao || null
  }, getUserScopePayload());
  if (tfEventosEnabled() || payload.eventoId) insertPayload.evento_id = payload.eventoId || null;
  if (payload.orcamentoLinhaId) insertPayload.orcamento_linha_id = payload.orcamentoLinhaId;

  var response = await supabaseClient
    .from('titulos_financeiros')
    .insert([insertPayload])
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    alert('Nao foi possivel cadastrar o titulo. Verifique se a migracao 20260520_titulos_financeiros_pj.sql ja foi aplicada no Supabase.');
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
    eventoId: response.data.evento_id || null,
    evento: tfNomeEventoById(response.data.evento_id || null),
    orcamentoLinhaId: response.data.orcamento_linha_id || null,
    vencimento: response.data.vencimento || null,
    valorTotal: Number(response.data.valor_total || 0),
    observacao: response.data.observacao || '',
    createdAt: response.data.created_at || null,
    updatedAt: response.data.updated_at || null,
    baixas: [],
    userId: response.data.user_id || null
  });

  tfResetForm(tfFormPrefix());
  if (typeof notifyWorkspaceDataChanged === 'function') notifyWorkspaceDataChanged(activeClient, 'titulo_criado');
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
    eventoId: row.evento_id || null,
    evento: tfNomeEventoById(row.evento_id || null),
    orcamentoLinhaId: row.orcamento_linha_id || null,
    vencimento: row.vencimento || null,
    valorTotal: Number(row.valor_total || 0),
    observacao: row.observacao || '',
    updatedAt: row.updated_at || null
  });
}

function tfContasCliente() {
  var cliente = tfClienteAtivo();
  return cliente && Array.isArray(cliente.contas) ? cliente.contas : [];
}

function tfNomeConta(conta) {
  if (!conta) return 'Sem movimentar extrato';
  if (typeof nomeContaCliente === 'function') return nomeContaCliente(conta);
  return String(conta.banco || 'Conta');
}

function tfNomeContaPorId(contaId) {
  var conta = tfContasCliente().find(function(item) { return item.id === contaId; });
  return tfNomeConta(conta);
}

function tfContaOptionsHtml(selectedId) {
  var atual = String(selectedId || '');
  var contas = tfContasCliente();
  if (!contas.length) return '<option value="">Sem conta cadastrada</option>';
  return '<option value="">Nao movimentar extrato</option>' + contas.map(function(conta) {
    return '<option value="' + esc(conta.id) + '"' + (conta.id === atual ? ' selected' : '') + '>' + esc(tfNomeConta(conta)) + '</option>';
  }).join('');
}

function tfStatusResumoLabel(item) {
  var saldo = tfSaldo(item);
  if (saldo <= 0) return 'Quitado';
  return tfStatusLabel(tfStatusOf(item));
}

function tfTituloCardHtml(item) {
  var status = tfStatusOf(item);
  var saldo = tfSaldo(item);
  var baixado = tfTotalBaixado(item);
  var total = Number(item.valorTotal || 0);
  var pct = total > 0 ? Math.min(100, Math.round((baixado / total) * 100)) : 0;
  var centro = item.centroCusto || tfNomeCentroCustoById(item.centroCustoId || null);
  var evento = item.evento || tfNomeEventoById(item.eventoId || null);
  var linhaOrcamento = tfOrcamentoLinhaById(item.orcamentoLinhaId || '');
  var bulk = tfEventosEnabled()
    ? '<label class="tf-title-select" title="Selecionar para alterar evento em lote"><input type="checkbox" value="' + esc(item.id) + '"' + (_tfBulkSelected.has(item.id) ? ' checked' : '') + ' onchange="tfToggleBulkTitulo(\'' + item.id + '\', this.checked)"/><span></span></label>'
    : '';
  return '<article class="tf-title-card ' + esc(status) + (bulk ? ' bulk-enabled' : '') + '">'
    + bulk
    + '<div class="tf-title-main">'
      + '<div class="tf-title-topline">'
        + '<strong>' + esc(item.pessoaNome || '-') + '</strong>'
        + '<span class="tf-status-badge ' + esc(status) + '">' + esc(tfStatusResumoLabel(item)) + '</span>'
      + '</div>'
      + '<div class="tf-title-desc">' + esc(item.descricao || '-') + '</div>'
      + '<div class="tf-title-meta">'
        + '<span>Vence ' + esc(formatDate(item.vencimento)) + '</span>'
        + (tfEventosEnabled() ? (evento ? '<span>' + esc(evento) + '</span>' : '<span>Sem ' + esc(tfEventosLabel().toLowerCase()) + '</span>') : '')
        + (linhaOrcamento ? '<span>Orcamento: ' + esc(linhaOrcamento.categoria || '-') + '</span>' : '')
        + (item.natureza === 'pagar' ? (centro ? '<span>' + esc(centro) + '</span>' : '<span>Sem centro</span>') : '')
        + (item.observacao ? '<span>' + esc(item.observacao) + '</span>' : '')
      + '</div>'
    + '</div>'
    + '<div class="tf-title-money">'
      + '<div><span>Total</span><strong>' + fmt(total) + '</strong></div>'
      + '<div><span>Baixado</span><strong class="green">' + fmt(baixado) + '</strong></div>'
      + '<div><span>Saldo</span><strong class="' + (saldo > 0 ? 'yellow' : 'green') + '">' + fmt(saldo) + '</strong></div>'
      + '<div class="tf-title-progress"><span style="width:' + pct + '%"></span></div>'
    + '</div>'
    + '<div class="tf-title-actions">'
      + '<button class="btn-sm" type="button" onclick="tfOpenTituloModal(\'' + item.id + '\')" title="Ver e editar os dados do titulo">Ver/editar</button>'
      + (saldo > 0 ? '<button class="btn-sm" type="button" onclick="tfOpenTituloModal(\'' + item.id + '\', \'baixa\')" title="Registrar uma baixa neste titulo">' + (item.natureza === 'receber' ? 'Registrar recebimento' : 'Registrar pagamento') + '</button>' : '')
      + '<button class="btn-icon danger" type="button" onclick="tfDeleteTitulo(\'' + item.id + '\')" title="Excluir titulo">&#128465;</button>'
    + '</div>'
    + '</article>';
}

function tfBuildListaTitulos(items) {
  if (!items.length) return '<div class="empty-state" style="padding:26px 20px">Nenhum titulo encontrado com os filtros atuais.</div>';
  return tfBulkEventosHtml(items) + '<div class="tf-title-list">' + items.map(tfTituloCardHtml).join('') + '</div>';
}

function tfVisibleBulkIds(items) {
  return (items || []).map(function(item) { return item.id; }).filter(Boolean);
}

function tfToggleBulkTitulo(id, checked) {
  if (!id) return;
  if (checked) _tfBulkSelected.add(id);
  else _tfBulkSelected.delete(id);
  var countEl = document.getElementById('tf-bulk-count');
  if (countEl) countEl.textContent = String(_tfBulkSelected.size);
}

function tfSelectAllBulkTitulos(ids) {
  (ids || []).forEach(function(id) {
    if (id) _tfBulkSelected.add(id);
  });
  renderFinanceiro();
}

function tfClearBulkTitulos() {
  _tfBulkSelected.clear();
  renderFinanceiro();
}

function tfBulkEventosHtml(items) {
  if (!tfEventosEnabled()) return '';
  var ids = tfVisibleBulkIds(items);
  var idsLiteral = JSON.stringify(ids).replace(/"/g, '&quot;');
  return '<div class="tf-bulk-event-bar">'
    + '<div><strong>Evento em lote</strong><span><span id="tf-bulk-count">' + _tfBulkSelected.size + '</span> selecionado(s)</span></div>'
    + '<select id="tf-bulk-evento">' + tfEventosOptionsHtml('', 'Remover evento') + '</select>'
    + '<button class="btn-sm" type="button" onclick="tfSelectAllBulkTitulos(' + idsLiteral + ')">Selecionar filtrados</button>'
    + '<button class="btn-sm" type="button" onclick="tfApplyBulkEvento()">Aplicar evento</button>'
    + '<button class="btn-sm red" type="button" onclick="tfClearBulkTitulos()">Limpar</button>'
    + '</div>';
}

async function tfApplyBulkEvento() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  if (!tfEventosEnabled()) return alert('Habilite o modulo de eventos antes de aplicar em lote.');
  var ids = Array.from(_tfBulkSelected).filter(function(id) {
    return tfTitulosCliente().some(function(item) { return item.id === id; });
  });
  if (!ids.length) return alert('Selecione ao menos um titulo.');

  var eventoId = ((document.getElementById('tf-bulk-evento') || {}).value || '').trim() || null;
  var eventoNome = eventoId ? tfNomeEventoById(eventoId) : '';
  var ok = await appConfirm(
    'Aplicar ' + (eventoNome || 'sem evento') + ' em ' + ids.length + ' titulo(s) selecionado(s)?',
    { title: 'Evento em lote', confirmText: 'Aplicar' }
  );
  if (!ok) return;

  var response = await applyUserScope(
    supabaseClient
      .from('titulos_financeiros')
      .update({ evento_id: eventoId })
      .in('id', ids)
  );

  if (response.error) {
    console.error('Erro ao aplicar evento em lote:', response.error);
    alert('Nao foi possivel aplicar o evento em lote. Verifique se a migracao de eventos foi aplicada.');
    return;
  }

  tfTitulosCliente().forEach(function(item) {
    if (!ids.includes(item.id)) return;
    item.eventoId = eventoId;
    item.evento = eventoNome;
  });
  _tfBulkSelected.clear();
  if (typeof notifyWorkspaceDataChanged === 'function') notifyWorkspaceDataChanged(activeClient, 'titulos_atualizados');
  renderFinanceiro();
}

function tfContaDaBaixa(baixa) {
  var cliente = tfClienteAtivo();
  if (!cliente || !baixa || !baixa.lancamentoId) return '';
  var lanc = (cliente.extrato || []).find(function(item) { return item.id === baixa.lancamentoId; });
  return lanc ? tfNomeContaPorId(lanc.contaId || '') : '';
}

function tfLancamentoDaBaixa(baixa) {
  var cliente = tfClienteAtivo();
  if (!cliente || !baixa || !baixa.lancamentoId) return null;
  return (cliente.extrato || []).find(function(item) { return item.id === baixa.lancamentoId; }) || null;
}

function tfResumoBaixa(baixa) {
  var lanc = tfLancamentoDaBaixa(baixa);
  var partes = [];
  partes.push(baixa.origem === 'extrato' ? 'Conciliado via Extrato' : (baixa.lancamentoId ? 'Movimentou Extrato' : 'Baixa manual'));
  if (lanc && lanc.contaId) partes.push(tfNomeContaPorId(lanc.contaId));
  if (lanc && (lanc.desc || lanc.descOriginal)) partes.push(lanc.desc || lanc.descOriginal);

  var obs = String(baixa.observacao || '').trim();
  var obsNorm = tfNormalizeText(obs);
  var jaTemObs = partes.some(function(parte) { return tfNormalizeText(parte) === obsNorm; });
  if (obs && !obsNorm.includes('conciliado com extrato') && !jaTemObs) partes.push(obs);

  return partes.join(' - ');
}

async function tfCadastrarContaParaBaixa(tituloId) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  if (typeof abrirFormularioContaCliente !== 'function') return alert('Cadastro de conta indisponivel nesta tela.');
  var conta = await abrirFormularioContaCliente({ tipo: 'caixa', banco: 'Carteira', saldoInicial: 0 });
  if (!conta) return;

  var result = await supabaseClient
    .from('contas')
    .insert([Object.assign({
      cliente_id: activeClient,
      tipo: conta.tipo,
      banco: conta.banco,
      agencia: conta.agencia || null,
      numero: conta.numero || null,
      saldo_inicial: Number(conta.saldoInicial || 0)
    }, getUserScopePayload())]);

  if (result.error) {
    console.error('Erro ao cadastrar conta pelo financeiro:', result.error);
    alert('Nao foi possivel cadastrar a conta.');
    return;
  }

  await loadData();
  tfOpenTituloModal(tituloId);
}

async function tfInsertLancamentoBaixa(item, dataBaixa, valor, observacao, contaId) {
  var desc = (item.natureza === 'receber' ? 'Recebimento - ' : 'Pagamento - ') + (item.descricao || '');
  var payload = {
    cliente_id: activeClient,
    data_lancamento: dataBaixa || null,
    descricao: desc,
    descricao_original: desc,
    categoria: item.natureza === 'receber' ? 'Recebimento de titulo' : 'Pagamento de titulo',
    centro_custo_id: item.natureza === 'pagar' ? (item.centroCustoId || null) : null,
    tipo: item.natureza === 'receber' ? 'credito' : 'debito',
    valor: Number(valor || 0),
    conta_id: contaId || null,
    relacionamento_id: null,
    observacao: observacao || null
  };

  var response = await supabaseClient
    .from('lancamentos')
    .insert([Object.assign({}, payload, getUserScopePayload())])
    .select()
    .single();

  if (!response.error) return response;

  var fallback = Object.assign({}, payload);
  if (fallback.conta_id && typeof isMissingContaSchemaError === 'function' && isMissingContaSchemaError(response.error)) delete fallback.conta_id;
  if (fallback.centro_custo_id && typeof isMissingCentroCustoSchemaError === 'function' && isMissingCentroCustoSchemaError(response.error)) delete fallback.centro_custo_id;
  if (fallback.conta_id !== payload.conta_id || fallback.centro_custo_id !== payload.centro_custo_id) {
    return supabaseClient
      .from('lancamentos')
      .insert([Object.assign(fallback, getUserScopePayload())])
      .select()
      .single();
  }

  return response;
}

function tfOpenTituloModal(id, foco) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var naturezaLabel = item.natureza === 'receber' ? 'Conta a receber' : 'Conta a pagar';
  var baixarLabel = item.natureza === 'receber' ? 'Registrar recebimento' : 'Registrar pagamento';
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
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group"><label>' + (item.natureza === 'receber' ? 'Cliente pagador' : 'Favorecido / fornecedor') + '</label><input type="text" id="tf-edit-pessoa" value="' + esc(item.pessoaNome || '') + '"/></div>'
      + '<div class="form-group"><label>Descricao</label><input type="text" id="tf-edit-descricao" value="' + esc(item.descricao || '') + '" placeholder="Opcional"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group" style="max-width:170px"><label>Vencimento</label><input type="text" id="tf-edit-vencimento" class="flex-date-input" value="' + esc(item.vencimento ? formatDate(item.vencimento) : '') + '" placeholder="dd/mm ou dd/mm/aaaa"/></div>'
      + '<div class="form-group" style="max-width:170px"><label>Valor total</label><input type="text" id="tf-edit-valor" class="money-input" value="' + esc((Number(item.valorTotal || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '"/></div>'
    + '</div>'
    + ((item.natureza === 'pagar' || tfEventosEnabled()) ? '<div class="form-row">'
      + (item.natureza === 'pagar' ? '<div class="form-group"><label>Centro de custo</label><select id="tf-edit-centro-custo">' + tfCentrosCustoOptionsHtml(item.centroCustoId || '') + '</select></div>' : '')
      + (tfEventosEnabled() ? '<div class="form-group"><label>' + esc(tfEventosLabel()) + '</label><select id="tf-edit-evento" onchange="tfSyncOrcamentoOptions(\'tf-edit\',\'' + item.natureza + '\')">' + tfEventosOptionsHtml(item.eventoId || '') + '</select></div>' : '')
      + (tfEventosEnabled() ? '<div class="form-group"><label>Linha do orcamento</label><select id="tf-edit-orcamento-linha">' + tfOrcamentoOptionsHtml(item.natureza, item.eventoId || '', item.orcamentoLinhaId || '') + '</select></div>' : '')
    + '</div>' : '')
    + '<div class="form-row">'
      + '<div class="form-group"><label>Observacao</label><textarea id="tf-edit-observacao" rows="3" placeholder="Informacoes importantes deste titulo">' + esc(item.observacao || '') + '</textarea></div>'
    + '</div>'
    + '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin:4px 0 18px">'
      + '<button class="btn-sm red" type="button" onclick="closeModal()">Fechar</button>'
      + '<button class="btn-add" type="button" style="margin-top:0" onclick="tfSaveTitulo(\'' + id + '\')">Salvar titulo</button>'
    + '</div>'
    + '<div class="settings-section-card">'
      + '<div class="settings-card-head"><div><h5>Baixas registradas</h5><p>Registre recebimentos ou pagamentos parciais para acompanhar o saldo deste titulo.</p></div></div>'
      + baixasHtml
      + '<div class="form-row" style="margin-top:16px">'
        + '<div class="form-group" style="max-width:170px"><label>Data da baixa</label><input type="text" id="tf-baixa-data" class="flex-date-input" value="' + esc(formatDate(new Date().toISOString().slice(0, 10))) + '" placeholder="dd/mm ou dd/mm/aaaa"/></div>'
        + '<div class="form-group" style="max-width:170px"><label>Valor</label><input type="text" id="tf-baixa-valor" class="money-input" value="' + esc(Math.max(tfSaldo(item), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '"/></div>'
        + '<div class="form-group"><label>Conta movimentada <span style="color:var(--accent);cursor:pointer;font-size:.68rem" onclick="tfCadastrarContaParaBaixa(\'' + id + '\')">(+ caixa/carteira)</span></label><select id="tf-baixa-conta">' + tfContaOptionsHtml('') + '</select></div>'
      + '</div>'
      + '<div class="form-row" style="margin-top:8px">'
        + '<div class="form-group"><label>Observacao</label><input type="text" id="tf-baixa-observacao" placeholder="Ex.: Pix, TED, boleto"/></div>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end"><button class="btn-add" type="button" style="margin-top:6px" onclick="tfRegistrarBaixa(\'' + id + '\')">' + baixarLabel + '</button></div>'
    + '</div>';

  document.getElementById('modalOverlay').classList.add('open');
  document.addEventListener('keydown', handleMainModalEscape);
  initMoneyInputs(document.getElementById('modalBody'));
  initFlexibleDateInputs(document.getElementById('modalBody'));
  if (foco === 'baixa') {
    var campoValor = document.getElementById('tf-baixa-valor');
    var secaoBaixa = campoValor ? campoValor.closest('.settings-section-card') : null;
    if (secaoBaixa && typeof secaoBaixa.scrollIntoView === 'function') secaoBaixa.scrollIntoView({ block: 'start' });
    if (campoValor && typeof campoValor.focus === 'function') campoValor.focus();
  }
}

async function tfSaveTitulo(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var orcamentoLinhaId = ((document.getElementById('tf-edit-orcamento-linha') || {}).value || '').trim() || null;
  var orcamentoLinha = tfOrcamentoLinhaById(orcamentoLinhaId);
  var payload = {
    pessoa_nome: formatDescriptionTitleCase((document.getElementById('tf-edit-pessoa') || {}).value || ''),
    descricao: tfDescricaoTitulo((document.getElementById('tf-edit-descricao') || {}).value || '', item.natureza, (document.getElementById('tf-edit-pessoa') || {}).value || item.pessoaNome || ''),
    categoria: null,
    centro_custo_id: item.natureza === 'pagar' ? (((document.getElementById('tf-edit-centro-custo') || {}).value || '').trim() || null) : null,
    evento_id: orcamentoLinha ? (orcamentoLinha.eventoId || null) : (((document.getElementById('tf-edit-evento') || {}).value || '').trim() || null),
    orcamento_linha_id: orcamentoLinhaId,
    vencimento: tfNormalizeDateFieldValue('tf-edit-vencimento', 'vencimento'),
    valor_total: tfParseAmountFromInput('tf-edit-valor'),
    observacao: ((document.getElementById('tf-edit-observacao') || {}).value || '').trim() || null
  };
  if (!tfEventosEnabled() && !payload.evento_id && !item.eventoId) delete payload.evento_id;
  if (!payload.orcamento_linha_id && !item.orcamentoLinhaId) delete payload.orcamento_linha_id;
  if (orcamentoLinha && !tfOrcamentoLinhaCompativelComTitulo(orcamentoLinha, Object.assign({}, item, { eventoId: payload.evento_id }))) {
    alert('A linha do orcamento precisa ser do mesmo tipo e evento deste titulo.');
    return;
  }

  if (payload.vencimento === null) return;

  if (!payload.pessoa_nome || payload.valor_total <= 0) {
    alert('Preencha pessoa e valor do título.');
    return;
  }

  var response = await applyUserScope(
    supabaseClient
      .from('titulos_financeiros')
      .update(payload)
      .eq('id', id)
  ).select().single();

  if (response.error) {
    console.error(response.error);
    alert('Nao foi possivel salvar o titulo.');
    return;
  }

  tfUpdateLocalTitulo(response.data);
  if (typeof notifyWorkspaceDataChanged === 'function') notifyWorkspaceDataChanged(activeClient, 'titulo_editado');
  closeModal();
  renderFinanceiro();
}

async function tfDeleteTitulo(id) {
  var item = tfFindTituloById(id);
  if (!item) return;
  var ok = await appConfirm('Excluir este titulo financeiro? As baixas registradas tambem serao removidas.', { title: 'Excluir titulo', confirmText: 'Excluir' });
  if (!ok) return;

  var response = await applyUserScope(
    supabaseClient
      .from('titulos_financeiros')
      .delete()
      .eq('id', id)
  );

  if (response.error) {
    console.error(response.error);
    alert('Nao foi possivel excluir o titulo.');
    return;
  }

  var cliente = tfClienteAtivo();
  cliente.titulos = (cliente.titulos || []).filter(function(entry) { return entry.id !== id; });
  if (typeof notifyWorkspaceDataChanged === 'function') notifyWorkspaceDataChanged(activeClient, 'titulo_excluido');
  closeModal();
  renderFinanceiro();
}

async function tfRegistrarBaixa(id) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var item = tfFindTituloById(id);
  if (!item) return;
  var dataBaixa = tfNormalizeDateFieldValue('tf-baixa-data', 'data da baixa');
  var valor = tfParseAmountFromInput('tf-baixa-valor');
  var contaId = ((document.getElementById('tf-baixa-conta') || {}).value || '').trim();
  var observacao = ((document.getElementById('tf-baixa-observacao') || {}).value || '').trim();

  if (dataBaixa === null) return;
  if (!dataBaixa) dataBaixa = new Date().toISOString().slice(0, 10);

  if (valor <= 0) {
    alert('Informe um valor de baixa maior que zero.');
    return;
  }

  var lancamentoId = null;
  if (contaId) {
    var lancamentoResponse = await tfInsertLancamentoBaixa(item, dataBaixa, valor, observacao, contaId);
    if (lancamentoResponse.error) {
      console.error(lancamentoResponse.error);
      alert('Nao foi possivel registrar a movimentacao no Extrato.');
      return;
    }
    lancamentoId = lancamentoResponse.data && lancamentoResponse.data.id;
  }

  var response = await supabaseClient
    .from('titulos_financeiros_baixas')
    .insert([Object.assign({
      titulo_id: id,
      cliente_id: activeClient,
      data_baixa: dataBaixa,
      valor: valor,
      observacao: observacao || null,
      origem: 'manual',
      extrato_lancamento_id: lancamentoId || null
    }, getUserScopePayload())])
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    if (lancamentoId) {
      await applyUserScope(supabaseClient.from('lancamentos').delete().eq('id', lancamentoId));
    }
    alert('Nao foi possivel registrar a baixa.');
    return;
  }

  if (!lancamentoId) {
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
  }
  if (typeof notifyWorkspaceDataChanged === 'function') notifyWorkspaceDataChanged(activeClient, 'baixa_financeiro');
  if (lancamentoId) await loadData();
  tfOpenTituloModal(id);
  renderFinanceiro();
}

async function tfDeleteBaixa(tituloId, baixaId) {
  var ok = await appConfirm('Excluir esta baixa registrada?', { title: 'Excluir baixa', confirmText: 'Excluir' });
  if (!ok) return;
  var titulo = tfFindTituloById(tituloId);
  var baixaAtual = titulo && (titulo.baixas || []).find(function(baixa) { return baixa.id === baixaId; });

  var response = await applyUserScope(
    supabaseClient
      .from('titulos_financeiros_baixas')
      .delete()
      .eq('id', baixaId)
  );

  if (response.error) {
    console.error(response.error);
    alert('Nao foi possivel excluir a baixa.');
    return;
  }

  if (baixaAtual && baixaAtual.lancamentoId && baixaAtual.origem !== 'extrato') {
    await applyUserScope(supabaseClient.from('lancamentos').delete().eq('id', baixaAtual.lancamentoId));
  }

  var item = tfFindTituloById(tituloId);
  if (item) item.baixas = (item.baixas || []).filter(function(baixa) { return baixa.id !== baixaId; });
  if (typeof notifyWorkspaceDataChanged === 'function') notifyWorkspaceDataChanged(activeClient, 'exclusao_baixa_financeiro');
  if (baixaAtual && baixaAtual.lancamentoId) await loadData();
  tfOpenTituloModal(tituloId);
  renderFinanceiro();
}

function renderFinanceiroNovo(root) {
  if (!activeClient || !tfClienteAtivo()) {
    root.innerHTML = '<div class="empty-state"><div class="icon">v</div>Selecione um cliente.</div>';
    return;
  }

  if (!tfClienteEhPJ()) {
    root.innerHTML = '<div class="empty-state"><div class="icon">PJ</div>O modulo Financeiro esta disponivel apenas para clientes PJ.</div>';
    return;
  }

  var pendencias = tfPendenciasResumo();
  var tituloAtivo = tfTituloAtivoLabel();
  var pessoaLabel = _tfNatureza === 'pagar' ? 'Favorecido / fornecedor' : 'Cliente pagador';
  var btnLabel = _tfNatureza === 'pagar' ? 'Cadastrar conta a pagar' : 'Cadastrar conta a receber';
  var itens = tfFilteredItems();
  var resumo = tfSummaryValues(itens);
  if (_tfFinanceiroView === 'eventos' && !tfEventosEnabled()) _tfFinanceiroView = 'titulos';

  var resumoHtml =
    '<div class="summary-grid">'
      + (_tfNatureza === 'receber'
        ? '<div class="summary-card"><div class="s-label">A receber em aberto</div><div class="s-val green">' + fmt(resumo.receber) + '</div></div>'
          + '<div class="summary-card"><div class="s-label">Ja recebido</div><div class="s-val green">' + fmt(resumo.recebido) + '</div></div>'
        : '<div class="summary-card"><div class="s-label">A pagar em aberto</div><div class="s-val red">' + fmt(resumo.pagar) + '</div></div>'
          + '<div class="summary-card"><div class="s-label">Ja pago</div><div class="s-val red">' + fmt(resumo.pago) + '</div></div>')
      + '<div class="summary-card"><div class="s-label">Vencidos</div><div class="s-val yellow">' + resumo.vencidos + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Titulos</div><div class="s-val blue">' + resumo.total + '</div></div>'
    + '</div>';

  var pendenciasHtml =
    '<div class="summary-grid pending-grid">'
      + '<div class="summary-card pending-card"><div class="s-label">Nao conciliados</div><div class="s-val yellow">' + pendencias.extratoNaoConciliados.count + '</div><div class="pending-meta">' + fmt(pendencias.extratoNaoConciliados.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaExtrato(\'nao_conciliados\')">Abrir no Extrato</button></div>'
      + '<div class="summary-card pending-card"><div class="s-label">Pendentes de estorno</div><div class="s-val red">' + pendencias.extratoPendentesEstorno.count + '</div><div class="pending-meta">' + fmt(pendencias.extratoPendentesEstorno.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaExtrato(\'pendentes_estorno\')">Abrir no Extrato</button></div>'
      + '<div class="summary-card pending-card"><div class="s-label">Lancamentos rateados</div><div class="s-val blue">' + pendencias.extratoRateados.count + '</div><div class="pending-meta">' + fmt(pendencias.extratoRateados.valor) + '</div><button class="btn-sm" onclick="switchTab(\'extrato\')">Abrir no Extrato</button></div>'
      + '<div class="summary-card pending-card"><div class="s-label">A receber vencido</div><div class="s-val red">' + pendencias.receberVencido.count + '</div><div class="pending-meta">' + fmt(pendencias.receberVencido.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'receber\', \'atrasado\')">Abrir no Financeiro</button></div>'
      + '<div class="summary-card pending-card"><div class="s-label">A pagar vencido</div><div class="s-val red">' + pendencias.pagarVencido.count + '</div><div class="pending-meta">' + fmt(pendencias.pagarVencido.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'pagar\', \'atrasado\')">Abrir no Financeiro</button></div>'
      + '<div class="summary-card pending-card"><div class="s-label">Receber parcial</div><div class="s-val yellow">' + pendencias.receberParcial.count + '</div><div class="pending-meta">' + fmt(pendencias.receberParcial.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'receber\', \'parcial\')">Abrir no Financeiro</button></div>'
      + '<div class="summary-card pending-card"><div class="s-label">Pagar parcial</div><div class="s-val yellow">' + pendencias.pagarParcial.count + '</div><div class="pending-meta">' + fmt(pendencias.pagarParcial.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'pagar\', \'parcial\')">Abrir no Financeiro</button></div>'
    + '</div>';

  var filtrosHtml =
    '<div class="form-row">'
      + '<div class="form-group" style="max-width:180px"><label>Status</label><select id="tf-filtro-status"><option value="todos"' + (_tfStatus === 'todos' ? ' selected' : '') + '>Todos</option><option value="aberto"' + (_tfStatus === 'aberto' ? ' selected' : '') + '>Em aberto</option><option value="parcial"' + (_tfStatus === 'parcial' ? ' selected' : '') + '>Parcial</option><option value="quitado"' + (_tfStatus === 'quitado' ? ' selected' : '') + '>Quitado</option><option value="atrasado"' + (_tfStatus === 'atrasado' ? ' selected' : '') + '>Atrasado</option></select></div>'
      + '<div class="form-group"><label>Pessoa</label><input type="text" id="tf-filtro-pessoa" value="' + esc(_tfPessoa) + '" placeholder="Cliente ou fornecedor" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
      + '<div class="form-group"><label>Descricao</label><input type="text" id="tf-filtro-descricao" value="' + esc(_tfDescricao) + '" placeholder="Digite ao menos 3 letras" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
      + '<div class="form-group"><label>Busca geral</label><input type="text" id="tf-filtro-busca" value="' + esc(_tfBusca) + '" placeholder="Pessoa, descricao, evento, centro ou observacao" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group" style="max-width:170px"><label>Vencimento de</label><input type="text" id="tf-filtro-vencimento-de" class="flex-date-input" value="' + esc(_tfVencimentoDe ? formatDate(_tfVencimentoDe) : '') + '" placeholder="dd/mm/aaaa" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
      + '<div class="form-group" style="max-width:170px"><label>Vencimento ate</label><input type="text" id="tf-filtro-vencimento-ate" class="flex-date-input" value="' + esc(_tfVencimentoAte ? formatDate(_tfVencimentoAte) : '') + '" placeholder="dd/mm/aaaa" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
      + '<div class="form-group" style="max-width:160px"><label>Valor</label><select id="tf-filtro-valor-modo"><option value="todos"' + (_tfValorModo === 'todos' ? ' selected' : '') + '>Todos</option><option value="igual"' + (_tfValorModo === 'igual' ? ' selected' : '') + '>Igual a</option><option value="acima"' + (_tfValorModo === 'acima' ? ' selected' : '') + '>Acima de</option><option value="abaixo"' + (_tfValorModo === 'abaixo' ? ' selected' : '') + '>Abaixo de</option></select></div>'
      + '<div class="form-group" style="max-width:170px"><label>Valor (R$)</label><input type="text" id="tf-filtro-valor" class="money-input" value="' + esc(Number(_tfValor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
      + (_tfNatureza === 'pagar' ? '<div class="form-group"><label>Centro de custo</label><select id="tf-filtro-centro-custo">' + tfCentrosCustoFilterOptionsHtml(_tfCentroCusto) + '</select></div>' : '')
      + (tfEventosEnabled() ? '<div class="form-group"><label>' + esc(tfEventosLabel()) + '</label><select id="tf-filtro-evento">' + tfEventosFilterOptionsHtml(_tfEvento) + '</select></div>' : '')
    + '</div>';

  var novoFormHtml =
    '<div class="form-row">'
      + '<div class="form-group"><label>' + pessoaLabel + '</label><input type="text" id="' + tfFormPrefix() + '-pessoa" placeholder="Quem esta envolvido neste titulo"/></div>'
      + '<div class="form-group"><label>Descricao</label><input type="text" id="' + tfFormPrefix() + '-descricao" placeholder="Opcional"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group" style="max-width:170px"><label>Vencimento</label><input type="text" id="' + tfFormPrefix() + '-vencimento" class="flex-date-input" placeholder="dd/mm ou dd/mm/aaaa"/></div>'
      + '<div class="form-group" style="max-width:170px"><label>Valor (R$)</label><input type="text" id="' + tfFormPrefix() + '-valor" class="money-input" value="0,00"/></div>'
    + '</div>'
    + ((_tfNatureza === 'pagar' || tfEventosEnabled()) ? '<div class="form-row">'
      + (_tfNatureza === 'pagar' ? '<div class="form-group"><label>Centro de custo</label><select id="' + tfFormPrefix() + '-centro-custo">' + tfCentrosCustoOptionsHtml('') + '</select></div>' : '')
      + (tfEventosEnabled() ? '<div class="form-group"><label>' + esc(tfEventosLabel()) + '</label><select id="' + tfFormPrefix() + '-evento" onchange="tfSyncOrcamentoOptions(\'' + tfFormPrefix() + '\',\'' + _tfNatureza + '\')">' + tfEventosOptionsHtml(_tfEvento && _tfEvento !== '__sem_evento__' ? _tfEvento : '') + '</select></div>' : '')
      + (tfEventosEnabled() ? '<div class="form-group"><label>Linha do orcamento</label><select id="' + tfFormPrefix() + '-orcamento-linha">' + tfOrcamentoOptionsHtml(_tfNatureza, _tfEvento && _tfEvento !== '__sem_evento__' ? _tfEvento : '', '') + '</select></div>' : '')
    + '</div>' : '')
    + '<div class="form-row">'
      + '<div class="form-group"><label>Observacao</label><textarea id="' + tfFormPrefix() + '-observacao" rows="3" placeholder="Informacoes complementares deste titulo"></textarea></div>'
    + '</div>'
    + '<button class="btn-add" onclick="tfAddTitulo()">' + btnLabel + '</button>';

  var importPanelBody = tfImportGuideHtml()
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn-sm" onclick="tfExportImportTemplate()">Baixar modelo (.xlsx)</button><button class="btn-sm" onclick="tfAbrirImportacaoTitulos()">Importar planilha</button></div>';
  var pendenciasCount = pendencias.extratoNaoConciliados.count + pendencias.extratoPendentesEstorno.count
    + pendencias.receberVencido.count + pendencias.pagarVencido.count
    + pendencias.receberParcial.count + pendencias.pagarParcial.count;
  var areaHtml = tfBuildListaTitulos(itens);
  var eventosHtml = tfEventosResumoHtml();

  var headerHtml =
    '<div class="tf-finance-hero">'
      + '<div class="tf-finance-hero-head">'
        + '<div><h3>Financeiro PJ</h3><p class="cartao-helper-text">Controle os titulos, baixas, eventos e pendencias da empresa em areas separadas.</p></div>'
        + '<div class="tipo-toggle">'
          + '<button type="button" class="tipo-btn credito' + (_tfNatureza === 'receber' ? ' active' : '') + '" onclick="tfSetNatureza(\'receber\')">A Receber</button>'
          + '<button type="button" class="tipo-btn debito' + (_tfNatureza === 'pagar' ? ' active' : '') + '" onclick="tfSetNatureza(\'pagar\')">A Pagar</button>'
        + '</div>'
      + '</div>'
      + '<div class="tf-finance-actions">'
        + '<button class="btn-sm" onclick="tfOpenNovoTitulo()">Novo titulo</button>'
        + '<button class="btn-sm" onclick="tfSetFinanceiroView(\'importar\')">Importar planilha</button>'
        + (tfEventosEnabled() ? '<button class="btn-sm" onclick="tfSetFinanceiroView(\'eventos\')">' + esc(tfEventosLabel()) + '</button>' : '')
        + '<button class="btn-sm" onclick="tfSetFinanceiroView(\'pendencias\')">Ver pendencias</button>'
      + '</div>'
    + '</div>';
  var tabsHtml =
    '<div class="tf-finance-tabs">'
      + '<button type="button" class="tf-finance-tab' + (_tfFinanceiroView === 'titulos' ? ' active' : '') + '" onclick="tfSetFinanceiroView(\'titulos\')"><span>Titulos</span><strong>' + resumo.total + '</strong></button>'
      + (tfEventosEnabled() ? '<button type="button" class="tf-finance-tab' + (_tfFinanceiroView === 'eventos' ? ' active' : '') + '" onclick="tfSetFinanceiroView(\'eventos\')"><span>' + esc(tfEventosLabel()) + '</span><strong>' + tfEventosCliente(false).length + '</strong></button>' : '')
      + '<button type="button" class="tf-finance-tab' + (_tfFinanceiroView === 'pendencias' ? ' active' : '') + '" onclick="tfSetFinanceiroView(\'pendencias\')"><span>Pendencias</span><strong>' + pendenciasCount + '</strong></button>'
      + '<button type="button" class="tf-finance-tab' + (_tfFinanceiroView === 'importar' ? ' active' : '') + '" onclick="tfSetFinanceiroView(\'importar\')"><span>Importar</span><strong>XLSX</strong></button>'
    + '</div>';
  var titulosViewHtml =
    '<div class="tf-view-head">'
      + '<div><h3>' + esc(tituloAtivo) + '</h3><p class="cartao-helper-text">Filtre, acompanhe saldos e registre baixas sem sair da lista.</p></div>'
      + '<button class="btn-add" onclick="tfOpenNovoTitulo()">+ Novo titulo</button>'
    + '</div>'
    + (_tfPanels.novo ? '<div class="form-card tf-inline-form"><div class="tf-section-head"><div><h3>Novo titulo</h3><p class="cartao-helper-text">' + esc(tituloAtivo) + '</p></div><button class="btn-sm red" onclick="_tfPanels.novo=false;renderFinanceiro()">Fechar</button></div>' + novoFormHtml + '</div>' : '')
    + '<div class="form-card tf-filter-strip"><div class="tf-section-head"><div><h3>Filtros</h3><p class="cartao-helper-text">A busca considera pessoa, descricao, observacao, centro e ' + esc(tfEventosLabel().toLowerCase()) + '.</p></div><div class="tf-export-actions"><button class="btn-sm" onclick="tfApplyFilters()">Aplicar</button><button class="btn-sm red" onclick="tfClearFilters()">Limpar</button><button class="btn-sm" onclick="tfExportPDF()">PDF</button><button class="btn-sm" onclick="tfExportXlsx()">XLSX</button></div></div>' + filtrosHtml + '</div>'
    + '<div class="tf-list-shell"><div class="section-title">' + esc(tituloAtivo) + '</div>' + areaHtml + '</div>';
  var activeViewHtml = titulosViewHtml;
  if (_tfFinanceiroView === 'eventos') {
    activeViewHtml = '<div class="form-card tf-finance-view-card"><div class="tf-section-head"><div><h3>' + esc(tfEventosLabel()) + '</h3><p class="cartao-helper-text">Cadastre e compare receitas, custos e resultados por evento.</p></div></div>' + eventosHtml + '</div>';
  } else if (_tfFinanceiroView === 'pendencias') {
    activeViewHtml = '<div class="form-card tf-finance-view-card"><div class="tf-section-head"><div><h3>Painel de pendencias</h3><p class="cartao-helper-text">Atalhos para o que ainda precisa de atencao no Extrato e no Financeiro.</p></div></div>' + pendenciasHtml + '</div>';
  } else if (_tfFinanceiroView === 'importar') {
    activeViewHtml = '<div class="form-card tf-finance-view-card"><div class="tf-section-head"><div><h3>Importar titulos via planilha</h3><p class="cartao-helper-text">Use o modelo para importar contas a receber e contas a pagar em lote.</p></div></div>' + importPanelBody + '</div>';
  }

  root.innerHTML = headerHtml + resumoHtml + tabsHtml + '<div class="tf-finance-view">' + activeViewHtml + '</div>';
  initMoneyInputs(root);
  initFlexibleDateInputs(root);
  initDrag('financeiro', COLS_TITULOS, renderFinanceiro);
}

function renderFinanceiro() {
  var root = document.getElementById('financeiro-content');
  if (!root) return;
  renderFinanceiroNovo(root);
  return;

  if (!activeClient || !tfClienteAtivo()) {
    root.innerHTML = '<div class="empty-state"><div class="icon">👇</div>Selecione um cliente.</div>';
    return;
  }

  if (!tfClienteEhPJ()) {
    root.innerHTML = '<div class="empty-state"><div class="icon">🏢</div>O modulo Financeiro esta disponivel apenas para clientes PJ.</div>';
    return;
  }

  var pendencias = tfPendenciasResumo();
  var tituloAtivo = tfTituloAtivoLabel();
  var pessoaLabel = _tfNatureza === 'pagar' ? 'Favorecido / fornecedor' : 'Cliente pagador';
  var btnLabel = _tfNatureza === 'pagar' ? 'Cadastrar conta a pagar' : 'Cadastrar conta a receber';
  var itens = tfFilteredItems();
  var resumo = tfSummaryValues(itens);
  var eventosHtml = tfEventosResumoHtml();
  if (_tfFinanceiroView === 'eventos' && !tfEventosEnabled()) _tfFinanceiroView = 'titulos';
  var resumoHtml =
    '<div class="summary-grid">'
      + (_tfNatureza === 'receber'
        ? '<div class="summary-card"><div class="s-label">A receber em aberto</div><div class="s-val green">' + fmt(resumo.receber) + '</div></div>'
          + '<div class="summary-card"><div class="s-label">Ja recebido</div><div class="s-val green">' + fmt(resumo.recebido) + '</div></div>'
        : '<div class="summary-card"><div class="s-label">A pagar em aberto</div><div class="s-val red">' + fmt(resumo.pagar) + '</div></div>'
          + '<div class="summary-card"><div class="s-label">Ja pago</div><div class="s-val red">' + fmt(resumo.pago) + '</div></div>')
      + '<div class="summary-card"><div class="s-label">Vencidos</div><div class="s-val yellow">' + resumo.vencidos + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Titulos</div><div class="s-val blue">' + resumo.total + '</div></div>'
    + '</div>';
  var pendenciasHtml =
    '<p class="cartao-helper-text">Atalhos para o que ainda precisa de atenção no Extrato e no Financeiro.</p>'
      + '<div class="summary-grid pending-grid">'
        + '<div class="summary-card pending-card"><div class="s-label">Nao conciliados</div><div class="s-val yellow">' + pendencias.extratoNaoConciliados.count + '</div><div class="pending-meta">' + fmt(pendencias.extratoNaoConciliados.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaExtrato(\'nao_conciliados\')">Abrir no Extrato</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Pendentes de estorno</div><div class="s-val red">' + pendencias.extratoPendentesEstorno.count + '</div><div class="pending-meta">' + fmt(pendencias.extratoPendentesEstorno.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaExtrato(\'pendentes_estorno\')">Abrir no Extrato</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Lancamentos rateados</div><div class="s-val blue">' + pendencias.extratoRateados.count + '</div><div class="pending-meta">' + fmt(pendencias.extratoRateados.valor) + '</div><button class="btn-sm" onclick="switchTab(\'extrato\')">Abrir no Extrato</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">A receber vencido</div><div class="s-val red">' + pendencias.receberVencido.count + '</div><div class="pending-meta">' + fmt(pendencias.receberVencido.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'receber\', \'atrasado\')">Abrir no Financeiro</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">A pagar vencido</div><div class="s-val red">' + pendencias.pagarVencido.count + '</div><div class="pending-meta">' + fmt(pendencias.pagarVencido.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'pagar\', \'atrasado\')">Abrir no Financeiro</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Receber parcial</div><div class="s-val yellow">' + pendencias.receberParcial.count + '</div><div class="pending-meta">' + fmt(pendencias.receberParcial.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'receber\', \'parcial\')">Abrir no Financeiro</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Pagar parcial</div><div class="s-val yellow">' + pendencias.pagarParcial.count + '</div><div class="pending-meta">' + fmt(pendencias.pagarParcial.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'pagar\', \'parcial\')">Abrir no Financeiro</button></div>'
      + '</div>';
  var importPanelBody = tfImportGuideHtml()
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn-sm" onclick="tfExportImportTemplate()">Baixar modelo (.xlsx)</button><button class="btn-sm" onclick="tfAbrirImportacaoTitulos()">Importar planilha</button></div>';
  var filtrosHtml =
    '<div class="form-row">'
      + '<div class="form-group" style="max-width:180px"><label>Status</label><select id="tf-filtro-status"><option value="todos"' + (_tfStatus === 'todos' ? ' selected' : '') + '>Todos</option><option value="aberto"' + (_tfStatus === 'aberto' ? ' selected' : '') + '>Em aberto</option><option value="parcial"' + (_tfStatus === 'parcial' ? ' selected' : '') + '>Parcial</option><option value="quitado"' + (_tfStatus === 'quitado' ? ' selected' : '') + '>Quitado</option><option value="atrasado"' + (_tfStatus === 'atrasado' ? ' selected' : '') + '>Atrasado</option></select></div>'
      + '<div class="form-group"><label>Pessoa</label><input type="text" id="tf-filtro-pessoa" value="' + esc(_tfPessoa) + '" placeholder="Cliente ou fornecedor" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
      + '<div class="form-group"><label>Descricao</label><input type="text" id="tf-filtro-descricao" value="' + esc(_tfDescricao) + '" placeholder="Digite ao menos 3 letras" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
      + '<div class="form-group"><label>Busca geral</label><input type="text" id="tf-filtro-busca" value="' + esc(_tfBusca) + '" placeholder="Pessoa, descricao, evento, centro ou observacao" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
    + '</div>'
    + '<div class="form-row">'
      + '<div class="form-group" style="max-width:170px"><label>Vencimento de</label><input type="text" id="tf-filtro-vencimento-de" class="flex-date-input" value="' + esc(_tfVencimentoDe ? formatDate(_tfVencimentoDe) : '') + '" placeholder="dd/mm/aaaa" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
      + '<div class="form-group" style="max-width:170px"><label>Vencimento ate</label><input type="text" id="tf-filtro-vencimento-ate" class="flex-date-input" value="' + esc(_tfVencimentoAte ? formatDate(_tfVencimentoAte) : '') + '" placeholder="dd/mm/aaaa" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
      + '<div class="form-group" style="max-width:160px"><label>Valor</label><select id="tf-filtro-valor-modo"><option value="todos"' + (_tfValorModo === 'todos' ? ' selected' : '') + '>Todos</option><option value="igual"' + (_tfValorModo === 'igual' ? ' selected' : '') + '>Igual a</option><option value="acima"' + (_tfValorModo === 'acima' ? ' selected' : '') + '>Acima de</option><option value="abaixo"' + (_tfValorModo === 'abaixo' ? ' selected' : '') + '>Abaixo de</option></select></div>'
      + '<div class="form-group" style="max-width:170px"><label>Valor (R$)</label><input type="text" id="tf-filtro-valor" class="money-input" value="' + esc(Number(_tfValor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '" onkeydown="if(event.key===\'Enter\')tfApplyFilters()"/></div>'
      + (_tfNatureza === 'pagar' ? '<div class="form-group"><label>Centro de custo</label><select id="tf-filtro-centro-custo">' + tfCentrosCustoFilterOptionsHtml(_tfCentroCusto) + '</select></div>' : '')
      + (tfEventosEnabled() ? '<div class="form-group"><label>' + esc(tfEventosLabel()) + '</label><select id="tf-filtro-evento">' + tfEventosFilterOptionsHtml(_tfEvento) + '</select></div>' : '')
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn-sm" onclick="tfApplyFilters()">Aplicar filtros</button><button class="btn-sm red" onclick="tfClearFilters()">Limpar</button><button class="btn-sm" onclick="tfExportPDF()">Exportar PDF</button><button class="btn-sm" onclick="tfExportXlsx()">Exportar XLSX</button></div>';
  var areaHtml = tfBuildListaTitulos(itens);

  root.innerHTML =
    financeiroPanel('resumo', 'Resumo financeiro', resumoHtml)
    + financeiroPanel('eventos', tfEventosLabel(), eventosHtml)
    + '<div class="form-card collapsible-card financeiro-collapsible-card' + (_tfPanels.pendencias ? ' open' : '') + '">'
      + '<button type="button" class="collapse-head" onclick="toggleFinanceiroPanel(\'pendencias\')" aria-expanded="' + !!_tfPanels.pendencias + '"><span>Painel de pendencias</span><span class="collapse-chevron" aria-hidden="true">&#9662;</span></button>'
      + (_tfPanels.pendencias ? '<div class="collapse-body">'
      + '<p class="cartao-helper-text">Atalhos para o que ainda precisa de atenção no Extrato e no Financeiro.</p>'
      + '<div class="summary-grid pending-grid">'
        + '<div class="summary-card pending-card"><div class="s-label">Nao conciliados</div><div class="s-val yellow">' + pendencias.extratoNaoConciliados.count + '</div><div class="pending-meta">' + fmt(pendencias.extratoNaoConciliados.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaExtrato(\'nao_conciliados\')">Abrir no Extrato</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Pendentes de estorno</div><div class="s-val red">' + pendencias.extratoPendentesEstorno.count + '</div><div class="pending-meta">' + fmt(pendencias.extratoPendentesEstorno.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaExtrato(\'pendentes_estorno\')">Abrir no Extrato</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Lancamentos rateados</div><div class="s-val blue">' + pendencias.extratoRateados.count + '</div><div class="pending-meta">' + fmt(pendencias.extratoRateados.valor) + '</div><button class="btn-sm" onclick="switchTab(\'extrato\')">Abrir no Extrato</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">A receber vencido</div><div class="s-val red">' + pendencias.receberVencido.count + '</div><div class="pending-meta">' + fmt(pendencias.receberVencido.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'receber\', \'atrasado\')">Abrir no Financeiro</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">A pagar vencido</div><div class="s-val red">' + pendencias.pagarVencido.count + '</div><div class="pending-meta">' + fmt(pendencias.pagarVencido.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'pagar\', \'atrasado\')">Abrir no Financeiro</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Receber parcial</div><div class="s-val yellow">' + pendencias.receberParcial.count + '</div><div class="pending-meta">' + fmt(pendencias.receberParcial.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'receber\', \'parcial\')">Abrir no Financeiro</button></div>'
        + '<div class="summary-card pending-card"><div class="s-label">Pagar parcial</div><div class="s-val yellow">' + pendencias.pagarParcial.count + '</div><div class="pending-meta">' + fmt(pendencias.pagarParcial.valor) + '</div><button class="btn-sm" onclick="tfAbrirPendenciaFinanceiro(\'pagar\', \'parcial\')">Abrir no Financeiro</button></div>'
      + '</div></div>' : '')
    + '</div>'
    + '<div class="form-card">'
      + '<h3>Financeiro PJ</h3>'
      + '<p class="cartao-helper-text">Cadastre os títulos a receber e a pagar da empresa. No próximo passo, vamos poder conciliar essas baixas diretamente com o Extrato.</p>'
      + '<div class="tipo-toggle" style="margin-top:14px">'
        + '<button type="button" class="tipo-btn credito' + (_tfNatureza === 'receber' ? ' active' : '') + '" onclick="tfSetNatureza(\'receber\')">A Receber</button>'
        + '<button type="button" class="tipo-btn debito' + (_tfNatureza === 'pagar' ? ' active' : '') + '" onclick="tfSetNatureza(\'pagar\')">A Pagar</button>'
      + '</div>'
    + '</div>'
    + financeiroPanel('novo', '+ Novo titulo - ' + tituloAtivo,
      '<div class="form-row">'
        + '<div class="form-group"><label>' + pessoaLabel + '</label><input type="text" id="' + tfFormPrefix() + '-pessoa" placeholder="Quem está envolvido neste título"/></div>'
        + '<div class="form-group"><label>Descricao</label><input type="text" id="' + tfFormPrefix() + '-descricao" placeholder="Opcional"/></div>'
      + '</div>'
      + '<div class="form-row">'
        + '<div class="form-group" style="max-width:170px"><label>Vencimento</label><input type="text" id="' + tfFormPrefix() + '-vencimento" class="flex-date-input" placeholder="dd/mm ou dd/mm/aaaa"/></div>'
        + '<div class="form-group" style="max-width:170px"><label>Valor (R$)</label><input type="text" id="' + tfFormPrefix() + '-valor" class="money-input" value="0,00"/></div>'
      + '</div>'
      + ((_tfNatureza === 'pagar' || tfEventosEnabled()) ? '<div class="form-row">'
        + (_tfNatureza === 'pagar' ? '<div class="form-group"><label>Centro de custo</label><select id="' + tfFormPrefix() + '-centro-custo">' + tfCentrosCustoOptionsHtml('') + '</select></div>' : '')
        + (tfEventosEnabled() ? '<div class="form-group"><label>' + esc(tfEventosLabel()) + '</label><select id="' + tfFormPrefix() + '-evento">' + tfEventosOptionsHtml(_tfEvento && _tfEvento !== '__sem_evento__' ? _tfEvento : '') + '</select></div>' : '')
      + '</div>' : '')
      + '<div class="form-row">'
        + '<div class="form-group"><label>Observacao</label><textarea id="' + tfFormPrefix() + '-observacao" rows="3" placeholder="Informações complementares deste título"></textarea></div>'
      + '</div>'
      + '<button class="btn-add" onclick="tfAddTitulo()">' + btnLabel + '</button>'
    )
    + financeiroPanel('importar', 'Importar titulos via planilha', importPanelBody)
    + financeiroPanel('filtros', 'Filtros', filtrosHtml)
    + financeiroPanel('lista', tituloAtivo, areaHtml);

  initMoneyInputs(root);
  initFlexibleDateInputs(root);
  initDrag('financeiro', COLS_TITULOS, renderFinanceiro);
}
