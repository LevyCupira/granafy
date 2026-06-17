var _dreView = 'geral';
var _dreEventoId = '';

function setDreView(view) {
  _dreView = view === 'eventos' ? 'eventos' : 'geral';
  renderDRE();
}

function dreMesesDisponiveis(transacoes) {
  return Array.from(new Set((transacoes || []).map(function(l) {
    return (l.data || '').slice(0, 7);
  }).filter(Boolean))).sort().reverse();
}

function dreFiltrarMes(transacoes, mes) {
  return mes ? (transacoes || []).filter(function(l) { return (l.data || '').startsWith(mes); }) : (transacoes || []);
}

function dreEventoNome(cliente, eventoId) {
  var eventos = cliente && Array.isArray(cliente.eventos) ? cliente.eventos : [];
  var evento = eventos.find(function(item) { return item.id === eventoId; });
  return evento ? evento.nome : 'Sem evento';
}

function dreLancamentoExtratoPorId(cliente, lancamentoId) {
  if (!cliente || !lancamentoId) return null;
  return (cliente.extrato || []).find(function(item) { return item.id === lancamentoId; }) || null;
}

function dreTransacoesDoTitulo(cliente, titulo, baixa) {
  var valorBaixa = Math.abs(Number(baixa && baixa.valor || 0));
  if (!valorBaixa || !titulo || !titulo.eventoId) return [];
  var tipo = titulo.natureza === 'receber' ? 'credito' : 'debito';
  var lanc = dreLancamentoExtratoPorId(cliente, baixa.lancamentoId);
  var rateios = typeof normalizarRateiosCategorias === 'function' && lanc
    ? normalizarRateiosCategorias(lanc.rateios || [])
    : [];
  var totalRateio = rateios.reduce(function(sum, item) { return sum + Number(item.valor || 0); }, 0);
  var base = {
    data: baixa.data,
    desc: titulo.descricao || titulo.pessoaNome || '',
    tipo: tipo,
    fonte: 'Financeiro',
    eventoId: titulo.eventoId,
    evento: titulo.evento || dreEventoNome(cliente, titulo.eventoId),
    ehMovConta: false
  };

  if (rateios.length && totalRateio > 0) {
    return rateios.map(function(rateio, idx) {
      return Object.assign({}, base, {
        cat: rateio.categoria || titulo.categoria || 'Outros',
        valor: valorBaixa * (Number(rateio.valor || 0) / totalRateio),
        _resumoKey: 'dre:evento:' + titulo.id + ':' + (baixa.id || idx) + ':r:' + idx
      });
    });
  }

  return [Object.assign({}, base, {
    cat: titulo.categoria || 'Outros',
    valor: valorBaixa,
    _resumoKey: 'dre:evento:' + titulo.id + ':' + (baixa.id || '')
  })];
}

function dreTransacoesEventos(cliente) {
  if (!cliente) return [];
  var transacoes = [];
  (cliente.titulos || []).forEach(function(titulo) {
    if (!titulo || !titulo.eventoId) return;
    (titulo.baixas || []).forEach(function(baixa) {
      transacoes = transacoes.concat(dreTransacoesDoTitulo(cliente, titulo, baixa));
    });
  });
  return transacoes;
}

function dreResumoConsolidado(transacoes) {
  var consolidado = consolidarTransacoesAnaliticas(transacoes);
  var fixas = consolidado.despesas.filter(function(entry) { return entry.classe === 'fixa'; });
  var variaveis = consolidado.despesas.filter(function(entry) { return entry.classe !== 'fixa'; });
  var tReceita = consolidado.totalReceitas;
  var tFixas = fixas.reduce(function(s, entry) { return s + entry.valor; }, 0);
  var tVariavel = variaveis.reduce(function(s, entry) { return s + entry.valor; }, 0);
  var resultado = tReceita - tFixas - tVariavel;
  return {
    consolidado: consolidado,
    receitas: consolidado.receitas,
    fixas: fixas,
    variaveis: variaveis,
    totalReceitas: tReceita,
    totalFixas: tFixas,
    totalVariaveis: tVariavel,
    totalDespesas: tFixas + tVariavel,
    resultado: resultado,
    margem: tReceita > 0 ? (resultado / tReceita * 100) : 0,
    movContas: consolidado.movContas,
    transacoes: transacoes || []
  };
}

function dreMesOptionsHtml(meses, mesAtual) {
  return '<option value=""' + (mesAtual === '' ? ' selected' : '') + '>Todos os meses</option>'
    + meses.map(function(m) {
      var parts = m.split('-');
      return '<option value="' + esc(m) + '"' + (m === mesAtual ? ' selected' : '') + '>' + parts[1] + '/' + parts[0] + '</option>';
    }).join('');
}

function dreEventoOptionsHtml(cliente, selectedId) {
  var eventos = cliente && Array.isArray(cliente.eventos) ? cliente.eventos : [];
  return '<option value=""' + (!selectedId ? ' selected' : '') + '>Todos os eventos</option>'
    + eventos.map(function(evento) {
      return '<option value="' + esc(evento.id) + '"' + (evento.id === selectedId ? ' selected' : '') + '>' + esc(evento.nome || '') + (evento.ativo === false ? ' (inativo)' : '') + '</option>';
    }).join('');
}

