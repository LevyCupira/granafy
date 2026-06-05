// EXTRATO.JS - Conta corrente (Supabase)

var _exTipo = 'credito';
var _exFiltroTipo = 'todos';
var _exFiltroCat = '';
var _exFiltroPeriodoModo = 'mes';
var _exFiltroPeriodoValor = getPreviousMonthKey();
var _exFiltroConta = '';
var _exFiltroRelacionamento = '';
var _exFiltroConciliacao = 'todos';
var _exFiltroEstorno = 'todos';
var _exFiltroValorModo = 'todos';
var _exFiltroValor = 0;
var _exFiltroBusca = '';
var _exSelecaoLote = false;
var _exSelecionados = new Set();
var _exMostrarDuplicados = false;
var _exManterDuplicado = {};
var _exDuplicadosResolvidos = carregarDuplicadosResolvidosExtrato();
var _exPanels = {
  contas: false,
  relacionamentos: false,
  importar: false,
  novo: false,
  filtros: false
};

function toggleExtratoPanel(key) {
  _exPanels[key] = !_exPanels[key];
  renderExtrato();
}

function extratoPanel(key, title, body) {
  var open = !!_exPanels[key];
  return '<div class="form-card collapsible-card extrato-collapsible-card' + (open ? ' open' : '') + '">'
    + '<button type="button" class="collapse-head" onclick="toggleExtratoPanel(\'' + key + '\')" aria-expanded="' + open + '">'
    + '<span>' + title + '</span>'
    + '<span class="collapse-chevron" aria-hidden="true">&#9662;</span>'
    + '</button>'
    + (open ? '<div class="collapse-body">' + body + '</div>' : '')
    + '</div>';
}

function normalizarDataImportada(rawDate) {
  if (typeof rawDate === 'number' && !isNaN(rawDate)) {
    var dNum = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
    return dNum.toISOString().slice(0, 10);
  }

  var texto = String(rawDate || '').trim();
  if (!texto) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  var dm = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dm) return dm[3] + '-' + dm[2].padStart(2, '0') + '-' + dm[1].padStart(2, '0');
  return '';
}

function lerValorImportadoExtrato(rawVal) {
  if (typeof rawVal === 'number') return rawVal;
  return parseFloat(String(rawVal).replace(/[^0-9,.-]/g, '').replace(',', '.')) || 0;
}

function inferirTipoImportadoExtrato(valor) {
  return Number(valor || 0) < 0 ? 'debito' : 'credito';
}

function normalizePeriodoFiltroExtrato(rawValue, modo) {
  var texto = String(rawValue || '').trim();
  if (!texto) return '';
  if (modo === 'dia') {
    return normalizeFlexibleDateInput(texto);
  }
  if (modo === 'mes') {
    if (/^\d{4}-\d{2}$/.test(texto)) return texto;
    var compact = texto.replace(/\D/g, '');
    if (compact.length === 6) {
      var mesCompacto = compact.slice(0, 2);
      var anoCompacto = compact.slice(2, 6);
      if (Number(mesCompacto) >= 1 && Number(mesCompacto) <= 12) return anoCompacto + '-' + mesCompacto;
    }
    var matchMes = texto.match(/^(\d{1,2})[\/\-](\d{4})$/);
    if (matchMes) {
      var mes = String(matchMes[1]).padStart(2, '0');
      if (Number(mes) >= 1 && Number(mes) <= 12) return matchMes[2] + '-' + mes;
    }
    if (/^\d{1,2}$/.test(texto)) {
      var mesAtual = String(texto).padStart(2, '0');
      if (Number(mesAtual) >= 1 && Number(mesAtual) <= 12) return String(new Date().getFullYear()) + '-' + mesAtual;
    }
    return '';
  }
  if (modo === 'ano') {
    var ano = texto.replace(/\D/g, '');
    return ano.length === 4 ? ano : '';
  }
  return '';
}

function extratoPeriodoBate(dataIso) {
  if (!_exFiltroPeriodoValor) return true;
  var data = String(dataIso || '');
  if (_exFiltroPeriodoModo === 'dia') return data === _exFiltroPeriodoValor;
  if (_exFiltroPeriodoModo === 'ano') return data.slice(0, 4) === _exFiltroPeriodoValor;
  return data.slice(0, 7) === _exFiltroPeriodoValor;
}

function extratoPeriodoPlaceholder() {
  if (_exFiltroPeriodoModo === 'dia') return 'dd/mm/aaaa';
  if (_exFiltroPeriodoModo === 'ano') return 'aaaa';
  return 'mm/aaaa';
}

function extratoPeriodoDisplayValue() {
  if (!_exFiltroPeriodoValor) return '';
  if (_exFiltroPeriodoModo === 'dia') return formatDate(_exFiltroPeriodoValor);
  if (_exFiltroPeriodoModo === 'ano') return _exFiltroPeriodoValor;
  var parts = String(_exFiltroPeriodoValor).split('-');
  return parts.length === 2 ? parts[1] + '/' + parts[0] : _exFiltroPeriodoValor;
}

function extratoValorBate(valorLancamento) {
  if (_exFiltroValorModo === 'todos' || !_exFiltroValor) return true;
  var comparado = Math.abs(Number(valorLancamento || 0));
  if (_exFiltroValorModo === 'acima') return comparado >= Number(_exFiltroValor || 0);
  if (_exFiltroValorModo === 'abaixo') return comparado <= Number(_exFiltroValor || 0);
  return comparado === Number(_exFiltroValor || 0);
}

function atualizarPlaceholdersFiltrosExtrato() {
  var periodoInput = document.getElementById('ex-filtro-periodo');
  var periodoModo = document.getElementById('ex-filtro-periodo-modo');
  if (periodoInput && periodoModo) {
    var modo = periodoModo.value || 'mes';
    periodoInput.placeholder = modo === 'dia' ? 'dd/mm/aaaa' : (modo === 'ano' ? 'aaaa' : 'mm/aaaa');
  }
}

function extratoImportGuideHtml() {
  return '<div class="import-guide">'
    + '<div class="import-guide-head">Formato da planilha</div>'
    + '<div class="import-guide-grid">'
    + '<span class="import-guide-chip required">data</span>'
    + '<span class="import-guide-chip required">descricao</span>'
    + '<span class="import-guide-chip required">valor</span>'
    + '<span class="import-guide-chip">categoria</span>'
    + '</div>'
    + '<ul class="import-guide-list">'
    + '<li>Valor positivo vira <strong>credito</strong>.</li>'
    + '<li>Valor negativo vira <strong>debito</strong>.</li>'
    + '<li>A coluna <strong>tipo</strong> nao e mais necessaria.</li>'
    + '</ul>'
    + '</div>';
}

function contasClienteAtivo() {
  var c = data.clients[activeClient];
  return c && Array.isArray(c.contas) ? c.contas : [];
}

function clienteAtivoEhPJ() {
  var c = data.clients[activeClient];
  return !!(c && String(c.tipoCliente || '').toLowerCase() === 'pj');
}

function extratoRelacionamentoAtivo() {
  return false;
}

function extratoCentroCustoAtivo() {
  return false;
}

function extratoCategoriasOptionsHtml(categoriaAtual, incluirVazio) {
  var atual = String(categoriaAtual || '').trim();
  var categorias = typeof nomesCC === 'function' ? nomesCC().slice() : [];
  if (atual && !categorias.some(function(nome) { return normalizarNomeCategoria(nome) === normalizarNomeCategoria(atual); })) {
    categorias.push(atual);
  }
  categorias = categorias.sort(compararCategoriaNome);
  var inicio = incluirVazio === false ? '' : '<option value="">Selecione</option>';
  return inicio + categorias.map(function(nome) {
    return '<option value="' + esc(nome) + '"' + (normalizarNomeCategoria(nome) === normalizarNomeCategoria(atual) ? ' selected' : '') + '>' + esc(nome) + '</option>';
  }).join('');
}

function extratoRateiosValidos(lanc) {
  return typeof normalizarRateiosCategorias === 'function' ? normalizarRateiosCategorias(lanc && lanc.rateios) : [];
}

function extratoTemRateio(lanc) {
  return extratoRateiosValidos(lanc).length > 0;
}

function extratoStatusEstornoValor(lanc) {
  var status = String((lanc && lanc.estornoStatus) || 'normal').toLowerCase().trim();
  if (status !== 'pendente_estorno' && status !== 'estornado') return 'normal';
  return status;
}

function extratoLancamentoOrigemDoEstorno(cliente, lancamentoId) {
  if (!cliente || !lancamentoId) return null;
  return (cliente.extrato || []).find(function(item) {
    return item && item.estornoLancamentoId === lancamentoId;
  }) || null;
}

function extratoLancamentoEhEstornoVinculado(cliente, lancamentoId) {
  return !!extratoLancamentoOrigemDoEstorno(cliente, lancamentoId);
}

function extratoClasseEstornoLinha(cliente, lanc) {
  if (extratoLancamentoEhEstornoVinculado(cliente, lanc && lanc.id)) return 'row-estorno-vinculado';
  var status = extratoStatusEstornoValor(lanc);
  if (status === 'pendente_estorno') return 'row-estorno-pendente';
  if (status === 'estornado') return 'row-estorno-concluido';
  return '';
}

function extratoResumoEstorno(cliente, lanc) {
  var origem = extratoLancamentoOrigemDoEstorno(cliente, lanc && lanc.id);
  if (origem) {
    return '<span class="badge badge-estorno-vinculado">Lancamento de estorno</span> de ' + esc(origem.desc || origem.descOriginal || '-') + ' ' + fmt(origem.valor || 0);
  }

  var status = extratoStatusEstornoValor(lanc);
  if (status === 'pendente_estorno') {
    return '<span class="badge badge-estorno-pendente">Pendente de estorno</span>'
      + (lanc && lanc.estornoObservacao ? ' ' + esc(lanc.estornoObservacao) : '');
  }

  if (status === 'estornado') {
    var destino = lanc && lanc.estornoLancamentoId ? (cliente.extrato || []).find(function(item) { return item.id === lanc.estornoLancamentoId; }) : null;
    var texto = '<span class="badge badge-estorno-concluido">Ja estornado</span>';
    if (lanc && lanc.estornoData) texto += ' em ' + esc(formatDate(lanc.estornoData));
    if (destino) texto += ' · vinculado a ' + esc(destino.desc || destino.descOriginal || '-') + ' ' + fmt(destino.valor || 0);
    if (lanc && lanc.estornoObservacao) texto += ' · ' + esc(lanc.estornoObservacao);
    return texto;
  }

  return '';
}

function extratoLancamentosElegiveisEstorno(cliente, lanc) {
  if (!cliente || !lanc) return [];
  var tipoEsperado = lanc.tipo === 'credito' ? 'debito' : 'credito';
  var usadoPorOutro = {};
  (cliente.extrato || []).forEach(function(item) {
    if (item && item.estornoLancamentoId && item.id !== lanc.id) usadoPorOutro[item.estornoLancamentoId] = item.id;
  });

  return (cliente.extrato || []).filter(function(item) {
    if (!item || !item.id || item.id === lanc.id) return false;
    if (item.tipo !== tipoEsperado) return false;
    if (usadoPorOutro[item.id] && item.id !== lanc.estornoLancamentoId) return false;
    return true;
  }).sort(function(a, b) {
    var matchA = Math.abs(Number(a.valor || 0) - Number(lanc.valor || 0)) < 0.005 ? 0 : 1;
    var matchB = Math.abs(Number(b.valor || 0) - Number(lanc.valor || 0)) < 0.005 ? 0 : 1;
    if (matchA !== matchB) return matchA - matchB;
    if ((b.data || '') !== (a.data || '')) return String(b.data || '').localeCompare(String(a.data || ''));
    return String(a.desc || a.descOriginal || '').localeCompare(String(b.desc || b.descOriginal || ''), 'pt-BR');
  });
}

function extratoEstornoOptionsHtml(cliente, lanc, selecionadoId) {
  var itens = extratoLancamentosElegiveisEstorno(cliente, lanc);
  if (!itens.length) return '<option value="">Nenhum lancamento elegivel</option>';
  return '<option value="">Selecione o estorno no extrato</option>' + itens.map(function(item) {
    return '<option value="' + esc(item.id) + '" data-data="' + esc(item.data || '') + '"' + (item.id === selecionadoId ? ' selected' : '') + '>'
      + esc(formatDate(item.data))
      + ' · ' + esc(item.desc || item.descOriginal || '-')
      + ' · ' + esc(item.tipo === 'credito' ? 'Credito' : 'Debito')
      + ' · ' + esc(fmt(item.valor || 0))
      + '</option>';
  }).join('');
}

function resumoRateioExtrato(lanc) {
  var rateios = extratoRateiosValidos(lanc);
  if (!rateios.length) return '';
  return 'Rateio: ' + rateios.map(function(item) {
    return item.categoria + ' ' + fmt(item.valor);
  }).join(' · ');
}

function extratoCategoriaBadgeHtml(lanc) {
  if (extratoTemRateio(lanc)) {
    return '<span class="badge badge-rateio">Rateado</span>';
  }
  return '<span class="badge badge-cat">' + esc((lanc && lanc.cat) || '-') + '</span>';
}

function extratoResumoSaldoDiaHtml(dataDia, itens, colspan, saldoAnterior) {
  var creditos = itens.filter(function(item) { return item.tipo === 'credito'; }).reduce(function(soma, item) {
    return soma + Number(item.valor || 0);
  }, 0);
  var debitos = itens.filter(function(item) { return item.tipo === 'debito'; }).reduce(function(soma, item) {
    return soma + Number(item.valor || 0);
  }, 0);
  var saldoMovimentoDia = creditos - debitos;
  var saldoAcumulado = Number(saldoAnterior || 0) + saldoMovimentoDia;
  return {
    html: '<tr class="row-day-balance">'
      + '<td colspan="' + colspan + '">'
      + '<div class="day-balance-row">'
      + '<strong>Total ' + esc(formatDate(dataDia)) + '</strong>'
      + '<span>Creditos ' + fmt(creditos) + '</span>'
      + '<span>Debitos ' + fmt(debitos) + '</span>'
      + '<span>Movimento ' + fmt(saldoMovimentoDia) + '</span>'
      + '<span class="' + (saldoAcumulado >= 0 ? 'green' : 'red') + '">Saldo acumulado ' + fmt(saldoAcumulado) + '</span>'
      + '</div>'
      + '</td>'
      + '</tr>',
    saldoAcumulado: saldoAcumulado
  };
}

function extratoIgnoraConciliacao(lanc) {
  var descricao = String((lanc && (lanc.desc || lanc.descOriginal)) || '').trim().toLowerCase();
  return descricao === 'saldo inicial';
}

function extratoPendenteConciliacao(cliente, lanc) {
  if (!lanc) return false;
  if (extratoIgnoraConciliacao(lanc)) return false;
  if (valorConciliadoDoLancamento(lanc) > 0) return false;
  if (extratoStatusEstornoValor(lanc) === 'estornado') return false;
  if (extratoLancamentoEhEstornoVinculado(cliente, lanc.id)) return false;
  return true;
}

function extratoResolvidoConciliacao(cliente, lanc) {
  return !!lanc && !extratoPendenteConciliacao(cliente, lanc);
}

function extratoLancamentosFiltrados(cliente) {
  if (!cliente) return [];
  var financeiroPJAtivo = clienteAtivoEhPJ();
  var relacionamentoAtivo = extratoRelacionamentoAtivo();
  var centroCustoAtivo = extratoCentroCustoAtivo();
  var lncs = cliente.extrato || [];
  return lncs.filter(function(l) {
    var texto = ((l.desc || '') + ' ' + (l.cat || '') + ' ' + (centroCustoAtivo ? nomeCentroCustoPorId(cliente, l.centroCustoId) : '') + ' ' + (relacionamentoAtivo ? nomeRelacionamentoPorId(cliente, l.relacionamentoId) : '') + ' ' + (l.observacao || '') + ' ' + (l.estornoObservacao || '')).toLowerCase();
    var pendenteConciliacao = extratoPendenteConciliacao(cliente, l);
    var resolvidoConciliacao = extratoResolvidoConciliacao(cliente, l);
    var statusEstorno = extratoStatusEstornoValor(l);
    var ehLancamentoDeEstorno = extratoLancamentoEhEstornoVinculado(cliente, l.id);
    if (_exFiltroTipo !== 'todos' && l.tipo !== _exFiltroTipo) return false;
    if (_exFiltroCat && l.cat !== _exFiltroCat) return false;
    if (!extratoPeriodoBate(l.data || '')) return false;
    if (_exFiltroConta && l.contaId !== _exFiltroConta) return false;
    if (relacionamentoAtivo && _exFiltroRelacionamento && l.relacionamentoId !== _exFiltroRelacionamento) return false;
    if (financeiroPJAtivo && _exFiltroConciliacao === 'conciliados' && !resolvidoConciliacao) return false;
    if (financeiroPJAtivo && _exFiltroConciliacao === 'nao_conciliados' && !pendenteConciliacao) return false;
    if (financeiroPJAtivo && _exFiltroEstorno === 'pendentes_estorno' && statusEstorno !== 'pendente_estorno') return false;
    if (financeiroPJAtivo && _exFiltroEstorno === 'estornados' && statusEstorno !== 'estornado' && !ehLancamentoDeEstorno) return false;
    if (!extratoValorBate(l.valor || 0)) return false;
    if (_exFiltroBusca && !texto.includes(_exFiltroBusca)) return false;
    return true;
  });
}

function exportExtratoXlsx() {
  if (!activeClient) return alert('Selecione um cliente.');
  var cliente = data.clients[activeClient];
  var filtrados = extratoLancamentosFiltrados(cliente);
  if (!filtrados.length) return alert('Nao ha dados para exportar com os filtros atuais.');
  var rows = filtrados
    .slice()
    .sort(function(a, b) { return String(b.data || '').localeCompare(String(a.data || '')); })
    .map(function(l) {
      var conta = (contasClienteAtivo() || []).find(function(item) { return item.id === l.contaId; });
      return [
        {
          Data: formatDate(l.data),
          Conta: nomeContaCliente(conta || null),
          Descricao: l.desc || '',
          Categoria: extratoTemRateio(l) ? 'Rateado' : (l.cat || ''),
          Tipo: l.tipo === 'credito' ? 'Credito' : 'Debito',
          Valor: Number(l.valor || 0),
          Conciliacao: resumoConciliacaoLancamento(l),
          Devolucao: extratoResumoEstorno(cliente, l).replace(/<[^>]+>/g, ''),
          Rateio: resumoRateioExtrato(l).replace(/^Rateio:\s*/, ''),
          Observacao: l.observacao || ''
        }
      ];
    }).map(function(item) { return item[0]; });
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Cliente', cliente.name || ''],
    ['Tipo', _exFiltroTipo || 'todos'],
    ['Categoria', _exFiltroCat || 'todas'],
    ['Periodo', (_exFiltroPeriodoValor ? (_exFiltroPeriodoModo + ': ' + extratoPeriodoDisplayValue()) : 'todos')],
    ['Conta', _exFiltroConta || 'todas'],
    ['Valor', (_exFiltroValorModo === 'todos' || !_exFiltroValor) ? 'todos' : (_exFiltroValorModo + ': ' + fmt(_exFiltroValor))],
    ['Busca', _exFiltroBusca || ''],
    ['Gerado em', new Date().toLocaleString('pt-BR')]
  ]), 'Resumo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows, {
    header: ['Data', 'Conta', 'Descricao', 'Categoria', 'Tipo', 'Valor', 'Conciliacao', 'Devolucao', 'Rateio', 'Observacao']
  }), 'Extrato');
  XLSX.writeFile(
    wb,
    'granafy_extrato_' + String(cliente.name || 'cliente').toLowerCase().replace(/\s+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx'
  );
}

function exportExtratoPDF() {
  var jsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDF) return alert('Biblioteca PDF nao carregada.');
  if (!activeClient) return alert('Selecione um cliente.');
  var cliente = data.clients[activeClient];
  var filtrados = extratoLancamentosFiltrados(cliente);
  if (!filtrados.length) return alert('Nao ha dados para exportar com os filtros atuais.');
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
  doc.text('Extrato - ' + (cliente.name || ''), 14, 19);
  doc.text('Gerado em ' + hoje, 283, 19, { align: 'right' });
  doc.setFontSize(9);
  doc.setTextColor(90, 96, 122);
  doc.text('Filtros: tipo ' + (_exFiltroTipo || 'todos') + ' | categoria ' + (_exFiltroCat || 'todas') + ' | periodo ' + (_exFiltroPeriodoValor ? (_exFiltroPeriodoModo + ' ' + extratoPeriodoDisplayValue()) : 'todos') + ' | valor ' + ((_exFiltroValorModo === 'todos' || !_exFiltroValor) ? 'todos' : (_exFiltroValorModo + ' ' + fmt(_exFiltroValor))) + ' | busca ' + (_exFiltroBusca || '-'), 14, 31);
  doc.autoTable({
    startY: 36,
    head: [['Data', 'Conta', 'Descricao', 'Categoria', 'Tipo', 'Valor', 'Conciliacao/Rateio']],
    body: filtrados
      .slice()
      .sort(function(a, b) { return String(b.data || '').localeCompare(String(a.data || '')); })
      .map(function(l) {
        var conta = (contasClienteAtivo() || []).find(function(item) { return item.id === l.contaId; });
        var detalhes = [];
        var conc = resumoConciliacaoLancamento(l);
        var rateio = resumoRateioExtrato(l);
        var estorno = extratoResumoEstorno(cliente, l).replace(/<[^>]+>/g, '');
        if (conc) detalhes.push(conc);
        if (rateio) detalhes.push(rateio);
        if (estorno) detalhes.push(estorno);
        return [
          formatDate(l.data),
          nomeContaCliente(conta || null),
          l.desc || '',
          extratoTemRateio(l) ? 'Rateado' : (l.cat || '-'),
          l.tipo === 'credito' ? 'Credito' : 'Debito',
          (l.tipo === 'credito' ? fmt(l.valor || 0) : ('- ' + fmt(l.valor || 0))),
          detalhes.join(' | ')
        ];
      }),
    styles: { fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [91, 140, 255], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 246, 250] },
    columnStyles: { 5: { halign: 'right' } },
    margin: { left: 14, right: 14 }
  });
  doc.save(
    'granafy_extrato_' + String(cliente.name || 'cliente').toLowerCase().replace(/\s+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.pdf'
  );
}

function openExtratoRateioModal(i) {
  var c = data.clients[activeClient];
  var lanc = c && c.extrato ? c.extrato[i] : null;
  if (!lanc || !lanc.id) return;

  document.getElementById('modalTitle').textContent = 'Rateio por categoria';
  document.getElementById('modalBody').innerHTML =
    '<div class="settings-section-card">'
      + '<div class="settings-card-head"><div><h5>' + esc(lanc.desc || 'Lancamento') + '</h5><p>Distribua o valor total desse lancamento entre as categorias do Extrato.</p></div>'
      + '<div class="settings-card-badges"><span class="settings-card-badge subtle">Tipo ' + esc(lanc.tipo === 'credito' ? 'Credito' : 'Debito') + '</span><span class="settings-card-badge">' + fmt(lanc.valor || 0) + '</span></div></div>'
      + '<div id="ex-rateio-rows"></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn-sm" type="button" onclick="adicionarLinhaRateioExtrato()">+ Linha de rateio</button><button class="btn-sm red" type="button" onclick="limparRateioExtrato()">Limpar rateio</button></div>'
      + '<div id="ex-rateio-resumo" style="margin-top:12px;color:var(--muted);font-size:.85rem"></div>'
    + '</div>'
    + '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:18px">'
      + '<button class="btn-sm red" type="button" onclick="closeModal()">Cancelar</button>'
      + '<button class="btn-add" type="button" style="margin-top:0" onclick="salvarRateioExtrato(' + i + ')">Salvar rateio</button>'
    + '</div>';

  document.getElementById('modalOverlay').classList.add('open');
  document.addEventListener('keydown', handleMainModalEscape);
  document.getElementById('modalBody').dataset.rateioValor = String(Number(lanc.valor || 0));

  var rateios = extratoRateiosValidos(lanc);
  if (!rateios.length) adicionarLinhaRateioExtrato(lanc.cat || 'Outros', Number(lanc.valor || 0));
  else rateios.forEach(function(item) { adicionarLinhaRateioExtrato(item.categoria, item.valor); });
  atualizarResumoRateioExtrato(lanc.valor || 0);
}