function dreKpisHtml(resumo, eventosCount, modo) {
  var resClass = resumo.resultado >= 0 ? 'green' : 'red';
  return '<div class="dre-kpi-grid">'
    + '<div class="summary-card"><div class="s-label">Receitas</div><div class="s-val green">' + fmt(resumo.totalReceitas) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Despesas</div><div class="s-val red">' + fmt(resumo.totalDespesas) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Resultado</div><div class="s-val ' + resClass + '">' + fmt(resumo.resultado) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Margem</div><div class="s-val ' + resClass + '">' + resumo.margem.toFixed(1) + '%</div></div>'
    + '<div class="summary-card"><div class="s-label">' + (modo === 'eventos' ? 'Eventos' : 'Transacoes') + '</div><div class="s-val blue">' + (modo === 'eventos' ? eventosCount : resumo.transacoes.length) + '</div></div>'
    + '</div>';
}

function dreRow(label, valor, cls, indent, pct) {
  return '<tr>'
    + '<td class="' + (indent ? 'indent' : '') + '">' + esc(label) + (typeof pct === 'number' ? '<small>' + pct.toFixed(1) + '%</small>' : '') + '</td>'
    + '<td class="' + cls + '">' + (indent ? '(' + fmt(valor) + ')' : fmt(valor)) + '</td>'
    + '</tr>';
}

function dreTotal(label, valor, cls, strong) {
  return '<tr class="dre-total' + (strong ? ' strong' : '') + '">'
    + '<td>' + esc(label) + '</td>'
    + '<td class="' + cls + '">' + fmt(valor) + '</td>'
    + '</tr>';
}

function dreSectionHtml(label, cls, rows, emptyText) {
  return '<tr class="dre-section ' + cls + '"><td colspan="2">' + esc(label) + '</td></tr>'
    + (rows || '<tr><td colspan="2" class="dre-empty">' + esc(emptyText) + '</td></tr>');
}

function dreTabelaHtml(resumo) {
  var recRows = resumo.receitas.map(function(entry) {
    var pct = resumo.totalReceitas > 0 ? entry.valor / resumo.totalReceitas * 100 : 0;
    return dreRow(entry.cat, entry.valor, 'val-pos', true, pct);
  }).join('');
  var fixRows = resumo.fixas.map(function(entry) {
    var pct = resumo.totalDespesas > 0 ? entry.valor / resumo.totalDespesas * 100 : 0;
    return dreRow(entry.cat, entry.valor, 'val-neg', true, pct);
  }).join('');
  var varRows = resumo.variaveis.map(function(entry) {
    var pct = resumo.totalDespesas > 0 ? entry.valor / resumo.totalDespesas * 100 : 0;
    return dreRow(entry.cat, entry.valor, 'val-neg', true, pct);
  }).join('');
  var resClass = resumo.resultado >= 0 ? 'val-pos' : 'val-neg';
  return '<div class="dre-table-card">'
    + '<table class="dre-table"><thead><tr><th>Descricao</th><th>Valor</th></tr></thead><tbody>'
    + dreSectionHtml('Receitas', 'green', recRows, 'Nenhuma receita no periodo.')
    + dreTotal('(=) Total de Receitas', resumo.totalReceitas, 'val-pos', false)
    + dreSectionHtml('Despesas Fixas', 'red', fixRows, 'Nenhuma despesa fixa no periodo.')
    + dreTotal('(-) Total de Despesas Fixas', resumo.totalFixas, 'val-neg', false)
    + dreSectionHtml('Despesas Variaveis', 'yellow', varRows, 'Nenhuma despesa variavel no periodo.')
    + dreTotal('(-) Total de Despesas Variaveis', resumo.totalVariaveis, 'val-neg', false)
    + dreTotal('(=) Resultado Liquido', resumo.resultado, resClass, true)
    + '<tr><td>Margem liquida</td><td class="' + resClass + '">' + resumo.margem.toFixed(1) + '%</td></tr>'
    + '</tbody></table></div>';
}

function dreEventosResumo(cliente, transacoes) {
  var eventos = cliente && Array.isArray(cliente.eventos) ? cliente.eventos : [];
  return eventos.map(function(evento) {
    var resumo = dreResumoConsolidado((transacoes || []).filter(function(item) { return item.eventoId === evento.id; }));
    return {
      id: evento.id,
      nome: evento.nome || '',
      receita: resumo.totalReceitas,
      despesa: resumo.totalDespesas,
      resultado: resumo.resultado,
      margem: resumo.margem,
      transacoes: resumo.transacoes.length
    };
  }).filter(function(item) {
    return item.receita || item.despesa || item.transacoes;
  }).sort(function(a, b) {
    return b.resultado - a.resultado;
  });
}