function adicionarLinhaRateioExtrato(categoria, valor) {
  var host = document.getElementById('ex-rateio-rows');
  if (!host) return;
  var row = document.createElement('div');
  row.className = 'form-row ex-rateio-row';
  row.innerHTML =
    '<div class="form-group"><label>Categoria</label><select class="ex-rateio-cat">' + extratoCategoriasOptionsHtml(categoria || '', false) + '</select></div>'
    + '<div class="form-group" style="max-width:180px"><label>Valor</label><input type="text" class="money-input ex-rateio-valor" value="' + esc(Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '"/></div>'
    + '<div class="form-group" style="max-width:110px;align-self:flex-end"><button class="btn-sm red" type="button">Remover</button></div>';
  host.appendChild(row);
  initMoneyInputs(row);
  row.querySelector('.ex-rateio-cat').addEventListener('change', atualizarResumoRateioExtrato);
  row.querySelector('.ex-rateio-valor').addEventListener('input', atualizarResumoRateioExtrato);
  row.querySelector('button').addEventListener('click', function() { row.remove(); atualizarResumoRateioExtrato(); });
}

function coletarRateioExtratoModal() {
  return Array.from(document.querySelectorAll('.ex-rateio-row')).map(function(row) {
    return {
      categoria: ((row.querySelector('.ex-rateio-cat') || {}).value || '').trim(),
      valor: parseMoney(row.querySelector('.ex-rateio-valor'))
    };
  }).filter(function(item) { return item.categoria && Number(item.valor || 0) > 0; });
}

function atualizarResumoRateioExtrato(valorOriginal) {
  var info = document.getElementById('ex-rateio-resumo');
  if (!info) return;
  var rows = coletarRateioExtratoModal();
  var total = rows.reduce(function(sum, item) { return sum + Number(item.valor || 0); }, 0);
  var modalBody = document.getElementById('modalBody');
  var base = Number(typeof valorOriginal !== 'undefined' ? valorOriginal : ((modalBody && modalBody.dataset && modalBody.dataset.rateioValor) || 0));
  var diff = Math.abs(total - base);
  info.innerHTML = 'Rateado: <strong>' + fmt(total) + '</strong> · Total do lancamento: <strong>' + fmt(base) + '</strong>'
    + (diff < 0.005 ? ' <span style="color:var(--success)">· Conferido</span>' : ' <span style="color:var(--danger)">· Diferenca ' + fmt(diff) + '</span>');
}

function limparRateioExtrato() {
  var host = document.getElementById('ex-rateio-rows');
  if (!host) return;
  host.innerHTML = '';
  atualizarResumoRateioExtrato();
}

async function salvarRateioExtrato(i) {
  var c = data.clients[activeClient];
  var lanc = c && c.extrato ? c.extrato[i] : null;
  if (!lanc || !lanc.id) return;
  var rows = coletarRateioExtratoModal();
  if (!rows.length) {
    var ok = await appConfirm('Nenhum rateio foi informado. Deseja limpar o rateio desse lancamento?', { title: 'Limpar rateio', confirmText: 'Limpar' });
    if (!ok) return;
  }
  var total = rows.reduce(function(sum, item) { return sum + Number(item.valor || 0); }, 0);
  if (rows.length && Math.abs(total - Number(lanc.valor || 0)) >= 0.005) {
    await appAlert('O total do rateio deve ser igual ao valor do lancamento.');
    return;
  }
  var response = await applyUserScope(
    supabaseClient.from('lancamentos').update({ rateio_categorias: rows }).eq('id', lanc.id)
  ).select().single();
  if (response.error) {
    console.error(response.error);
    await appAlert('Nao foi possivel salvar o rateio. Rode a migracao sql/20260602_rateio_categorias_extrato.sql no Supabase.');
    return;
  }
  lanc.rateios = extratoRateiosValidos({ rateios: response.data.rateio_categorias || rows });
  closeModal();
  renderExtrato();
}

function syncExtratoEstornoData() {
  var select = document.getElementById('ex-estorno-lancamento');
  var dataInput = document.getElementById('ex-estorno-data');
  if (!select || !dataInput) return;
  var option = select.options[select.selectedIndex];
  if (option && option.dataset && option.dataset.data) {
    dataInput.value = option.dataset.data;
  }
}

function atualizarCamposExtratoEstornoModal() {
  var status = ((document.getElementById('ex-estorno-status') || {}).value || 'normal');
  var blocos = document.querySelectorAll('[data-estorno-status-block]');
  blocos.forEach(function(bloco) {
    bloco.style.display = bloco.getAttribute('data-estorno-status-block') === status ? '' : 'none';
  });
}

function openExtratoEstornoModal(i) {
  var c = data.clients[activeClient];
  var lanc = c && c.extrato ? c.extrato[i] : null;
  if (!lanc || !lanc.id) return;

  var origem = extratoLancamentoOrigemDoEstorno(c, lanc.id);
  if (origem) {
    document.getElementById('modalTitle').textContent = 'Lancamento de estorno';
    document.getElementById('modalBody').innerHTML =
      '<div class="settings-section-card">'
        + '<div class="settings-card-head"><div><h5>Este lancamento ja foi usado como estorno</h5><p>Ele esta vinculado a um pagamento ou recebimento marcado para devolucao.</p></div></div>'
        + '<div class="settings-card-badges"><span class="settings-card-badge">Estorno vinculado</span><span class="settings-card-badge subtle">' + esc(formatDate(lanc.data)) + '</span><span class="settings-card-badge subtle">' + esc(fmt(lanc.valor || 0)) + '</span></div>'
        + '<div class="settings-note-box">Origem: <strong>' + esc(origem.desc || origem.descOriginal || '-') + '</strong>' + (origem.estornoData ? ' · marcado em ' + esc(formatDate(origem.estornoData)) : '') + '</div>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:18px">'
        + '<button class="btn-sm red" type="button" onclick="closeModal()">Fechar</button>'
      + '</div>';
    document.getElementById('modalOverlay').classList.add('open');
    document.addEventListener('keydown', handleMainModalEscape);
    return;
  }

  var statusAtual = extratoStatusEstornoValor(lanc);
  var selectHtml = extratoEstornoOptionsHtml(c, lanc, lanc.estornoLancamentoId || '');
  var dataEstorno = lanc.estornoData || '';

  document.getElementById('modalTitle').textContent = 'Controle de devolucao';
  document.getElementById('modalBody').innerHTML =
    '<div class="settings-section-card" style="margin-bottom:16px">'
      + '<div class="settings-card-head"><div><h5>Pagamento ou recebimento</h5><p>Marque este lancamento como pendente de estorno ou vincule o lancamento que efetivou a devolucao no extrato.</p></div></div>'
      + '<div class="settings-card-badges">'
        + '<span class="settings-card-badge subtle">' + esc(formatDate(lanc.data)) + '</span>'
        + '<span class="settings-card-badge subtle">' + esc(lanc.tipo === 'credito' ? 'Credito' : 'Debito') + '</span>'
        + '<span class="settings-card-badge">' + esc(fmt(lanc.valor || 0)) + '</span>'
      + '</div>'
      + '<div class="settings-note-box" style="margin-top:14px">' + esc(lanc.descOriginal || lanc.desc || '-') + '</div>'
    + '</div>'
    + '<div class="settings-section-card">'
      + '<div class="form-row">'
        + '<div class="form-group" style="max-width:220px"><label>Status da devolucao</label><select id="ex-estorno-status" onchange="atualizarCamposExtratoEstornoModal()"><option value="normal"' + (statusAtual === 'normal' ? ' selected' : '') + '>Sem devolucao</option><option value="pendente_estorno"' + (statusAtual === 'pendente_estorno' ? ' selected' : '') + '>Pendente de estorno</option><option value="estornado"' + (statusAtual === 'estornado' ? ' selected' : '') + '>Ja estornado</option></select></div>'
      + '</div>'
      + '<div data-estorno-status-block="pendente_estorno" style="display:none">'
        + '<div class="form-row"><div class="form-group"><label>Observacao</label><input type="text" id="ex-estorno-obs-pendente" value="' + esc(statusAtual === 'pendente_estorno' ? (lanc.estornoObservacao || '') : '') + '" placeholder="Ex.: valor recebido em duplicidade, cliente cancelou."/></div></div>'
      + '</div>'
      + '<div data-estorno-status-block="estornado" style="display:none">'
        + '<div class="form-row">'
          + '<div class="form-group"><label>Lancamento do estorno no extrato</label><select id="ex-estorno-lancamento" onchange="syncExtratoEstornoData()">' + selectHtml + '</select></div>'
        + '</div>'
        + '<div class="form-row">'
          + '<div class="form-group" style="max-width:180px"><label>Data da devolucao</label><input type="date" id="ex-estorno-data" value="' + esc(dataEstorno) + '"/></div>'
          + '<div class="form-group"><label>Observacao</label><input type="text" id="ex-estorno-obs-concluido" value="' + esc(statusAtual === 'estornado' ? (lanc.estornoObservacao || '') : '') + '" placeholder="Ex.: estorno realizado no banco."/></div>'
        + '</div>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:14px">'
        + '<button class="btn-sm red" type="button" onclick="closeModal()">Cancelar</button>'
        + '<button class="btn-add" type="button" style="margin-top:0" onclick="salvarExtratoEstorno(' + i + ')">Salvar devolucao</button>'
      + '</div>'
    + '</div>';

  document.getElementById('modalOverlay').classList.add('open');
  document.addEventListener('keydown', handleMainModalEscape);
  atualizarCamposExtratoEstornoModal();
  if (statusAtual === 'estornado') syncExtratoEstornoData();
}

async function salvarExtratoEstorno(i) {
  var c = data.clients[activeClient];
  var lanc = c && c.extrato ? c.extrato[i] : null;
  if (!lanc || !lanc.id) return;

  var status = ((document.getElementById('ex-estorno-status') || {}).value || 'normal');
  var payload = {
    status_estorno: 'normal',
    estorno_lancamento_id: null,
    estorno_data: null,
    estorno_observacao: null
  };

  if (status === 'pendente_estorno') {
    payload.status_estorno = 'pendente_estorno';
    payload.estorno_observacao = (((document.getElementById('ex-estorno-obs-pendente') || {}).value) || '').trim() || null;
  }

  if (status === 'estornado') {
    var lancamentoEstornoId = (((document.getElementById('ex-estorno-lancamento') || {}).value) || '').trim();
    var dataEstorno = ((document.getElementById('ex-estorno-data') || {}).value || '').trim();
    var observacaoEstorno = (((document.getElementById('ex-estorno-obs-concluido') || {}).value) || '').trim();

    if (!lancamentoEstornoId) {
      await appAlert('Selecione o lancamento do extrato que efetivou o estorno.');
      return;
    }

    var lancamentoEstorno = (c.extrato || []).find(function(item) { return item.id === lancamentoEstornoId; });
    if (!lancamentoEstorno) {
      await appAlert('Lancamento de estorno nao encontrado.');
      return;
    }

    var origemExistente = extratoLancamentoOrigemDoEstorno(c, lancamentoEstornoId);
    if (origemExistente && origemExistente.id !== lanc.id) {
      await appAlert('Esse lancamento ja esta vinculado como estorno de outro registro.');
      return;
    }

    if (lancamentoEstorno.tipo === lanc.tipo) {
      await appAlert('O lancamento vinculado ao estorno precisa ter tipo oposto ao original.');
      return;
    }

    payload.status_estorno = 'estornado';
    payload.estorno_lancamento_id = lancamentoEstornoId;
    payload.estorno_data = dataEstorno || lancamentoEstorno.data || null;
    payload.estorno_observacao = observacaoEstorno || null;
  }

  var response = await applyUserScope(
    supabaseClient
      .from('lancamentos')
      .update(payload)
      .eq('id', lanc.id)
      .select()
      .single()
  );

  if (response.error) {
    console.error(response.error);
    await appAlert('Nao foi possivel salvar a devolucao. Rode a migracao sql/20260602_status_devolucao_extrato.sql no Supabase.');
    return;
  }

  lanc.estornoStatus = response.data.status_estorno || 'normal';
  lanc.estornoLancamentoId = response.data.estorno_lancamento_id || null;
  lanc.estornoData = response.data.estorno_data || null;
  lanc.estornoObservacao = response.data.estorno_observacao || '';

  closeModal();
  renderExtrato();
}

function aplicarAjustesVisuaisExtrato(area, lncs) {
  if (!area) return;
  var cliente = data.clients[activeClient];

  area.querySelectorAll('.val-pos').forEach(function(el) {
    el.textContent = String(el.textContent || '').replace(/^\+\s*/, '');
  });

  area.querySelectorAll('.row-actions').forEach(function(actions) {
    var editBtn = actions.querySelector('button[onclick*="editExtrato("]');
    if (!editBtn) return;
    var match = String(editBtn.getAttribute('onclick') || '').match(/editExtrato\((\d+)\)/);
    if (!match) return;
    var realIdx = Number(match[1]);
    var lanc = lncs[realIdx];
    if (!lanc) return;

    if (!actions.querySelector('button[title="Rateio"]')) {
      var btn = document.createElement('button');
      btn.className = 'btn-icon';
      btn.type = 'button';
      btn.title = 'Rateio';
      btn.textContent = 'RT';
      btn.addEventListener('click', function() { openExtratoRateioModal(realIdx); });
      actions.insertBefore(btn, actions.firstChild);
    }

    if (clienteAtivoEhPJ() && !actions.querySelector('button[title="Devolucao"]')) {
      var refundBtn = document.createElement('button');
      refundBtn.className = 'btn-icon';
      refundBtn.type = 'button';
      refundBtn.title = 'Devolucao';
      refundBtn.textContent = 'DV';
      refundBtn.addEventListener('click', function() { openExtratoEstornoModal(realIdx); });
      actions.insertBefore(refundBtn, actions.firstChild);
    }

    if (extratoTemRateio(lanc)) {
      var descCell = actions.parentElement && actions.parentElement.previousElementSibling && actions.parentElement.previousElementSibling.previousElementSibling && actions.parentElement.previousElementSibling.previousElementSibling.previousElementSibling;
      if (descCell && !descCell.querySelector('.ex-rateio-note')) {
        var note = document.createElement('div');
        note.className = 'ex-rateio-note';
        note.style.color = 'var(--muted)';
        note.style.fontSize = '.72rem';
        note.style.marginTop = '3px';
        note.textContent = resumoRateioExtrato(lanc);
        descCell.appendChild(note);
      }
    }
  });
}

function centrosCustoClienteAtivo() {
  var c = data.clients[activeClient];
  return c && Array.isArray(c.centrosCustoMeta) ? c.centrosCustoMeta : [];
}

function nomeCentroCustoPorId(cliente, centroCustoId) {
  if (!cliente || !centroCustoId) return '-';
  var centro = (cliente.centrosCustoMeta || []).find(function(item) { return item.id === centroCustoId; });
  return centro ? String(centro.nome || '') : '-';
}

function centrosCustoOptionsCliente(centroCustoIdAtual, incluirVazio) {
  var centros = centrosCustoClienteAtivo().slice().sort(function(a, b) {
    return compararCategoriaNome(String(a && a.nome || ''), String(b && b.nome || ''));
  });
  if (!centros.length) return '<option value="">' + esc(incluirVazio === false ? 'Sem centro cadastrado' : 'Sem centro') + '</option>';
  var inicio = incluirVazio === false ? '' : '<option value="">Sem centro</option>';
  return inicio + centros.map(function(centro) {
    return '<option value="' + esc(centro.id) + '"' + (centro.id === centroCustoIdAtual ? ' selected' : '') + '>' + esc(centro.nome || '') + '</option>';
  }).join('');
}

function naturezaFinanceiraDoExtrato(tipo) {
  return tipo === 'debito' ? 'pagar' : 'receber';
}

function baixasFinanceirasDoLancamento(lanc) {
  if (!lanc || !lanc.id || typeof tfBaixasPorLancamentoId !== 'function') return [];
  return tfBaixasPorLancamentoId(lanc.id, naturezaFinanceiraDoExtrato(lanc.tipo || 'credito'));
}

function valorConciliadoDoLancamento(lanc) {
  if (!lanc || !lanc.id || typeof tfValorConciliadoLancamento !== 'function') return 0;
  return tfValorConciliadoLancamento(lanc.id, naturezaFinanceiraDoExtrato(lanc.tipo || 'credito'));
}

function resumoConciliacaoLancamento(lanc) {
  var baixas = baixasFinanceirasDoLancamento(lanc);
  if (!baixas.length) return '';
  var conciliado = valorConciliadoDoLancamento(lanc);
  var restante = Math.max(0, Number(lanc.valor || 0) - conciliado);
  var prefixo = restante > 0 ? 'Financeiro parcial' : 'Financeiro conciliado';
  return prefixo + ': ' + fmt(conciliado) + (restante > 0 ? ' · saldo pendente ' + fmt(restante) : '');
}

function relacionamentosClienteAtivo() {
  var c = data.clients[activeClient];
  return c && Array.isArray(c.relacionamentos) ? c.relacionamentos : [];
}

function tipoRelacionamentoLabel(tipo) {
  var chave = String(tipo || '').toLowerCase();
  if (chave === 'pf') return 'PF';
  if (chave === 'pj') return 'PJ';
  if (chave === 'terceiro') return 'Terceiro';
  return 'Interno';
}

function nomeRelacionamento(item) {
  return item && item.nome ? item.nome : 'Nao vinculado';
}

function normalizarTextoRelacionamento(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function termosRelacionamento(rel) {
  var set = new Set();
  var base = [rel && rel.nome, rel && rel.palavrasChave];
  base.forEach(function(item) {
    String(item || '')
      .split(/[,;\n|]+/)
      .map(function(parte) { return normalizarTextoRelacionamento(parte); })
      .filter(function(parte) { return parte && parte.length >= 3; })
      .forEach(function(parte) { set.add(parte); });
  });
  return Array.from(set);
}

function sugerirRelacionamentoPorTexto(texto) {
  if (!clienteAtivoEhPJ()) return null;
  var alvo = normalizarTextoRelacionamento(texto);
  if (!alvo) return null;

  var candidatos = relacionamentosClienteAtivo().map(function(rel) {
    var termos = termosRelacionamento(rel);
    var score = 0;

    termos.forEach(function(termo) {
      if (!termo || !alvo.includes(termo)) return;
      var bonus = normalizarTextoRelacionamento(rel.nome) === termo ? 3 : 0;
      score = Math.max(score, termo.length + bonus);
    });

    return {
      rel: rel,
      score: score
    };
  }).filter(function(item) {
    return item.score > 0;
  }).sort(function(a, b) {
    return b.score - a.score;
  });

  if (!candidatos.length) return null;
  if (candidatos[1] && candidatos[1].score === candidatos[0].score && candidatos[1].rel.id !== candidatos[0].rel.id) return null;

  return {
    id: candidatos[0].rel.id,
    nome: nomeRelacionamento(candidatos[0].rel),
    tipo: tipoRelacionamentoLabel(candidatos[0].rel.tipo),
    score: candidatos[0].score
  };
}

function nomeRelacionamentoPorId(cliente, relacionamentoId) {
  if (!cliente || !relacionamentoId) return '-';
  var rel = (cliente.relacionamentos || []).find(item => item.id === relacionamentoId);
  return rel ? nomeRelacionamento(rel) : '-';
}

function relacionamentoOptionsCliente(relacionamentoIdAtual, incluirVazio) {
  var relacionamentos = relacionamentosClienteAtivo().slice().sort(function(a, b) {
    return compararCategoriaNome(nomeRelacionamento(a), nomeRelacionamento(b));
  });

  var inicio = incluirVazio === false ? '' : '<option value="">Nao vinculado</option>';
  return inicio + relacionamentos.map(function(rel) {
    return '<option value="' + esc(rel.id) + '"' + (rel.id === relacionamentoIdAtual ? ' selected' : '') + '>'
      + esc(nomeRelacionamento(rel))
      + ' (' + esc(tipoRelacionamentoLabel(rel.tipo)) + ')'
      + '</option>';
  }).join('');
}

function relacionamentoSuggestionHtml(sugestao, selectId, applyFnName) {
  if (!sugestao) {
    return '<div class="rel-suggestion rel-suggestion-muted">Sem sugestao automatica para este texto.</div>';
  }
  return '<div class="rel-suggestion">'
    + '<span>Sugestao: <strong>' + esc(sugestao.nome) + '</strong> <small>(' + esc(sugestao.tipo) + ')</small></span>'
    + '<button class="btn-sm" type="button" onclick="' + applyFnName + '(\'' + esc(selectId) + '\',\'' + esc(sugestao.id) + '\')">Usar sugestao</button>'
    + '</div>';
}

function aplicarSugestaoRelacionamento(selectId, relacionamentoId) {
  var select = document.getElementById(selectId);
  if (!select) return;
  select.value = relacionamentoId || '';
  select.dataset.relMode = relacionamentoId ? 'auto' : '';
  atualizarSugestaoRelacionamentoNovo();
  atualizarSugestaoRelacionamentoEdicao();
}

function atualizarSelectRelacionamentoPorSugestao(selectId, sugestao) {
  var select = document.getElementById(selectId);
  if (!select) return;
  var modo = select.dataset.relMode || '';
  if (!select.value || modo === 'auto') {
    select.value = sugestao ? sugestao.id : '';
    select.dataset.relMode = sugestao ? 'auto' : '';
  }
}

function atualizarSugestaoRelacionamentoNovo() {
  if (!clienteAtivoEhPJ()) return;
  var info = document.getElementById('ex-rel-suggestion');
  var select = document.getElementById('ex-relacionamento');
  var desc = document.getElementById('ex-desc');
  if (!info || !select || !desc) return;

  var sugestao = sugerirRelacionamentoPorTexto(desc.value || '');
  atualizarSelectRelacionamentoPorSugestao('ex-relacionamento', sugestao);
  info.innerHTML = relacionamentoSuggestionHtml(sugestao, 'ex-relacionamento', 'aplicarSugestaoRelacionamento');
}

function atualizarSugestaoRelacionamentoEdicao() {
  if (!clienteAtivoEhPJ()) return;
  var info = document.getElementById('ex-edit-rel-suggestion');
  var select = document.getElementById('ex-edit-relacionamento');
  var desc = document.getElementById('ex-edit-desc-original');
  if (!info || !select || !desc) return;

  var sugestao = sugerirRelacionamentoPorTexto(desc.value || '');
  atualizarSelectRelacionamentoPorSugestao('ex-edit-relacionamento', sugestao);
  info.innerHTML = relacionamentoSuggestionHtml(sugestao, 'ex-edit-relacionamento', 'aplicarSugestaoRelacionamento');
}

function registrarInteracaoManualRelacionamento(selectId) {
  var select = document.getElementById(selectId);
  if (!select) return;
  select.dataset.relMode = 'manual';
}

function nomeContaCliente(conta) {
  if (!conta) return 'Nao informada';
  var tipo = String(conta.tipo || '').toLowerCase() === 'poupanca' ? 'CP' : 'CC';
  var banco = conta.banco || 'Banco';
  var dados = [conta.agencia, conta.numero].filter(Boolean).join('/');
  return tipo + ' ' + banco + (dados ? ' ' + dados : '');
}

function resumirNumeroConta(numero) {
  var texto = String(numero || '').trim();
  if (!texto) return '';
  if (texto.length <= 6) return texto;
  return '...' + texto.slice(-6);
}

function nomeContaClienteCompacta(conta) {
  if (!conta) return 'Nao informada';
  var tipo = String(conta.tipo || '').toLowerCase() === 'poupanca' ? 'CP' : 'CC';
  var banco = String(conta.banco || 'Banco').trim();
  var numero = resumirNumeroConta(conta.numero || '');
  return tipo + ' ' + banco + (numero ? ' · ' + numero : '');
}

function nomeContaPorId(cliente, contaId) {
  if (!cliente || !contaId) return 'Nao informada';
  var conta = (cliente.contas || []).find(item => item.id === contaId);
  return nomeContaCliente(conta);
}

function nomeContaCompactaPorId(cliente, contaId) {
  if (!cliente || !contaId) return 'Nao informada';
  var conta = (cliente.contas || []).find(item => item.id === contaId);
  return nomeContaClienteCompacta(conta);
}

function contasOptionsCliente(contaIdAtual) {
  var contas = contasClienteAtivo();
  if (!contas.length) return '<option value="">Sem conta cadastrada</option>';

  return '<option value="">Sem conta</option>' + contas.map(conta =>
    '<option value="' + esc(conta.id) + '"' + (conta.id === contaIdAtual ? ' selected' : '') + '>' +
    esc(nomeContaCliente(conta)) +
    '</option>'
  ).join('');
}

function contasOptionsObrigatoriasCliente(contaIdAtual, placeholder) {
  var contas = contasClienteAtivo();
  if (!contas.length) return '<option value="">Sem conta cadastrada</option>';

  return '<option value="">' + esc(placeholder || 'Selecione') + '</option>' + contas.map(conta =>
    '<option value="' + esc(conta.id) + '"' + (conta.id === contaIdAtual ? ' selected' : '') + '>' +
    esc(nomeContaCliente(conta)) +
    '</option>'
  ).join('');
}

function abrirImportacaoExtrato() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var sel = document.getElementById('ex-import-conta');
  if (!sel || !sel.value) {
    alert('Selecione a conta antes de importar o extrato.');
    return;
  }
  document.getElementById('importExtratoXlsxInput').click();
}

function exportExtratoTemplate() {
  var rows = [
    ['data', 'descricao', 'valor', 'categoria'],
    ['01/05/2026', 'Salario', 4200.00, 'Salario'],
    ['02/05/2026', 'Supermercado', -185.70, 'Alimentacao'],
    ['03/05/2026', 'Pix recebido', 150.00, 'Receita extra']
  ];
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:12},{wch:36},{wch:12},{wch:22}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Extrato');
  XLSX.writeFile(wb, 'modelo_extrato_granafy.xlsx');
}

function isMissingContaSchemaError(error) {
  if (!error) return false;
  var msg = String((error.message || '') + ' ' + (error.details || '') + ' ' + (error.hint || '')).toLowerCase();
  return error.code === '42703' || error.code === '42P01' || error.code === 'PGRST204' || error.code === 'PGRST205' || msg.includes('conta_id') || msg.includes('contas') || msg.includes('schema cache');
}

function isMissingRelacionamentoSchemaError(error) {
  if (!error) return false;
  var msg = String((error.message || '') + ' ' + (error.details || '') + ' ' + (error.hint || '')).toLowerCase();
  return error.code === '42703' || error.code === '42P01' || error.code === 'PGRST204' || error.code === 'PGRST205'
    || msg.includes('relacionamento_id')
    || msg.includes('descricao_original')
    || msg.includes('relacionamentos_cliente')
    || msg.includes('palavras_chave')
    || msg.includes('schema cache');
}

function isMissingCentroCustoSchemaError(error) {
  if (!error) return false;
  var msg = String((error.message || '') + ' ' + (error.details || '') + ' ' + (error.hint || '')).toLowerCase();
  return error.code === '42703' || error.code === '42P01' || error.code === 'PGRST204' || error.code === 'PGRST205'
    || msg.includes('centro_custo_id')
    || msg.includes('centros_custo_cliente')
    || msg.includes('schema cache');
}

var BANCOS_COMUNS = [
  'Banco do Brasil',
  'Bradesco',
  'Caixa',
  'Inter',
  'Itau',
  'Nubank',
  'Santander',
  'Sicredi',
  'Sicoob',
  'Outro'
];

var TIPOS_RELACIONAMENTO = [
  { value: 'pf', label: 'Pessoa fisica' },
  { value: 'pj', label: 'Pessoa juridica' },
  { value: 'interno', label: 'Interno' },
  { value: 'terceiro', label: 'Terceiro' }
];

async function insertLancamentoComFallback(payload) {
  var completo = await supabaseClient
    .from('lancamentos')
    .insert([Object.assign({}, payload, getUserScopePayload())]);

  if (!completo.error) return completo;

  var basico = Object.assign({}, payload);

  if (payload.conta_id && isMissingContaSchemaError(completo.error)) {
    delete basico.conta_id;
    console.warn('Tentando salvar lancamento sem conta_id apos erro no schema:', completo.error);
    return supabaseClient
      .from('lancamentos')
      .insert([Object.assign(basico, getUserScopePayload())]);
  }
  if (payload.centro_custo_id && isMissingCentroCustoSchemaError(completo.error)) {
    delete basico.centro_custo_id;
    console.warn('Tentando salvar lancamento sem centro_custo_id apos erro no schema:', completo.error);
    return supabaseClient
      .from('lancamentos')
      .insert([Object.assign(basico, getUserScopePayload())]);
  }
  return completo;
}

async function cadastrarContaCliente() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var conta = await abrirFormularioContaCliente(null);
  if (!conta) return;

  const payload = {
    cliente_id: activeClient,
    tipo: conta.tipo,
    banco: conta.banco,
    agencia: conta.agencia || null,
    numero: conta.numero || null
  };

  const { error } = await supabaseClient
    .from('contas')
    .insert([Object.assign(payload, getUserScopePayload())]);

  if (error) {
    console.error('Erro ao cadastrar conta:', error);
    if (isMissingContaSchemaError(error)) {
      alert('A tabela de contas ainda nao existe no Supabase. Rode o arquivo sql/20260419_contas_clientes.sql no SQL Editor.');
      return;
    }
    alert('Nao foi possivel cadastrar a conta: ' + (error.message || 'erro desconhecido'));
    return;
  }

  await loadData();
  renderExtrato();
}

async function editarContaCliente(contaId) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');

  var conta = contasClienteAtivo().find(item => item.id === contaId);
  if (!conta) return alert('Conta nao encontrada.');

  var dados = await abrirFormularioContaCliente(conta);
  if (!dados) return;

  const { error } = await applyUserScope(
    supabaseClient
      .from('contas')
      .update({
        tipo: dados.tipo,
        banco: dados.banco,
        agencia: dados.agencia || null,
        numero: dados.numero || null
      })
      .eq('id', conta.id)
  );

  if (error) {
    console.error('Erro ao editar conta:', error);
    if (isMissingContaSchemaError(error)) {
      alert('A tabela de contas ainda nao existe no Supabase. Rode o arquivo sql/20260419_contas_clientes.sql no SQL Editor.');
      return;
    }
    alert('Nao foi possivel editar a conta: ' + (error.message || 'erro desconhecido'));
    return;
  }

  await loadData();
  renderExtrato();
}

async function cadastrarRelacionamentoCliente() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var relacionamento = await abrirFormularioRelacionamentoCliente(null);
  if (!relacionamento) return;

  var payload = Object.assign({
    cliente_id: activeClient,
    nome: relacionamento.nome,
    tipo: relacionamento.tipo,
    observacao: relacionamento.observacao || null,
    palavras_chave: relacionamento.palavrasChave || null
  }, getUserScopePayload());

  var result = await supabaseClient
    .from('relacionamentos_cliente')
    .insert([payload]);

  if (result.error && isMissingRelacionamentoSchemaError(result.error)) {
    var fallbackPayload = Object.assign({}, payload);
    delete fallbackPayload.palavras_chave;
    result = await supabaseClient
      .from('relacionamentos_cliente')
      .insert([fallbackPayload]);
  }

  const error = result.error;

  if (error) {
    console.error('Erro ao cadastrar relacionamento:', error);
    if (isMissingRelacionamentoSchemaError(error)) {
      alert('A tabela de relacionamentos ainda nao existe no Supabase. Rode o arquivo sql/20260510_relacionamentos_extrato.sql no SQL Editor.');
      return;
    }
    alert('Nao foi possivel cadastrar o relacionamento: ' + (error.message || 'erro desconhecido'));
    return;
  }

  await loadData();
  renderExtrato();
}

async function editarRelacionamentoCliente(relacionamentoId) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var rel = relacionamentosClienteAtivo().find(function(item) { return item.id === relacionamentoId; });
  if (!rel) return alert('Relacionamento nao encontrado.');

  var dados = await abrirFormularioRelacionamentoCliente(rel);
  if (!dados) return;

  var query = applyUserScope(
    supabaseClient
      .from('relacionamentos_cliente')
      .update({
        nome: dados.nome,
        tipo: dados.tipo,
        observacao: dados.observacao || null,
        palavras_chave: dados.palavrasChave || null
      })
      .eq('id', rel.id)
  );

  var result = await query;
  if (result.error && isMissingRelacionamentoSchemaError(result.error)) {
    result = await applyUserScope(
      supabaseClient
        .from('relacionamentos_cliente')
        .update({
          nome: dados.nome,
          tipo: dados.tipo,
          observacao: dados.observacao || null
        })
        .eq('id', rel.id)
    );
  }

  const error = result.error;

  if (error) {
    console.error('Erro ao editar relacionamento:', error);
    if (isMissingRelacionamentoSchemaError(error)) {
      alert('A tabela de relacionamentos ainda nao existe no Supabase. Rode o arquivo sql/20260510_relacionamentos_extrato.sql no SQL Editor.');
      return;
    }
    alert('Nao foi possivel editar o relacionamento: ' + (error.message || 'erro desconhecido'));
    return;
  }

  await loadData();
  renderExtrato();
}

async function excluirRelacionamentoCliente(relacionamentoId) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var rel = relacionamentosClienteAtivo().find(function(item) { return item.id === relacionamentoId; });
  if (!rel) return;

  var texto = 'Excluir o relacionamento "' + nomeRelacionamento(rel) + '"? Os lancamentos vinculados permanecerao no extrato, mas sem este relacionamento.';
  if (!(await appConfirm(texto, { title: 'Excluir relacionamento', confirmText: 'Excluir' }))) return;

  const { error } = await applyUserScope(
    supabaseClient
      .from('relacionamentos_cliente')
      .delete()
      .eq('id', rel.id)
  );

  if (error) {
    console.error('Erro ao excluir relacionamento:', error);
    alert('Nao foi possivel excluir o relacionamento: ' + (error.message || 'erro desconhecido'));
    return;
  }

  await loadData();
  renderExtrato();
}

function abrirFormularioRelacionamentoCliente(relacionamento) {
  return new Promise(function(resolve) {
    var overlay = appDialogEnsure();
    var titleEl = document.getElementById('appDialogTitle');
    var messageEl = document.getElementById('appDialogMessage');
    var actionsEl = document.getElementById('appDialogActions');

    titleEl.textContent = relacionamento ? 'Editar relacionamento' : 'Cadastrar relacionamento';
    messageEl.innerHTML =
      '<div class="account-form">' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Apelido</label><input type="text" id="relNome" value="' + esc((relacionamento && relacionamento.nome) || '') + '" placeholder="Ex: Granafy, Levy PF, Casa"/></div>' +
      '<div class="form-group" style="max-width:200px"><label>Tipo</label><select id="relTipo">' +
      TIPOS_RELACIONAMENTO.map(function(item) {
        var selected = ((relacionamento && relacionamento.tipo) || 'interno') === item.value ? ' selected' : '';
        return '<option value="' + item.value + '"' + selected + '>' + item.label + '</option>';
      }).join('') +
      '</select></div>' +
      '</div>' +
      '<div class="form-group"><label>Palavras-chave</label><input type="text" id="relPalavras" value="' + esc((relacionamento && (relacionamento.palavrasChave || relacionamento.palavras_chave)) || '') + '" placeholder="Ex: levy lima, pix levy, transf levy"/></div>' +
      '<div class="form-group"><label>Observacao</label><input type="text" id="relObs" value="' + esc((relacionamento && relacionamento.observacao) || '') + '" placeholder="Ex: Pagamento pessoal feito para a empresa"/></div>' +
      '<div class="account-form-error" id="relFormError"></div>' +
      '</div>';
    actionsEl.innerHTML =
      '<button class="app-dialog-btn ghost" type="button" id="relCancelar">Cancelar</button>' +
      '<button class="app-dialog-btn primary" type="button" id="relSalvar">' + (relacionamento ? 'Salvar' : 'Cadastrar') + '</button>';

    function close(value) {
      overlay.classList.remove('open');
      resolve(value);
    }

    document.getElementById('relCancelar').onclick = function() { close(null); };
    document.getElementById('relSalvar').onclick = function() {
      var nome = document.getElementById('relNome').value.trim();
      var tipo = document.getElementById('relTipo').value || 'interno';
      var palavrasChave = document.getElementById('relPalavras').value.trim();
      var observacao = document.getElementById('relObs').value.trim();
      var errorEl = document.getElementById('relFormError');

      if (!nome) {
        errorEl.textContent = 'Informe o apelido do relacionamento.';
        document.getElementById('relNome').focus();
        return;
      }

      close({
        nome: nome,
        tipo: tipo,
        palavrasChave: palavrasChave,
        observacao: observacao
      });
    };

    overlay.classList.add('open');
    setTimeout(function() {
      var input = document.getElementById('relNome');
      if (input) input.focus();
    }, 0);
  });
}

function abrirFormularioContaCliente(conta) {
  return new Promise(resolve => {
    var overlay = appDialogEnsure();
    var titleEl = document.getElementById('appDialogTitle');
    var messageEl = document.getElementById('appDialogMessage');
    var actionsEl = document.getElementById('appDialogActions');
    var tipoAtual = (conta && conta.tipo) || 'corrente';
    var bancoAtual = (conta && conta.banco) || '';
    var bancoConhecido = BANCOS_COMUNS.includes(bancoAtual) ? bancoAtual : (bancoAtual ? 'Outro' : 'Banco do Brasil');

    overlay.classList.add('account-dialog-overlay');
    titleEl.textContent = conta ? 'Editar conta' : 'Cadastrar conta';
    messageEl.innerHTML =
      '<div class="account-form">' +
      '<div class="account-type-row" role="group" aria-label="Tipo de conta">' +
      '<button type="button" class="account-type-btn' + (tipoAtual !== 'poupanca' ? ' active' : '') + '" data-type="corrente">Conta corrente</button>' +
      '<button type="button" class="account-type-btn' + (tipoAtual === 'poupanca' ? ' active' : '') + '" data-type="poupanca">Poupanca</button>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Banco</label><select id="contaBanco">' +
      BANCOS_COMUNS.map(banco => '<option value="' + esc(banco) + '"' + (bancoConhecido === banco ? ' selected' : '') + '>' + esc(banco) + '</option>').join('') +
      '</select></div>' +
      '<div class="form-group account-other-bank" id="contaOutroWrap"><label>Nome do banco</label><input type="text" id="contaBancoOutro" value="' + esc(bancoConhecido === 'Outro' ? bancoAtual : '') + '" placeholder="Digite o banco"/></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Agencia</label><input type="text" id="contaAgencia" value="' + esc((conta && conta.agencia) || '') + '" inputmode="numeric" placeholder="Ex: 1234"/></div>' +
      '<div class="form-group"><label>Conta</label><input type="text" id="contaNumero" value="' + esc((conta && conta.numero) || '') + '" inputmode="numeric" placeholder="Ex: 000123-4"/></div>' +
      '</div>' +
      '<div class="account-form-error" id="contaFormError"></div>' +
      '</div>';
    actionsEl.innerHTML =
      '<button class="app-dialog-btn ghost" type="button" id="contaCancelar">Cancelar</button>' +
      '<button class="app-dialog-btn primary" type="button" id="contaSalvar">' + (conta ? 'Salvar' : 'Cadastrar') + '</button>';

    var tipoSelecionado = tipoAtual === 'poupanca' ? 'poupanca' : 'corrente';
    var bancoSelect = document.getElementById('contaBanco');
    var outroWrap = document.getElementById('contaOutroWrap');
    var outroInput = document.getElementById('contaBancoOutro');
    var agenciaInput = document.getElementById('contaAgencia');
    var numeroInput = document.getElementById('contaNumero');
    var errorEl = document.getElementById('contaFormError');
    var cancelar = document.getElementById('contaCancelar');
    var salvar = document.getElementById('contaSalvar');
    var typeBtns = Array.from(messageEl.querySelectorAll('.account-type-btn'));

    function syncOutro() {
      outroWrap.style.display = bancoSelect.value === 'Outro' ? 'flex' : 'none';
    }

    function close(value) {
      overlay.classList.remove('open');
      overlay.classList.remove('account-dialog-overlay');
      document.removeEventListener('keydown', onKey);
      resolve(value);
    }

    function onKey(event) {
      if (event.key === 'Escape') close(null);
    }

    typeBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        tipoSelecionado = btn.dataset.type;
        typeBtns.forEach(item => item.classList.toggle('active', item === btn));
      });
    });

    bancoSelect.addEventListener('change', syncOutro);
    cancelar.addEventListener('click', () => close(null));
    salvar.addEventListener('click', function() {
      var banco = bancoSelect.value === 'Outro' ? outroInput.value.trim() : bancoSelect.value;
      if (!banco) {
        errorEl.textContent = 'Informe o banco da conta.';
        if (bancoSelect.value === 'Outro') outroInput.focus();
        return;
      }

      close({
        tipo: tipoSelecionado,
        banco: banco,
        agencia: agenciaInput.value.trim(),
        numero: numeroInput.value.trim()
      });
    });
    document.addEventListener('keydown', onKey);

    syncOutro();
    overlay.classList.add('open');
    setTimeout(() => bancoSelect.focus(), 0);
  });
}