function dreEventosRankingHtml(eventosResumo) {
  if (!eventosResumo.length) {
    return '<div class="empty-state" style="padding:24px 12px">Nenhum evento com baixa realizada no periodo.</div>';
  }
  var maior = eventosResumo.reduce(function(max, item) { return Math.max(max, Math.abs(item.resultado), item.receita, item.despesa); }, 1);
  return '<div class="dre-event-list">'
    + eventosResumo.map(function(item) {
      var width = Math.max(4, Math.round(Math.abs(item.resultado) / maior * 100));
      return '<button type="button" class="dre-event-row" onclick="_dreEventoId=\'' + esc(item.id) + '\';renderDRE()">'
        + '<span><strong>' + esc(item.nome) + '</strong><small>Receita ' + fmt(item.receita) + ' - Custo ' + fmt(item.despesa) + ' - Margem ' + item.margem.toFixed(1) + '%</small></span>'
        + '<i><b style="width:' + width + '%;background:' + (item.resultado >= 0 ? 'var(--success)' : 'var(--danger)') + '"></b></i>'
        + '<em class="' + (item.resultado >= 0 ? 'val-pos' : 'val-neg') + '">' + fmt(item.resultado) + '</em>'
      + '</button>';
    }).join('')
    + '</div>';
}

function renderDRE() {
  var cliente = activeClient && data.clients ? data.clients[activeClient] : null;
  if (!cliente) return;

  var geralBase = getTransacoes(activeClient);
  var eventosBase = dreTransacoesEventos(cliente);
  var eventosDisponiveis = cliente.eventosEnabled && Array.isArray(cliente.eventos) && cliente.eventos.length;
  if (_dreView === 'eventos' && !eventosDisponiveis) _dreView = 'geral';
  if (_dreEventoId && !(cliente.eventos || []).some(function(evento) { return evento.id === _dreEventoId; })) {
    _dreEventoId = '';
  }

  var meses = dreMesesDisponiveis(geralBase.concat(eventosBase));
  var selEl = document.getElementById('dre-mes-sel');
  var mesAtual = selEl ? selEl.value : (meses[0] || '');
  var eventoEl = document.getElementById('dre-evento-sel');
  if (eventoEl) _dreEventoId = eventoEl.value || '';

  var geralPeriodo = dreFiltrarMes(geralBase, mesAtual);
  var eventosPeriodo = dreFiltrarMes(eventosBase, mesAtual);
  var eventosFiltrados = _dreEventoId ? eventosPeriodo.filter(function(item) { return item.eventoId === _dreEventoId; }) : eventosPeriodo;
  var resumo = _dreView === 'eventos' ? dreResumoConsolidado(eventosFiltrados) : dreResumoConsolidado(geralPeriodo);
  var eventosResumo = dreEventosResumo(cliente, eventosPeriodo);
  var movTotal = resumo.movContas.reduce(function(s, l) { return s + l.valor; }, 0);

  var controlsHtml =
    '<div class="dre-workbench-hero">'
      + '<div class="dre-workbench-head">'
        + '<div><h3>DRE</h3><p class="cartao-helper-text">Resultado por categorias, com visao geral e leitura por eventos.</p></div>'
        + '<div class="dre-controls">'
          + '<label><span>Periodo</span><select id="dre-mes-sel" onchange="renderDRE()">' + dreMesOptionsHtml(meses, mesAtual) + '</select></label>'
          + (_dreView === 'eventos' && eventosDisponiveis ? '<label><span>' + esc(cliente.eventosLabel || 'Eventos') + '</span><select id="dre-evento-sel" onchange="renderDRE()">' + dreEventoOptionsHtml(cliente, _dreEventoId) + '</select></label>' : '')
        + '</div>'
      + '</div>'
    + '</div>';

  var tabsHtml = '<div class="dre-tabs">'
    + '<button type="button" class="' + (_dreView === 'geral' ? 'active' : '') + '" onclick="setDreView(\'geral\')"><span>Geral</span><strong>' + geralPeriodo.length + '</strong></button>'
    + (eventosDisponiveis ? '<button type="button" class="' + (_dreView === 'eventos' ? 'active' : '') + '" onclick="setDreView(\'eventos\')"><span>' + esc(cliente.eventosLabel || 'Eventos') + '</span><strong>' + eventosResumo.length + '</strong></button>' : '')
    + '</div>';

  var bodyHtml = '';
  if (_dreView === 'eventos') {
    bodyHtml = '<div class="dre-layout">'
      + '<div>' + dreTabelaHtml(resumo) + '</div>'
      + '<div class="dre-side-card"><h4>Resultado por evento</h4>' + dreEventosRankingHtml(eventosResumo) + '</div>'
      + '</div>';
  } else {
    bodyHtml = dreTabelaHtml(resumo)
      + '<div class="dre-note"><strong>Observacao:</strong> a categoria Mov. Contas e tratada como transferencia interna. Ela nao entra como receita nem como despesa no DRE. Total do periodo: <strong>' + fmt(movTotal) + '</strong>.</div>';
  }

  document.getElementById('dre-content').innerHTML =
    controlsHtml
    + tabsHtml
    + dreKpisHtml(resumo, _dreView === 'eventos' ? eventosResumo.length : 0, _dreView)
    + bodyHtml;
}