function getPreviousMonthKey() {
  var d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function setTipoExtrato(t) {
  _exTipo = t;
  var cred = document.getElementById('ex-tipo-credito');
  var deb = document.getElementById('ex-tipo-debito');
  if (cred) cred.classList.toggle('active', t === 'credito');
  if (deb) deb.classList.toggle('active', t === 'debito');
}

function aplicarFiltrosExtrato() {
  var tipo = document.getElementById('ex-filtro-tipo');
  var cat = document.getElementById('ex-filtro-cat');
  var periodoModo = document.getElementById('ex-filtro-periodo-modo');
  var periodo = document.getElementById('ex-filtro-periodo');
  var conta = document.getElementById('ex-filtro-conta');
  var relacionamento = document.getElementById('ex-filtro-relacionamento');
  var busca = document.getElementById('ex-filtro-busca');
  var conciliacao = document.getElementById('ex-filtro-conciliacao');
  var estorno = document.getElementById('ex-filtro-estorno');
  var valorModo = document.getElementById('ex-filtro-valor-modo');
  var valor = document.getElementById('ex-filtro-valor');

  _exFiltroTipo = tipo ? tipo.value : 'todos';
  _exFiltroCat = cat ? cat.value : '';
  _exFiltroPeriodoModo = periodoModo ? periodoModo.value : 'mes';
  _exFiltroPeriodoValor = periodo ? normalizePeriodoFiltroExtrato(periodo.value, _exFiltroPeriodoModo) : '';
  _exFiltroConta = conta ? conta.value : '';
  _exFiltroRelacionamento = clienteAtivoEhPJ() && relacionamento ? relacionamento.value : '';
  _exFiltroConciliacao = clienteAtivoEhPJ() && conciliacao ? conciliacao.value : 'todos';
  _exFiltroEstorno = clienteAtivoEhPJ() && estorno ? estorno.value : 'todos';
  _exFiltroValorModo = valorModo ? valorModo.value : 'todos';
  _exFiltroValor = valor ? parseMoney(valor) : 0;
  _exFiltroBusca = busca ? busca.value.trim().toLowerCase() : '';

  renderExtrato();
}

function limparFiltrosExtrato() {
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
  renderExtrato();
}

function toggleDuplicadosExtrato() {
  _exMostrarDuplicados = !_exMostrarDuplicados;
  renderExtrato();
}

function carregarDuplicadosResolvidosExtrato() {
  try {
    return JSON.parse(localStorage.getItem('granafy_extrato_duplicados_resolvidos') || '{}') || {};
  } catch (e) {
    return {};
  }
}

function salvarDuplicadosResolvidosExtrato() {
  localStorage.setItem('granafy_extrato_duplicados_resolvidos', JSON.stringify(_exDuplicadosResolvidos || {}));
}

function chaveResolucaoDuplicadoExtrato(chave) {
  return String(activeClient || '') + '::' + chave;
}

function assinaturaLinhaDuplicadaExtrato(l) {
  return [
    l && l.id ? 'id:' + l.id : '',
    l && (l.data || l.data_lancamento || '') || '',
    String(l && (l.desc || l.descricao || '') || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' '),
    String(l && l.cat || '').trim().toLowerCase(),
    String(l && l.tipo || '').trim().toLowerCase(),
    String(l && l.contaId || '').trim().toLowerCase(),
    Math.round(Number(l && l.valor || 0) * 100)
  ].join('|');
}

function assinaturaGrupoDuplicadoExtrato(linhas) {
  return (linhas || [])
    .map(assinaturaLinhaDuplicadaExtrato)
    .sort()
    .join('||');
}

function duplicadoResolvidoExtrato(chave, linhas) {
  var resolucao = _exDuplicadosResolvidos[chaveResolucaoDuplicadoExtrato(chave)];
  if (!resolucao) return false;
  if (resolucao === true) return true;

  var assinaturaAtual = assinaturaGrupoDuplicadoExtrato(linhas);
  if (!assinaturaAtual) return !!resolucao;
  return resolucao.assinatura === assinaturaAtual;
}

function grupoDuplicadoPendenteExtrato(grupo) {
  return !duplicadoResolvidoExtrato(grupo.chave, grupo.linhas);
}

function resolverDuplicadoExtrato(chave, linhas, acao) {
  _exDuplicadosResolvidos[chaveResolucaoDuplicadoExtrato(chave)] = {
    acao: acao || 'manter',
    assinatura: assinaturaGrupoDuplicadoExtrato(linhas),
    resolvidoEm: new Date().toISOString()
  };
  salvarDuplicadosResolvidosExtrato();
}

function manterTodosDuplicadoExtrato(chave) {
  var chaveDecodificada = decodeURIComponent(chave);
  var c = data.clients[activeClient];
  var grupo = c && Array.isArray(c.extrato)
    ? agruparDuplicadosExtrato(c.extrato).find(g => g.chave === chaveDecodificada)
    : null;
  resolverDuplicadoExtrato(chaveDecodificada, grupo && grupo.linhas, 'manter');
  renderExtrato();
}

function toggleSelecaoLoteExtrato() {
  _exSelecaoLote = !_exSelecaoLote;
  if (!_exSelecaoLote) _exSelecionados = new Set();
  renderExtrato();
}

function toggleLinhaSelecaoExtrato(id) {
  if (!id) return;
  if (_exSelecionados.has(id)) _exSelecionados.delete(id);
  else _exSelecionados.add(id);
  renderExtrato();
}

function toggleSelecionarTodosVisiveisExtrato(ids) {
  var lista = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!lista.length) return;
  var todosMarcados = lista.every(function(id) { return _exSelecionados.has(id); });
  if (todosMarcados) {
    lista.forEach(function(id) { _exSelecionados.delete(id); });
  } else {
    lista.forEach(function(id) { _exSelecionados.add(id); });
  }
  renderExtrato();
}

async function aplicarCategoriaEmLoteExtrato() {
  if (!canEditActiveClient()) {
    alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
    return;
  }
  var categoriaEl = document.getElementById('ex-lote-categoria');
  var categoria = categoriaEl ? String(categoriaEl.value || '').trim() : '';
  var ids = Array.from(_exSelecionados);
  if (!ids.length) {
    alert('Selecione ao menos um lancamento.');
    return;
  }
  if (!categoria) {
    alert('Escolha a categoria que deseja aplicar.');
    return;
  }

  var response = await applyUserScope(
    supabaseClient
      .from('lancamentos')
      .update({ categoria: categoria || null })
      .eq('cliente_id', activeClient)
      .in('id', ids),
    activeClient
  );

  if (response.error) {
    console.error('Erro ao atualizar categorias em lote do extrato:', response.error);
    alert('Nao foi possivel atualizar as categorias selecionadas.');
    return;
  }

  ids.forEach(function(id) {
    var item = (data.clients[activeClient].extrato || []).find(function(l) { return l.id === id; });
    if (item) item.cat = categoria;
  });
  _exSelecionados = new Set();
  _exSelecaoLote = false;
  renderExtrato();
}

function chaveDuplicidadeExtrato(l) {
  var data = l.data || l.data_lancamento || '';
  var desc = String(l.desc || l.descricao || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  var tipo = String(l.tipo || '').trim().toLowerCase();
  var centavos = Math.round(Number(l.valor || 0) * 100);

  return [
    data,
    desc,
    tipo,
    centavos
  ].join('|');
}

function encontrarDuplicadosExtratoClienteAtivo() {
  var c = data.clients[activeClient];
  if (!c || !Array.isArray(c.extrato)) return [];

  var vistos = new Map();
  var duplicados = [];

  c.extrato.forEach(l => {
    var chave = chaveDuplicidadeExtrato(l);
    if (vistos.has(chave)) duplicados.push(l);
    else vistos.set(chave, l);
  });

  return duplicados.filter(l => l && l.id);
}

function deduplicarExtratoLista(lista) {
  var vistos = new Map();
  var unicos = [];
  var duplicados = [];

  (lista || []).forEach(l => {
    var chave = chaveDuplicidadeExtrato(l);
    if (vistos.has(chave)) duplicados.push(l);
    else {
      vistos.set(chave, l);
      unicos.push(l);
    }
  });

  return { unicos, duplicados };
}

function agruparDuplicadosExtrato(lista) {
  var grupos = new Map();

  (lista || []).forEach(l => {
    var chave = chaveDuplicidadeExtrato(l);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(l);
  });

  return Array.from(grupos.entries())
    .filter(([, linhas]) => linhas.length > 1)
    .map(([chave, linhas]) => ({ chave, linhas }));
}

function setManterDuplicadoExtrato(chave, id) {
  _exManterDuplicado[decodeURIComponent(chave)] = decodeURIComponent(id);
}

async function removerDuplicadosSelecionadosExtrato() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');

  var c = data.clients[activeClient];
  if (!c || !Array.isArray(c.extrato)) return;

  var grupos = agruparDuplicadosExtrato(c.extrato).filter(grupoDuplicadoPendenteExtrato);
  var idsParaExcluir = [];
  var chavesResolvidas = [];

  grupos.forEach(grupo => {
    var manterId = _exManterDuplicado[grupo.chave] || (grupo.linhas[0] && grupo.linhas[0].id);
    var temExclusao = false;
    grupo.linhas.forEach(l => {
      if (l.id && l.id !== manterId) {
        idsParaExcluir.push(l.id);
        temExclusao = true;
      }
    });
    if (temExclusao) chavesResolvidas.push(grupo);
  });

  if (!idsParaExcluir.length) return alert('Nenhum duplicado selecionado para exclusao.');
  if (!(await appConfirm('Excluir ' + idsParaExcluir.length + ' lancamento(s) duplicado(s), mantendo os marcados como "Manter"?', { title: 'Excluir duplicados', confirmText: 'Excluir' }))) return;

  const { data: removidos, error } = await applyUserScope(
    supabaseClient
      .from('lancamentos')
      .delete()
      .in('id', idsParaExcluir)
      .select('id')
  );

  if (error) {
    console.error('Erro ao excluir duplicados selecionados:', error);
    alert('Nao foi possivel excluir duplicados: ' + (error.message || 'erro desconhecido'));
    return;
  }

  if (!removidos || removidos.length === 0) {
    alert('Nenhuma linha foi removida. O Supabase pode estar bloqueando a exclusao por permissao/RLS deste login.');
    return;
  }

  chavesResolvidas.forEach(grupo => resolverDuplicadoExtrato(grupo.chave, grupo.linhas, 'excluir'));
  await loadData();
  renderExtrato();
  alert(removidos.length + ' lancamento(s) duplicado(s) removido(s).');
}

async function removerDuplicadoGrupoExtrato(chaveCodificada) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');

  var chave = decodeURIComponent(chaveCodificada);
  var c = data.clients[activeClient];
  if (!c || !Array.isArray(c.extrato)) return;

  var grupo = agruparDuplicadosExtrato(c.extrato).find(g => g.chave === chave);
  if (!grupo) {
    resolverDuplicadoExtrato(chave, [], 'manter');
    renderExtrato();
    return;
  }

  var manterId = _exManterDuplicado[chave] || (grupo.linhas[0] && grupo.linhas[0].id);
  var idsParaExcluir = grupo.linhas
    .filter(l => l.id && l.id !== manterId)
    .map(l => l.id);

  if (!idsParaExcluir.length) {
    resolverDuplicadoExtrato(chave, grupo.linhas, 'manter');
    renderExtrato();
    return;
  }

  if (!(await appConfirm('Excluir ' + idsParaExcluir.length + ' lancamento(s) deste grupo e manter o marcado?', { title: 'Excluir duplicados', confirmText: 'Excluir' }))) return;

  const { data: removidos, error } = await applyUserScope(
    supabaseClient
      .from('lancamentos')
      .delete()
      .in('id', idsParaExcluir)
      .select('id')
  );

  if (error) {
    console.error('Erro ao excluir duplicados do grupo:', error);
    alert('Nao foi possivel excluir duplicados: ' + (error.message || 'erro desconhecido'));
    return;
  }

  if (!removidos || removidos.length === 0) {
    alert('Nenhuma linha foi removida. O Supabase pode estar bloqueando a exclusao por permissao/RLS deste login.');
    return;
  }

  resolverDuplicadoExtrato(chave, grupo.linhas, 'excluir');
  await loadData();
  renderExtrato();
  alert(removidos.length + ' lancamento(s) removido(s).');
}

async function removerDuplicadosExtratoClienteAtivo() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');

  var linhas = null;
  var query = applyUserScope(
    supabaseClient
      .from('lancamentos')
      .select('id,cliente_id,data_lancamento,descricao,categoria,tipo,valor')
      .eq('cliente_id', activeClient)
  );

  var resposta = await query;
  if (resposta.error) {
    console.error('Erro ao consultar duplicados:', resposta.error);
    alert('Nao foi possivel consultar duplicados: ' + (resposta.error.message || 'erro desconhecido'));
    return;
  }

  linhas = (resposta.data || []).map(row => ({
    id: row.id,
    data: row.data_lancamento || '',
    desc: row.descricao || '',
    cat: row.categoria || '',
    tipo: row.tipo || '',
    valor: Number(row.valor || 0)
  }));

  var vistos = new Map();
  var duplicados = [];
  linhas.forEach(l => {
    var chave = chaveDuplicidadeExtrato(l);
    if (vistos.has(chave)) duplicados.push(l);
    else vistos.set(chave, l);
  });

  if (duplicados.length === 0) {
    alert('Nenhum duplicado encontrado no extrato deste cliente.');
    return;
  }

  if (!(await appConfirm('Foram encontrados ' + duplicados.length + ' lancamento(s) duplicado(s). Deseja remover os repetidos e manter apenas um de cada?', { title: 'Duplicados encontrados', confirmText: 'Remover repetidos' }))) {
    return;
  }

  var ids = duplicados.map(l => l.id);
  const { data: removidos, error } = await applyUserScope(
    supabaseClient
      .from('lancamentos')
      .delete()
      .in('id', ids)
      .select('id')
  );

  if (error) {
    console.error('Erro ao remover duplicados:', error);
    alert('Nao foi possivel remover duplicados: ' + (error.message || 'erro desconhecido'));
    return;
  }

  if (!removidos || removidos.length === 0) {
    alert('Nenhuma linha foi removida. O Supabase pode estar bloqueando a exclusao por permissao/RLS deste login.');
    return;
  }

  await loadData();
  renderExtrato();
  alert(removidos.length + ' lancamento(s) duplicado(s) removido(s).');
}

function renderExtrato() {
  var c = data.clients[activeClient];
  var area = document.getElementById('extrato-content');
  if (!area) return;

  if (!c) {
    area.innerHTML = '<div class="empty-state"><div class="icon">↓</div>Selecione um cliente.</div>';
    return;
  }

  var financeiroPJAtivo = clienteAtivoEhPJ();
  var relacionamentoAtivo = extratoRelacionamentoAtivo();
  var centroCustoAtivo = extratoCentroCustoAtivo();
  var lncs = c.extrato || [];
  _exSelecionados = new Set(Array.from(_exSelecionados).filter(function(id) {
    return lncs.some(function(l) { return l.id === id; });
  }));
  var catsLanc = [...new Set(lncs.map(l => l.cat || '').filter(Boolean))].sort(compararCategoriaNome);
  var filtradosBrutos = extratoLancamentosFiltrados(c);
  var gruposDuplicados = agruparDuplicadosExtrato(filtradosBrutos).filter(grupoDuplicadoPendenteExtrato);
  var qtdDuplicadosPendentes = gruposDuplicados.reduce((total, grupo) => total + Math.max(grupo.linhas.length - 1, 0), 0);
  var filtrados = filtradosBrutos;

  var totalCredito = filtrados
    .filter(l => l.tipo === 'credito')
    .reduce((s, l) => s + Number(l.valor), 0);

  var totalDebito = filtrados
    .filter(l => l.tipo === 'debito')
    .reduce((s, l) => s + Number(l.valor), 0);

  var saldo = totalCredito - totalDebito;
  var catOpts = nomesCC().map(cat => '<option value="' + esc(cat) + '">' + esc(cat) + '</option>').join('');
  var catLoteOpts = nomesCC().map(cat => '<option value="' + esc(cat) + '">' + esc(cat) + '</option>').join('');
  var filtroCatOpts = catsLanc.map(cat => '<option value="' + esc(cat) + '"' + (_exFiltroCat === cat ? ' selected' : '') + '>' + esc(cat) + '</option>').join('');
  var contas = contasClienteAtivo();
  var relacionamentos = relacionamentoAtivo ? relacionamentosClienteAtivo() : [];
  var contasResumoHtml = contas.length
    ? contas.map(conta =>
      '<span class="account-pill">'
      + '<span>' + esc(nomeContaCliente(conta)) + '</span>'
      + '<button class="btn-icon" onclick="editarContaCliente(\'' + esc(conta.id) + '\')" title="Editar conta">&#9998;</button>'
      + '</span>'
    ).join(' ')
    : '<span style="color:var(--muted);font-size:.85rem">Nenhuma conta cadastrada para este cliente.</span>';
  var relacionamentosResumoHtml = relacionamentos.length
    ? relacionamentos.slice().sort(function(a, b) {
        return compararCategoriaNome(nomeRelacionamento(a), nomeRelacionamento(b));
      }).map(function(rel) {
        return '<span class="account-pill">'
          + '<span>' + esc(nomeRelacionamento(rel)) + ' <small style="color:var(--muted)">(' + esc(tipoRelacionamentoLabel(rel.tipo)) + ')</small></span>'
          + '<button class="btn-icon" onclick="editarRelacionamentoCliente(\'' + esc(rel.id) + '\')" title="Editar relacionamento">&#9998;</button>'
          + '<button class="btn-icon danger" onclick="excluirRelacionamentoCliente(\'' + esc(rel.id) + '\')" title="Excluir relacionamento">&#128465;</button>'
          + '</span>';
      }).join(' ')
    : '<span style="color:var(--muted);font-size:.85rem">Nenhum relacionamento cadastrado para este cliente.</span>';
  var filtroContaOpts = contas.map(conta =>
    '<option value="' + esc(conta.id) + '"' + (_exFiltroConta === conta.id ? ' selected' : '') + '>' +
    esc(nomeContaCliente(conta)) +
    '</option>'
  ).join('');
  var filtroRelacionamentoOpts = relacionamentos.slice().sort(function(a, b) {
    return compararCategoriaNome(nomeRelacionamento(a), nomeRelacionamento(b));
  }).map(function(rel) {
    return '<option value="' + esc(rel.id) + '"' + (_exFiltroRelacionamento === rel.id ? ' selected' : '') + '>' +
      esc(nomeRelacionamento(rel)) +
      '</option>';
  }).join('');
  var contasPanelBody =
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">' + contasResumoHtml + '</div>'
    + '<button class="btn-sm" onclick="cadastrarContaCliente()">+ Cadastrar conta</button>'
    + '</div>';

  var relacionamentosPanelBody =
    '<p style="color:var(--muted);font-size:.85rem;margin-bottom:14px">Use apelidos controlados para identificar a origem ou o destino real do valor, sem perder a descricao original do banco.</p>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">' + relacionamentosResumoHtml + '</div>'
    + '<button class="btn-sm" onclick="cadastrarRelacionamentoCliente()">+ Cadastrar relacionamento</button>'
    + '</div>';

  var importarPanelBody =
    '<p style="color:var(--muted);font-size:.85rem;margin-bottom:14px">Baixe o modelo, selecione a conta e importe o arquivo.</p>'
    + extratoImportGuideHtml()
    + (relacionamentoAtivo ? '<div class="rel-suggestion rel-suggestion-muted" style="margin-bottom:14px">Se <strong>Relacionado a</strong> ficar em branco, o sistema tenta sugerir o vinculo pela descricao do banco.</div>' : '')
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:260px"><label>Conta do extrato</label><select id="ex-import-conta">' + contasOptionsObrigatoriasCliente('', '-- selecione a conta --') + '</select></div>'
    + (relacionamentoAtivo ? '<div class="form-group" style="max-width:260px"><label>Relacionado a</label><select id="ex-import-relacionamento">' + relacionamentoOptionsCliente('', true) + '</select></div>' : '')
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn-sm" onclick="exportExtratoTemplate()">Baixar modelo (.xlsx)</button><button class="btn-sm" onclick="abrirImportacaoExtrato()">Importar planilha</button></div>';

  var novoPanelBody =
    '<div class="tipo-toggle" style="margin-bottom:12px">'
    + '<button class="tipo-btn credito" id="ex-tipo-credito" onclick="setTipoExtrato(\'credito\')">Credito</button>'
    + '<button class="tipo-btn debito" id="ex-tipo-debito" onclick="setTipoExtrato(\'debito\')">Debito</button>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:150px"><label>Data</label><input type="date" id="ex-data"/></div>'
    + '<div class="form-group"><label>Descricao</label><input type="text" id="ex-desc" placeholder="Ex: salario, aluguel..." onblur="this.value=formatDescriptionTitleCase(this.value)"/></div>'
    + '<div class="form-group" style="max-width:180px"><label>Categoria <span style="color:var(--accent);cursor:pointer;font-size:.68rem" onclick="openModal(\'settings\',\'cats_cc\')">(+ gerir)</span></label><select id="ex-cat">' + catOpts + '</select></div>'
    + (centroCustoAtivo ? '<div class="form-group" style="max-width:220px"><label>Centro de custo <span style="color:var(--accent);cursor:pointer;font-size:.68rem" onclick="openModal(\'settings\',\'centros_custo\')">(+ gerir)</span></label><select id="ex-centro-custo">' + centrosCustoOptionsCliente('', true) + '</select></div>' : '')
    + '<div class="form-group" style="max-width:260px"><label>Conta <span style="color:var(--accent);cursor:pointer;font-size:.68rem" onclick="cadastrarContaCliente()">(+ nova)</span></label><select id="ex-conta">' + contasOptionsCliente('') + '</select></div>'
    + (relacionamentoAtivo ? '<div class="form-group" style="max-width:220px"><label>Relacionado a</label><select id="ex-relacionamento">' + relacionamentoOptionsCliente('', true) + '</select></div>' : '')
    + '<div class="form-group" style="max-width:150px"><label>Valor (R$)</label><input type="text" id="ex-valor" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '</div>'
    + (relacionamentoAtivo ? '<div id="ex-rel-suggestion" style="margin:-4px 0 12px"></div>' : '')
    + '<div class="form-row"><div class="form-group"><label>Observacao</label><input type="text" id="ex-obs" placeholder="Opcional. Ex: Pagamento feito por Levy PF para a Granafy."/></div></div>'
    + '<button class="btn-add" onclick="addExtrato()">Adicionar</button>';

  var filtrosPanelBody =
    '<div class="form-row">'
    + '<div class="form-group" style="max-width:150px"><label>Tipo</label><select id="ex-filtro-tipo"><option value="todos"' + (_exFiltroTipo === 'todos' ? ' selected' : '') + '>Todos</option><option value="credito"' + (_exFiltroTipo === 'credito' ? ' selected' : '') + '>Credito</option><option value="debito"' + (_exFiltroTipo === 'debito' ? ' selected' : '') + '>Debito</option></select></div>'
    + '<div class="form-group" style="max-width:190px"><label>Categoria</label><select id="ex-filtro-cat"><option value="">Todas</option>' + filtroCatOpts + '</select></div>'
    + '<div class="form-group" style="max-width:120px"><label>Periodo</label><select id="ex-filtro-periodo-modo" onchange="atualizarPlaceholdersFiltrosExtrato()"><option value="dia"' + (_exFiltroPeriodoModo === 'dia' ? ' selected' : '') + '>Dia</option><option value="mes"' + (_exFiltroPeriodoModo === 'mes' ? ' selected' : '') + '>Mes</option><option value="ano"' + (_exFiltroPeriodoModo === 'ano' ? ' selected' : '') + '>Ano</option></select></div>'
    + '<div class="form-group" style="max-width:170px"><label>Referencia</label><input type="text" id="ex-filtro-periodo" class="' + (_exFiltroPeriodoModo === 'dia' ? 'flex-date-input' : '') + '" value="' + esc(extratoPeriodoDisplayValue()) + '" placeholder="' + esc(extratoPeriodoPlaceholder()) + '" onkeydown="if(event.key===\'Enter\')aplicarFiltrosExtrato()"/></div>'
    + '<div class="form-group" style="max-width:260px"><label>Conta</label><select id="ex-filtro-conta"><option value="">Todas</option>' + filtroContaOpts + '</select></div>'
    + (financeiroPJAtivo ? '<div class="form-group" style="max-width:180px"><label>Conciliacao</label><select id="ex-filtro-conciliacao"><option value="todos"' + (_exFiltroConciliacao === 'todos' ? ' selected' : '') + '>Todos</option><option value="conciliados"' + (_exFiltroConciliacao === 'conciliados' ? ' selected' : '') + '>Conciliados</option><option value="nao_conciliados"' + (_exFiltroConciliacao === 'nao_conciliados' ? ' selected' : '') + '>Nao conciliados</option></select></div>' : '')
    + (financeiroPJAtivo ? '<div class="form-group" style="max-width:190px"><label>Devolucao</label><select id="ex-filtro-estorno"><option value="todos"' + (_exFiltroEstorno === 'todos' ? ' selected' : '') + '>Todos</option><option value="pendentes_estorno"' + (_exFiltroEstorno === 'pendentes_estorno' ? ' selected' : '') + '>Pendente de estorno</option><option value="estornados"' + (_exFiltroEstorno === 'estornados' ? ' selected' : '') + '>Ja estornados</option></select></div>' : '')
    + '<div class="form-group" style="max-width:120px"><label>Valor</label><select id="ex-filtro-valor-modo"><option value="todos"' + (_exFiltroValorModo === 'todos' ? ' selected' : '') + '>Todos</option><option value="acima"' + (_exFiltroValorModo === 'acima' ? ' selected' : '') + '>Acima de</option><option value="abaixo"' + (_exFiltroValorModo === 'abaixo' ? ' selected' : '') + '>Abaixo de</option><option value="igual"' + (_exFiltroValorModo === 'igual' ? ' selected' : '') + '>Igual a</option></select></div>'
    + '<div class="form-group" style="max-width:150px"><label>Valor (R$)</label><input type="text" id="ex-filtro-valor" class="money-input" value="' + esc(Number(_exFiltroValor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '" onkeydown="if(event.key===\'Enter\')aplicarFiltrosExtrato()"/></div>'
    + (relacionamentoAtivo ? '<div class="form-group" style="max-width:220px"><label>Relacionado a</label><select id="ex-filtro-relacionamento"><option value="">Todos</option>' + filtroRelacionamentoOpts + '</select></div>' : '')
    + '<div class="form-group"><label>Busca</label><input type="text" id="ex-filtro-busca" value="' + esc(_exFiltroBusca) + '" placeholder="Descricao ou categoria" onkeydown="if(event.key===\'Enter\')aplicarFiltrosExtrato()"/></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn-sm" onclick="aplicarFiltrosExtrato()">Aplicar filtros</button><button class="btn-sm red" onclick="limparFiltrosExtrato()">Limpar</button><button class="btn-sm" onclick="exportExtratoPDF()">Exportar PDF</button><button class="btn-sm" onclick="exportExtratoXlsx()">Exportar XLSX</button></div>';
  var idsFiltrados = filtrados.map(function(l) { return l.id; }).filter(Boolean);
  var selecionadosVisiveis = idsFiltrados.filter(function(id) { return _exSelecionados.has(id); }).length;
  var idsFiltradosJs = idsFiltrados.map(function(id) {
    return '\'' + String(id).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\'';
  }).join(',');
  var loteToolbarHtml = '<div class="extrato-bulk-bar">'
    + '<label class="extrato-bulk-toggle"><input type="checkbox"' + (_exSelecaoLote ? ' checked' : '') + ' onchange="toggleSelecaoLoteExtrato()"/><span>Selecionar varios</span></label>'
    + (_exSelecaoLote
      ? '<div class="extrato-bulk-actions">'
        + '<button class="btn-sm" type="button" onclick="toggleSelecionarTodosVisiveisExtrato([' + idsFiltradosJs + '])">' + (selecionadosVisiveis === idsFiltrados.length && idsFiltrados.length ? 'Desmarcar visiveis' : 'Marcar visiveis') + '</button>'
        + '<span class="extrato-bulk-count">' + _exSelecionados.size + ' selecionado(s)</span>'
        + '<select id="ex-lote-categoria"><option value="">Categoria em lote</option>' + catLoteOpts + '</select>'
        + '<button class="btn-sm" type="button" onclick="aplicarCategoriaEmLoteExtrato()">Aplicar categoria</button>'
        + '</div>'
      : '')
    + '</div>';

  var html =
    '<div class="summary-grid">'
    + '<div class="summary-card"><div class="s-label">Saldo</div><div class="s-val ' + (saldo >= 0 ? 'green' : 'red') + '">' + fmt(saldo) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Creditos</div><div class="s-val green">' + fmt(totalCredito) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Debitos</div><div class="s-val red">' + fmt(totalDebito) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Lancamentos</div><div class="s-val blue">' + filtrados.length + '</div></div>'
    + '</div>'
    + '<div class="extrato-panels-grid">'
    + extratoPanel('contas', 'Contas do cliente', contasPanelBody)
    + (relacionamentoAtivo ? extratoPanel('relacionamentos', 'Relacionamentos', relacionamentosPanelBody) : '')
    + extratoPanel('importar', 'Importar extrato via planilha', importarPanelBody)
    + extratoPanel('novo', '+ Novo lancamento', novoPanelBody)
    + extratoPanel('filtros', 'Filtros', filtrosPanelBody)
    + '</div>'
    + (qtdDuplicadosPendentes
      ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:-2px 0 12px;color:var(--warning);font-size:.78rem"><span>' + qtdDuplicadosPendentes + ' duplicado(s) pendente(s) de conferencia. Eles continuam aparecendo no extrato e nos totais.</span><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-sm" onclick="toggleDuplicadosExtrato()">' + (_exMostrarDuplicados ? 'Ocultar duplicados' : 'Ver duplicados') + '</button></span></div>'
      : '');
  if (_exMostrarDuplicados && gruposDuplicados.length) {
    html += '<p class="section-title">Duplicidades para conferencia</p>'
      + '<div style="display:flex;justify-content:flex-end;margin-bottom:10px;color:var(--muted);font-size:.78rem">Resolva um grupo por vez.</div>';

    gruposDuplicados.forEach((grupo, gi) => {
      if (!_exManterDuplicado[grupo.chave] && grupo.linhas[0]) _exManterDuplicado[grupo.chave] = grupo.linhas[0].id;

      html += '<div class="form-card" style="padding:12px 14px;margin-bottom:12px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px"><p class="section-title" style="margin-bottom:0">Grupo ' + (gi + 1) + ' - ' + grupo.linhas.length + ' registros iguais</p><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-sm" onclick="manterTodosDuplicadoExtrato(\'' + encodeURIComponent(grupo.chave) + '\')">Manter todos</button><button class="btn-sm red" onclick="removerDuplicadoGrupoExtrato(\'' + encodeURIComponent(grupo.chave) + '\')">Excluir nao mantidos</button></span></div>'
        + '<table class="data-table"><thead><tr><th>Manter</th><th>Data</th><th>Conta</th>' + (centroCustoAtivo ? '<th>Centro de custo</th>' : '') + (relacionamentoAtivo ? '<th>Relacionado a</th>' : '') + '<th>Descricao</th><th>Categoria</th><th>Valor</th><th></th></tr></thead><tbody>';

      grupo.linhas.forEach(l => {
        var realIdx = lncs.indexOf(l);
        var checked = _exManterDuplicado[grupo.chave] === l.id ? ' checked' : '';
        var detalhes = [];
        if (l.descOriginal && l.descOriginal !== l.desc) detalhes.push('Banco: ' + esc(l.descOriginal));
        if (l.observacao) detalhes.push('Obs: ' + esc(l.observacao));
        var concResumo = resumoConciliacaoLancamento(l);
        if (concResumo) detalhes.push(concResumo);
        html += '<tr class="row-' + l.tipo + '">'
          + '<td><input type="radio" name="dup-' + gi + '" onchange="setManterDuplicadoExtrato(\'' + encodeURIComponent(grupo.chave) + '\',\'' + encodeURIComponent(l.id) + '\')" ' + checked + '/></td>'
          + '<td style="color:var(--muted);font-size:.78rem">' + (l.data ? l.data.split('-').reverse().join('/') : '-') + '</td>'
          + '<td style="color:var(--muted);font-size:.78rem">' + esc(nomeContaCompactaPorId(c, l.contaId)) + '</td>'
          + (centroCustoAtivo ? '<td style="color:var(--muted);font-size:.78rem">' + esc(nomeCentroCustoPorId(c, l.centroCustoId)) + '</td>' : '')
          + (relacionamentoAtivo ? '<td style="color:var(--muted);font-size:.78rem">' + esc(nomeRelacionamentoPorId(c, l.relacionamentoId)) + '</td>' : '')
          + '<td>' + esc(l.desc || '') + (detalhes.length ? '<div style="color:var(--muted);font-size:.72rem;margin-top:3px">' + detalhes.join(' · ') + '</div>' : '') + '</td>'
          + '<td>' + extratoCategoriaBadgeHtml(l) + '</td>'
          + '<td><span class="val ' + (l.tipo === 'credito' ? 'val-pos' : 'val-neg') + '">' + (l.tipo === 'credito' ? '+ ' : '- ') + fmt(l.valor) + '</span></td>'
          + '<td><div class="row-actions">'
          + (financeiroPJAtivo && !extratoIgnoraConciliacao(l) ? '<button class="btn-icon" onclick="openExtratoConciliacaoModal(' + realIdx + ')" title="Conciliar">C</button>' : '')
          + '<button class="btn-icon" onclick="editExtrato(' + realIdx + ')" title="Editar">&#9998;</button><button class="btn-icon danger" onclick="deleteExtrato(' + realIdx + ')" title="Excluir">&#128465;</button></div></td>'
          + '</tr>';
      });

      html += '</tbody></table></div>';
    });
  }

  if (false && _exMostrarDuplicados && dedupe.duplicados.length) {
    html += '<p class="section-title">Duplicados ocultos</p>'
      + '<table class="data-table" style="margin-bottom:18px">'
      + '<thead><tr><th>Data</th><th>Descricao</th><th>Categoria</th><th>Valor</th><th></th></tr></thead><tbody>';

    [...dedupe.duplicados].sort((a, b) => (b.data || '').localeCompare(a.data || '')).forEach(l => {
      var realIdx = lncs.indexOf(l);
      html += '<tr class="row-' + l.tipo + '">'
        + '<td style="color:var(--muted);font-size:.78rem">' + (l.data ? l.data.split('-').reverse().join('/') : '-') + '</td>'
        + '<td>' + esc(l.desc || '') + '</td>'
        + '<td>' + extratoCategoriaBadgeHtml(l) + '</td>'
        + '<td><span style="font-size:.79rem;color:' + (l.tipo === 'credito' ? 'var(--success)' : 'var(--danger)') + '">' + (l.tipo === 'credito' ? 'Receita' : 'Despesa') + '</span></td>'
        + '<td><span class="val ' + (l.tipo === 'credito' ? 'val-pos' : 'val-neg') + '">' + (l.tipo === 'credito' ? '+ ' : '- ') + fmt(l.valor) + '</span></td>'
        + '<td><div class="row-actions"><button class="btn-icon" onclick="editExtrato(' + realIdx + ')" title="Editar">&#9998;</button><button class="btn-icon danger" onclick="deleteExtrato(' + realIdx + ')" title="Excluir">&#128465;</button></div></td>'
        + '</tr>';
    });
    html += '</tbody></table>';
  }

  if (lncs.length === 0) {
    html += '<div class="empty-state">Nenhum lancamento</div>';
  } else if (filtrados.length === 0) {
    html += '<div class="empty-state">Nenhum lancamento encontrado com os filtros atuais.</div>';
  } else {
    html += loteToolbarHtml;
    html += '<table class="data-table">';
    html += '<thead><tr>' + (_exSelecaoLote ? '<th style="width:42px">Sel.</th>' : '') + '<th>Data</th><th>Conta</th>' + (centroCustoAtivo ? '<th>Centro de custo</th>' : '') + (relacionamentoAtivo ? '<th>Relacionado a</th>' : '') + '<th>Descricao</th><th>Categoria</th><th>Valor</th><th></th></tr></thead><tbody>';
    var colspanTabela = 6 + (_exSelecaoLote ? 1 : 0) + (centroCustoAtivo ? 1 : 0) + (relacionamentoAtivo ? 1 : 0);
    var filtradosOrdenados = [...filtrados].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    var gruposDia = [];
    filtradosOrdenados.forEach(function(item) {
      var chaveDia = item.data || '';
      var ultimoGrupo = gruposDia[gruposDia.length - 1];
      if (!ultimoGrupo || ultimoGrupo.data !== chaveDia) {
        gruposDia.push({ data: chaveDia, itens: [item] });
      } else {
        ultimoGrupo.itens.push(item);
      }
    });

    var fechamentoPorDia = {};
    var saldoAcumuladoExtrato = 0;
    [...gruposDia].reverse().forEach(function(grupoDia) {
      var fechamentoDiaAsc = extratoResumoSaldoDiaHtml(grupoDia.data, grupoDia.itens, colspanTabela, saldoAcumuladoExtrato);
      saldoAcumuladoExtrato = fechamentoDiaAsc.saldoAcumulado;
      fechamentoPorDia[grupoDia.data || ''] = fechamentoDiaAsc;
    });

    gruposDia.forEach(function(grupoDia) {
      grupoDia.itens.forEach(function(l) {
      var realIdx = lncs.indexOf(l);
      var detalhes = [];
      if (l.descOriginal && l.descOriginal !== l.desc) detalhes.push('Banco: ' + esc(l.descOriginal));
      if (l.observacao) detalhes.push('Obs: ' + esc(l.observacao));
      var concResumo = resumoConciliacaoLancamento(l);
      if (concResumo) detalhes.push(concResumo);
      var resumoEstorno = extratoResumoEstorno(c, l);
      if (resumoEstorno) detalhes.push(resumoEstorno);
      var classeEstorno = extratoClasseEstornoLinha(c, l);
      html += '<tr class="row-' + l.tipo + (classeEstorno ? ' ' + classeEstorno : '') + '">'
        + (_exSelecaoLote ? '<td><input type="checkbox" onchange="toggleLinhaSelecaoExtrato(\'' + esc(l.id) + '\')"' + (_exSelecionados.has(l.id) ? ' checked' : '') + '/></td>' : '')
        + '<td style="color:var(--muted);font-size:.78rem">' + (l.data ? l.data.split('-').reverse().join('/') : '-') + '</td>'
        + '<td style="color:var(--muted);font-size:.78rem">' + esc(nomeContaCompactaPorId(c, l.contaId)) + '</td>'
        + (centroCustoAtivo ? '<td style="color:var(--muted);font-size:.78rem">' + esc(nomeCentroCustoPorId(c, l.centroCustoId)) + '</td>' : '')
        + (relacionamentoAtivo ? '<td style="color:var(--muted);font-size:.78rem">' + esc(nomeRelacionamentoPorId(c, l.relacionamentoId)) + '</td>' : '')
        + '<td>' + esc(l.desc || '') + (detalhes.length ? '<div style="color:var(--muted);font-size:.72rem;margin-top:3px">' + detalhes.join(' · ') + '</div>' : '') + '</td>'
        + '<td>' + extratoCategoriaBadgeHtml(l) + '</td>'
        + '<td><span class="val ' + (l.tipo === 'credito' ? 'val-pos' : 'val-neg') + '">' + (l.tipo === 'credito' ? '+ ' : '- ') + fmt(l.valor) + '</span></td>'
        + '<td><div class="row-actions">'
        + (financeiroPJAtivo && !extratoIgnoraConciliacao(l) ? '<button class="btn-icon" onclick="openExtratoConciliacaoModal(' + realIdx + ')" title="Conciliar">C</button>' : '')
        + '<button class="btn-icon" onclick="editExtrato(' + realIdx + ')" title="Editar">&#9998;</button><button class="btn-icon danger" onclick="deleteExtrato(' + realIdx + ')" title="Excluir">&#128465;</button></div></td>'
        + '</tr>';
      });
      var fechamentoDia = fechamentoPorDia[grupoDia.data || ''] || extratoResumoSaldoDiaHtml(grupoDia.data, grupoDia.itens, colspanTabela, 0);
      html += fechamentoDia.html;
    });

    html += '</tbody></table>';
  }

  area.innerHTML = html;
  aplicarAjustesVisuaisExtrato(area, lncs);
  atualizarPlaceholdersFiltrosExtrato();

  var dataInput = document.getElementById('ex-data');
  if (dataInput) dataInput.value = new Date().toISOString().slice(0, 10);

  setTipoExtrato(_exTipo);
  initMoneyInputs(area);
  if (financeiroPJAtivo && relacionamentoAtivo) {
    var descInput = document.getElementById('ex-desc');
    var relSelect = document.getElementById('ex-relacionamento');
    if (descInput) descInput.addEventListener('input', atualizarSugestaoRelacionamentoNovo);
    if (relSelect) relSelect.addEventListener('change', function() { registrarInteracaoManualRelacionamento('ex-relacionamento'); });
    atualizarSugestaoRelacionamentoNovo();
  }
}
async function addExtrato() {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var dataLanc = document.getElementById('ex-data').value;
  var desc = formatDescriptionTitleCase(document.getElementById('ex-desc').value);
  var cat = document.getElementById('ex-cat').value;
  var centroCustoId = extratoCentroCustoAtivo() ? ((((document.getElementById('ex-centro-custo') || {}).value) || '').trim() || null) : null;
  var contaId = ((document.getElementById('ex-conta') || {}).value) || null;
  var relacionamentoId = extratoRelacionamentoAtivo() ? ((((document.getElementById('ex-relacionamento') || {}).value) || null)) : null;
  var observacao = ((document.getElementById('ex-obs') || {}).value || '').trim();
  var valor = parseMoney(document.getElementById('ex-valor'));

  if (!desc || !valor) {
    alert('Preencha os campos');
    return;
  }

  const payload = {
    cliente_id: activeClient,
    data_lancamento: dataLanc || null,
    descricao: desc,
    descricao_original: desc,
    categoria: cat || null,
    centro_custo_id: centroCustoId,
    tipo: _exTipo,
    valor: Number(valor),
    conta_id: contaId || null,
    relacionamento_id: relacionamentoId || null,
    observacao: observacao || null
  };

  const { error } = await insertLancamentoComFallback(payload);

  if (error) {
    console.error(error);
    if (isMissingRelacionamentoSchemaError(error)) {
      alert('Os campos de relacionamento ainda nao existem no Supabase. Rode o arquivo sql/20260510_relacionamentos_extrato.sql no SQL Editor.');
      return;
    }
    alert('Erro ao salvar: ' + (error.message || 'erro desconhecido'));
    return;
  }

  await loadData();
  renderExtrato();
}

async function importExtratoXlsx(event) {
  var file = event.target.files[0];
  if (!file) return;
  if (!activeClient) return alert('Selecione um cliente primeiro.');

  var contaId = (document.getElementById('ex-import-conta') && document.getElementById('ex-import-conta').value) || '';
  var relacionamentoIdFixo = extratoRelacionamentoAtivo() ? (((document.getElementById('ex-import-relacionamento') && document.getElementById('ex-import-relacionamento').value) || '')) : '';
  if (!contaId) {
    event.target.value = '';
    return alert('Selecione a conta do extrato antes de importar.');
  }

  var reader = new FileReader();
  reader.onload = async function(e) {
    var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
    var ws = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    var header = (rows[0] || []).map(h => String(h).toLowerCase().trim());
    var iDate = header.findIndex(h => h.includes('data') || h.includes('date'));
    var iDesc = header.findIndex(h => h.includes('desc'));
    var iVal = header.findIndex(h => h.includes('valor') || h.includes('value') || h.includes('amount'));
    var iCat = header.findIndex(h => h.includes('cat'));

    if (iDate < 0 || iDesc < 0 || iVal < 0) {
      return alert('Planilha invalida. Colunas obrigatorias: data, descricao, valor.');
    }

    var c = data.clients[activeClient];
    var count = 0;
    var erros = 0;

    for (const row of rows.slice(1)) {
      var dataFmt = normalizarDataImportada(row[iDate]);
      var desc = formatDescriptionTitleCase(String(row[iDesc] || ''));
      var valorBruto = lerValorImportadoExtrato(row[iVal]);
      var tipo = inferirTipoImportadoExtrato(valorBruto);
      var valor = Math.abs(Number(valorBruto || 0));
      var cat = iCat >= 0 ? String(row[iCat] || 'Outros').trim() : 'Outros';

      if (!desc || !valor) continue;

      var duplicado = (c.extrato || []).find(l =>
        (l.data || '') === (dataFmt || '')
        && String(l.desc || '') === desc
        && Number(l.valor || 0) === Number(valor || 0)
        && (l.tipo || '') === tipo
        && (l.contaId || '') === contaId
      );

      if (duplicado && !(await appConfirm('Ja existe um lancamento nessa conta com a mesma data, descricao, valor e tipo: "' + desc + '". Deseja importar novamente?', { title: 'Lancamento duplicado', confirmText: 'Importar novamente' }))) {
        continue;
      }

      var relacionamentoSugerido = !relacionamentoIdFixo && extratoRelacionamentoAtivo() ? sugerirRelacionamentoPorTexto(desc) : null;

      const { error } = await insertLancamentoComFallback({
        cliente_id: activeClient,
        data_lancamento: dataFmt || null,
        descricao: desc,
        descricao_original: desc,
        categoria: cat || 'Outros',
        centro_custo_id: null,
        tipo: tipo,
        valor: Number(valor || 0),
        conta_id: contaId,
        relacionamento_id: relacionamentoIdFixo || (relacionamentoSugerido ? relacionamentoSugerido.id : null)
      });

      if (error) {
        console.error('Erro ao importar item do extrato:', row, error);
        erros++;
      } else {
        count++;
      }
    }

    await loadData();
    renderExtrato();
    alert(count + ' lancamento(s) do extrato importado(s) com sucesso!' + (erros ? ' ' + erros + ' falharam.' : ''));
  };

  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

function openExtratoEditModal(i) {
  var c = data.clients[activeClient];
  var lanc = c && c.extrato ? c.extrato[i] : null;
  if (!lanc || !lanc.id) return;

  var cats = nomesCC();
  var catAtual = String(lanc.cat || '').trim();
  if (catAtual && !cats.includes(catAtual)) cats = [catAtual].concat(cats);
  cats = [...new Set(cats)].sort(compararCategoriaNome);
  var catOpts = cats.map(cat =>
    '<option value="' + esc(cat) + '"' + (catAtual === String(cat) ? ' selected' : '') + '>' + esc(cat) + '</option>'
  ).join('');

  document.getElementById('modalTitle').textContent = 'Editar lancamento';
  document.getElementById('modalBody').innerHTML =
    '<div class="form-row">'
    + '<div class="form-group" style="max-width:160px"><label>Data</label><input type="date" id="ex-edit-data" value="' + esc(lanc.data || '') + '"/></div>'
    + '<div class="form-group"><label>Descricao</label><input type="text" id="ex-edit-desc" value="' + esc(lanc.desc || '') + '" placeholder="Ex: salario, aluguel..." onblur="this.value=formatDescriptionTitleCase(this.value)"/></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Descricao do banco</label><input type="text" id="ex-edit-desc-original" value="' + esc(lanc.descOriginal || lanc.desc || '') + '" readonly/></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:190px"><label>Categoria <span style="color:var(--accent);cursor:pointer;font-size:.68rem" onclick="openModal(\'settings\',\'cats_cc\')">(+ gerir)</span></label><select id="ex-edit-cat">' + catOpts + '</select></div>'
    + (extratoCentroCustoAtivo() ? '<div class="form-group" style="max-width:220px"><label>Centro de custo</label><select id="ex-edit-centro-custo">' + centrosCustoOptionsCliente(lanc.centroCustoId || '', true) + '</select></div>' : '')
    + '<div class="form-group" style="max-width:260px"><label>Conta</label><select id="ex-edit-conta">' + contasOptionsCliente(lanc.contaId || '') + '</select></div>'
    + (extratoRelacionamentoAtivo() ? '<div class="form-group" style="max-width:220px"><label>Relacionado a</label><select id="ex-edit-relacionamento">' + relacionamentoOptionsCliente(lanc.relacionamentoId || '', true) + '</select></div>' : '')
    + '<div class="form-group" style="max-width:160px"><label>Tipo</label><select id="ex-edit-tipo"><option value="credito"' + (lanc.tipo === 'credito' ? ' selected' : '') + '>Credito</option><option value="debito"' + (lanc.tipo === 'debito' ? ' selected' : '') + '>Debito</option></select></div>'
    + '<div class="form-group" style="max-width:170px"><label>Valor (R$)</label><input type="text" id="ex-edit-valor" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '</div>'
    + (extratoRelacionamentoAtivo() ? '<div id="ex-edit-rel-suggestion" style="margin:-4px 0 12px"></div>' : '')
    + '<div class="form-row"><div class="form-group"><label>Observacao</label><input type="text" id="ex-edit-obs" value="' + esc(lanc.observacao || '') + '" placeholder="Opcional. Ex: Pagamento pessoal feito para a empresa."/></div></div>'
    + '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:18px">'
    + '<button class="btn-sm red" type="button" onclick="closeModal()">Cancelar</button>'
    + '<button class="btn-add" type="button" style="margin-top:0" onclick="saveExtratoEditModal(' + i + ')">Salvar alteracoes</button>'
    + '</div>';

  document.getElementById('modalOverlay').classList.add('open');
  document.addEventListener('keydown', handleMainModalEscape);
  initMoneyInputs(document.getElementById('modalBody'));

  var valorInput = document.getElementById('ex-edit-valor');
  if (valorInput) {
    var cents = Math.round(Number(lanc.valor || 0) * 100);
    valorInput.dataset.cents = String(cents);
    valorInput.value = Number(lanc.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (extratoRelacionamentoAtivo()) {
    var relSelect = document.getElementById('ex-edit-relacionamento');
    if (relSelect) relSelect.addEventListener('change', function() { registrarInteracaoManualRelacionamento('ex-edit-relacionamento'); });
    atualizarSugestaoRelacionamentoEdicao();
  }
}

function extratoConciliacaoOptionsHtml(natureza, selecionadoId) {
  if (typeof tfTitulosDisponiveisParaNatureza !== 'function') return '<option value="">Sem titulos disponiveis</option>';
  var titulos = tfTitulosDisponiveisParaNatureza(natureza);
  if (!titulos.length) return '<option value="">Sem titulos disponiveis</option>';
  return '<option value="">Selecione um titulo</option>' + titulos.map(function(item) {
    return '<option value="' + esc(item.id) + '" data-saldo="' + esc(String(tfSaldo(item))) + '"' + (item.id === selecionadoId ? ' selected' : '') + '>'
      + esc(item.pessoaNome || '-')
      + ' - ' + esc(item.descricao || '-')
      + ' (saldo ' + fmt(tfSaldo(item)) + ')'
      + '</option>';
  }).join('');
}

function syncExtratoConciliacaoValor(lancamentoValor) {
  var select = document.getElementById('ex-conciliar-titulo');
  var valorInput = document.getElementById('ex-conciliar-valor');
  if (!select || !valorInput) return;
  var option = select.options[select.selectedIndex];
  var saldo = option ? Number(option.dataset.saldo || 0) : 0;
  var restante = Number(lancamentoValor || 0);
  if (!saldo || !restante) {
    valorInput.value = '0,00';
    valorInput.dataset.cents = '0';
    return;
  }
  var alvo = Math.min(saldo, restante);
  valorInput.value = Number(alvo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  valorInput.dataset.cents = String(Math.round(alvo * 100));
}

function openExtratoConciliacaoModal(i) {
  if (!clienteAtivoEhPJ()) return alert('A conciliacao financeira esta disponivel apenas para clientes PJ.');
  var c = data.clients[activeClient];
  var lanc = c && c.extrato ? c.extrato[i] : null;
  if (!lanc || !lanc.id) return;

  var natureza = naturezaFinanceiraDoExtrato(lanc.tipo || 'credito');
  var naturezaLabel = natureza === 'receber' ? 'Conta a receber' : 'Conta a pagar';
  var acaoLabel = natureza === 'receber' ? 'Conciliar recebimento' : 'Conciliar pagamento';
  var conciliado = valorConciliadoDoLancamento(lanc);
  var restante = Math.max(0, Number(lanc.valor || 0) - conciliado);
  var baixas = baixasFinanceirasDoLancamento(lanc);
  var baixasHtml = baixas.length
    ? baixas.map(function(item) {
        return '<div class="tf-baixa-item">'
          + '<div><strong>' + esc(item.tituloPessoa || '-') + '</strong><small>' + esc(item.tituloDescricao || '-') + ' · ' + esc(formatDate(item.baixa.data)) + '</small></div>'
          + '<div style="display:flex;align-items:center;gap:10px"><strong style="color:var(--accent3)">' + fmt(item.baixa.valor) + '</strong><button class="btn-icon danger" onclick="desconciliarExtratoBaixa(\'' + esc(lanc.id) + '\',\'' + esc(item.tituloId) + '\',\'' + esc(item.baixa.id) + '\',' + i + ')" title="Desconciliar">&#128465;</button></div>'
          + '</div>';
      }).join('')
    : '<div class="empty-state" style="padding:18px 12px">Nenhuma conciliacao registrada neste lancamento.</div>';

  document.getElementById('modalTitle').textContent = acaoLabel;
  document.getElementById('modalBody').innerHTML =
    '<div class="settings-card-badges" style="margin:0 0 18px 0">'
      + '<span class="settings-card-badge">' + esc(naturezaLabel) + '</span>'
      + '<span class="settings-card-badge subtle">Lancamento ' + fmt(lanc.valor || 0) + '</span>'
      + '<span class="settings-card-badge subtle">Conciliado ' + fmt(conciliado) + '</span>'
      + '<span class="settings-card-badge subtle">Restante ' + fmt(restante) + '</span>'
    + '</div>'
    + '<div class="settings-section-card" style="margin-bottom:16px">'
      + '<div class="settings-card-head"><div><h5>Lancamento do extrato</h5><p>Use este credito ou debito do banco para baixar um titulo financeiro do cliente PJ.</p></div></div>'
      + '<div class="form-row">'
        + '<div class="form-group" style="max-width:160px"><label>Data</label><input type="text" value="' + esc(formatDate(lanc.data)) + '" readonly/></div>'
        + '<div class="form-group" style="max-width:180px"><label>Conta</label><input type="text" value="' + esc(nomeContaPorId(c, lanc.contaId)) + '" readonly/></div>'
        + '<div class="form-group" style="max-width:160px"><label>Tipo</label><input type="text" value="' + esc(lanc.tipo === 'credito' ? 'Credito' : 'Debito') + '" readonly/></div>'
        + '<div class="form-group" style="max-width:170px"><label>Valor</label><input type="text" value="' + esc(fmt(lanc.valor || 0)) + '" readonly/></div>'
      + '</div>'
      + '<div class="form-row"><div class="form-group"><label>Descricao do banco</label><input type="text" value="' + esc(lanc.descOriginal || lanc.desc || '') + '" readonly/></div></div>'
      + (extratoRelacionamentoAtivo() && lanc.relacionamentoId ? '<div class="form-row"><div class="form-group"><label>Relacionado a</label><input type="text" value="' + esc(nomeRelacionamentoPorId(c, lanc.relacionamentoId)) + '" readonly/></div></div>' : '')
    + '</div>'
    + '<div class="settings-section-card">'
      + '<div class="settings-card-head"><div><h5>Baixas conciliadas</h5><p>Voce pode vincular este lancamento a mais de um titulo, desde que o total conciliado nao ultrapasse o valor do banco.</p></div></div>'
      + baixasHtml
      + '<div class="form-row" style="margin-top:16px">'
        + '<div class="form-group"><label>Titulo para conciliar</label><select id="ex-conciliar-titulo" onchange="syncExtratoConciliacaoValor(' + Number(restante || 0) + ')">' + extratoConciliacaoOptionsHtml(natureza, '') + '</select></div>'
      + '</div>'
      + '<div class="form-row">'
        + '<div class="form-group" style="max-width:170px"><label>Valor da baixa</label><input type="text" id="ex-conciliar-valor" class="money-input" value="' + esc(Number(restante || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '"/></div>'
        + '<div class="form-group"><label>Observacao</label><input type="text" id="ex-conciliar-obs" placeholder="Ex.: recebimento parcial, pagamento fornecedor"/></div>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:14px">'
        + '<button class="btn-sm red" type="button" onclick="closeModal()">Fechar</button>'
        + '<button class="btn-add" type="button" style="margin-top:0" onclick="conciliarExtratoLancamento(' + i + ')">' + acaoLabel + '</button>'
      + '</div>'
    + '</div>';

  document.getElementById('modalOverlay').classList.add('open');
  document.addEventListener('keydown', handleMainModalEscape);
  initMoneyInputs(document.getElementById('modalBody'));
  syncExtratoConciliacaoValor(restante);
}

async function conciliarExtratoLancamento(i) {
  var c = data.clients[activeClient];
  var lanc = c && c.extrato ? c.extrato[i] : null;
  if (!lanc || !lanc.id) return;

  var natureza = naturezaFinanceiraDoExtrato(lanc.tipo || 'credito');
  var tituloId = ((document.getElementById('ex-conciliar-titulo') || {}).value) || '';
  var valor = parseMoney(document.getElementById('ex-conciliar-valor'));
  var observacao = ((document.getElementById('ex-conciliar-obs') || {}).value || '').trim();

  if (!tituloId) return alert('Selecione um titulo para conciliar.');
  if (!valor || valor <= 0) return alert('Informe um valor de baixa maior que zero.');

  if (typeof tfFindTituloById !== 'function') return alert('O modulo Financeiro nao esta disponivel neste momento.');
  var titulo = tfFindTituloById(tituloId);
  if (!titulo) return alert('Titulo nao encontrado.');

  var saldoTitulo = tfSaldo(titulo);
  var restanteLanc = Math.max(0, Number(lanc.valor || 0) - valorConciliadoDoLancamento(lanc));
  if (valor > saldoTitulo) return alert('O valor informado ultrapassa o saldo do titulo.');
  if (valor > restanteLanc) return alert('O valor informado ultrapassa o restante disponivel deste lancamento.');

  var response = await supabaseClient
    .from('titulos_financeiros_baixas')
    .insert([Object.assign({
      titulo_id: tituloId,
      cliente_id: activeClient,
      data_baixa: lanc.data || new Date().toISOString().slice(0, 10),
      valor: Number(valor),
      observacao: observacao || ('Conciliado pelo extrato: ' + (lanc.descOriginal || lanc.desc || '')),
      origem: 'extrato',
      extrato_lancamento_id: lanc.id
    }, getUserScopePayload())])
    .select()
    .single();

  if (response.error) {
    console.error(response.error);
    alert('Nao foi possivel conciliar este lancamento. Verifique se a migracao 20260520_titulos_financeiros_pj.sql ja foi aplicada no Supabase.');
    return;
  }

  if (!Array.isArray(titulo.baixas)) titulo.baixas = [];
  titulo.baixas.push({
    id: response.data.id,
    data: response.data.data_baixa || null,
    valor: Number(response.data.valor || 0),
    observacao: response.data.observacao || '',
    origem: response.data.origem || 'extrato',
    lancamentoId: response.data.extrato_lancamento_id || null,
    userId: response.data.user_id || null
  });

  closeModal();
  if (_exFiltroConciliacao === 'nao_conciliados') {
    _exFiltroConciliacao = 'todos';
  }
  await loadData();
  renderExtrato();
}

async function desconciliarExtratoBaixa(lancamentoId, tituloId, baixaId, extratoIdx) {
  var ok = await appConfirm('Desconciliar esta baixa do extrato?', { title: 'Desconciliar baixa', confirmText: 'Desconciliar' });
  if (!ok) return;

  var response = await applyUserScope(
    supabaseClient
      .from('titulos_financeiros_baixas')
      .delete()
      .eq('id', baixaId)
  );

  if (response.error) {
    console.error(response.error);
    alert('Nao foi possivel desfazer a conciliacao.');
    return;
  }

  if (typeof tfFindTituloById === 'function') {
    var titulo = tfFindTituloById(tituloId);
    if (titulo) titulo.baixas = (titulo.baixas || []).filter(function(baixa) { return baixa.id !== baixaId; });
  }

  if (_exFiltroConciliacao === 'conciliados') {
    _exFiltroConciliacao = 'todos';
  }
  await loadData();
  renderExtrato();
  var cAtual = data.clients[activeClient];
  var novoIdx = cAtual && cAtual.extrato ? cAtual.extrato.findIndex(function(item) { return item.id === lancamentoId; }) : -1;
  if (novoIdx >= 0) openExtratoConciliacaoModal(novoIdx);
}

async function deleteExtrato(i) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var c = data.clients[activeClient];
  var lanc = c.extrato[i];

  if (!lanc) return;

  var origensEstorno = (c.extrato || []).filter(function(item) {
    return item && item.estornoLancamentoId === lanc.id;
  });
  if (origensEstorno.length) {
    const { error: estornoError } = await applyUserScope(
      supabaseClient
        .from('lancamentos')
        .update({
          status_estorno: 'pendente_estorno',
          estorno_lancamento_id: null,
          estorno_data: null
        })
        .in('id', origensEstorno.map(function(item) { return item.id; }))
    );
    if (estornoError) {
      console.error(estornoError);
      alert('Nao foi possivel atualizar os lancamentos pendentes de estorno antes de excluir.');
      return;
    }
  }

  if (typeof tfBaixasPorLancamentoId === 'function') {
    var baixasFinanceiras = tfBaixasPorLancamentoId(lanc.id);
    for (var bi = 0; bi < baixasFinanceiras.length; bi++) {
      var baixaInfo = baixasFinanceiras[bi];
      const { error: baixaError } = await applyUserScope(
        supabaseClient
          .from('titulos_financeiros_baixas')
          .delete()
          .eq('id', baixaInfo.baixa.id)
      );
      if (baixaError) {
        console.error(baixaError);
        alert('Nao foi possivel remover as conciliacoes financeiras antes de excluir o lancamento.');
        return;
      }
    }
  }

  const { error } = await applyUserScope(
    supabaseClient
      .from('lancamentos')
      .delete()
      .eq('id', lanc.id)
  );

  if (error) {
    console.error(error);
    alert('Erro ao excluir');
    return;
  }

  if (typeof dividaReferenteAoPagamento === 'function' && typeof recalcularDividaPorHistorico === 'function') {
    var divida = dividaReferenteAoPagamento(c, lanc);
    if (divida) await recalcularDividaPorHistorico(c, divida, lanc.id);
  }

  await loadData();
  renderExtrato();
}

async function editExtrato(i) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  openExtratoEditModal(i);
}

async function saveExtratoEditModal(i) {
  if (!canEditActiveClient()) return alert('Este cliente pertence a outro login e esta disponivel apenas para visualizacao.');
  var c = data.clients[activeClient];
  var lanc = c && c.extrato ? c.extrato[i] : null;
  if (!lanc || !lanc.id) return;

  var novaData = document.getElementById('ex-edit-data').value;
  var novaDesc = formatDescriptionTitleCase(document.getElementById('ex-edit-desc').value);
  var descOriginal = document.getElementById('ex-edit-desc-original').value.trim();
  var novaCat = document.getElementById('ex-edit-cat').value;
  var novoCentroCustoId = extratoCentroCustoAtivo() ? ((((document.getElementById('ex-edit-centro-custo') || {}).value) || '').trim() || null) : null;
  var novaContaId = document.getElementById('ex-edit-conta').value || null;
  var relField = document.getElementById('ex-edit-relacionamento');
  var novoRelacionamentoId = extratoRelacionamentoAtivo() && relField ? (relField.value || null) : null;
  var novoTipo = document.getElementById('ex-edit-tipo').value === 'credito' ? 'credito' : 'debito';
  var novoValor = parseMoney(document.getElementById('ex-edit-valor'));
  var novaObservacao = document.getElementById('ex-edit-obs').value.trim();
  var origemEstorno = extratoLancamentoOrigemDoEstorno(c, lanc.id);

  if (!novaDesc || !novoValor) return alert('Descricao e valor sao obrigatorios.');

  var valorConciliado = valorConciliadoDoLancamento(lanc);
  if (valorConciliado > 0 && novoTipo !== (lanc.tipo || 'credito')) {
    return alert('Desfaca primeiro a conciliacao financeira antes de mudar o tipo deste lancamento.');
  }
  if (valorConciliado > 0 && Number(novoValor || 0) < valorConciliado) {
    return alert('O novo valor nao pode ser menor que o valor ja conciliado no Financeiro.');
  }
  if (origemEstorno && novoTipo !== (lanc.tipo || 'credito')) {
    return alert('Esse lancamento esta vinculado como estorno de outro registro. Desfaca o vinculo antes de mudar o tipo.');
  }
  if (origemEstorno && Math.abs(Number(novoValor || 0) - Number(lanc.valor || 0)) >= 0.005) {
    return alert('Esse lancamento esta vinculado como estorno de outro registro. Desfaca o vinculo antes de alterar o valor.');
  }

  const { error } = await applyUserScope(
    supabaseClient
      .from('lancamentos')
      .update({
        data_lancamento: novaData || null,
        descricao: novaDesc,
        descricao_original: descOriginal || lanc.descOriginal || lanc.desc || null,
        categoria: novaCat || null,
        centro_custo_id: novoCentroCustoId,
        tipo: novoTipo,
        valor: Number(novoValor || 0),
        conta_id: novaContaId,
        relacionamento_id: novoRelacionamentoId,
        observacao: novaObservacao || null
      })
      .eq('id', lanc.id)
  );

  if (error) {
    console.error('Erro ao editar lancamento:', error);
    if (isMissingRelacionamentoSchemaError(error)) {
      alert('Os campos de relacionamento ainda nao existem no Supabase. Rode o arquivo sql/20260510_relacionamentos_extrato.sql no SQL Editor.');
      return;
    }
    alert('Nao foi possivel editar o lancamento: ' + (error.message || 'erro desconhecido'));
    return;
  }

  await loadData();
  closeModal();
  renderExtrato();
}
