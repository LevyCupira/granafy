var _resumoPeriodos = null;
var _resumoView = 'geral';

function setResumoView(view) {
  var views = ['geral', 'categorias', 'lancamentos', 'observacoes'];
  _resumoView = views.includes(view) ? view : 'geral';
  renderResumo();
}

function resumoTipoNormalizado(tipo) {
  return String(tipo || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function resumoEhCredito(tipo) {
  return resumoTipoNormalizado(tipo) === 'credito';
}

function resumoEhDebito(tipo) {
  return resumoTipoNormalizado(tipo) === 'debito';
}

function getTransacoes(clienteId) {
  var c = data.clients[clienteId];
  if (!c) return [];

  var result = [];
  var extratoBase = (c.extrato || []).filter(function(l) { return !isCategoriaCartaoCreditoResumo(l.cat); });
  var extrato = typeof chaveDuplicidadeExtrato === 'function'
    ? filtrarExtratoResumoDuplicados(extratoBase)
    : extratoBase;

  extrato.forEach(function(l, idx) {
    var rateios = typeof normalizarRateiosCategorias === 'function' ? normalizarRateiosCategorias(l.rateios) : [];
    if (rateios.length) {
      rateios.forEach(function(item, rIdx) {
        result.push({
          data: l.data,
          desc: l.desc,
          cat: item.categoria,
          valor: Number(item.valor),
          tipo: l.tipo,
          fonte: 'Conta Corrente',
          ehMovConta: typeof isCategoriaMovContas === 'function' && isCategoriaMovContas(item.categoria),
          _resumoKey: 'ex:' + idx + ':' + String(l.id || '') + ':r:' + rIdx
        });
      });
      return;
    }

    result.push({
      data: l.data,
      desc: l.desc,
      cat: l.cat,
      valor: Number(l.valor),
      tipo: l.tipo,
      fonte: 'Conta Corrente',
      ehMovConta: typeof isCategoriaMovContas === 'function' && isCategoriaMovContas(l.cat),
      _resumoKey: 'ex:' + idx + ':' + String(l.id || '')
    });
  });

  (c.cartao || []).filter(function(l) { return l.tipo !== 'estorno'; }).forEach(function(l, idx) {
    var cc = (c.cartoes || []).find(function(x) { return x.id === l.cartaoId; });
    var fonte = cc ? 'Cartao ' + cc.nome : 'Cartao de Credito';
    result.push({
      data: l.data,
      desc: l.desc,
      cat: l.cat,
      valor: Number(l.valor),
      tipo: 'debito',
      fonte: fonte,
      ehMovConta: false,
      _resumoKey: 'cc:' + idx + ':' + String(l.id || '')
    });
  });

  return result;
}

function isCategoriaCartaoCreditoResumo(cat) {
  var normalizada = String(cat || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  return normalizada === 'cartao de credito';
}

function filtrarExtratoResumoDuplicados(lancamentos) {
  var vistos = new Map();
  var filtrados = [];

  (lancamentos || []).forEach(function(l) {
    var chave = chaveDuplicidadeExtrato(l);
    var resolvido = typeof duplicadoResolvidoExtrato === 'function' && duplicadoResolvidoExtrato(chave, [l]);

    if (resolvido || !vistos.has(chave)) {
      filtrados.push(l);
      vistos.set(chave, true);
    }
  });

  return filtrados;
}

function consolidarTransacoesAnaliticas(transacoes) {
  var movContas = (transacoes || []).filter(function(l) { return l.ehMovConta; });
  var analiticas = (transacoes || []).filter(function(l) { return !l.ehMovConta; });
  var analiticasClassificadas = analiticas.map(function(l) {
    return Object.assign({}, l, {
      resumoClasse: typeof tipoCat === 'function' ? tipoCat(l.cat) : 'variavel',
      ehAbatimentoResumo: false
    });
  });
  var categoriasMap = new Map();

  analiticasClassificadas.forEach(function(l) {
    var cat = l.cat || 'Outros';
    var classe = l.resumoClasse;
    var bucket = categoriasMap.get(cat) || {
      cat: cat,
      classe: classe,
      creditos: 0,
      debitos: 0
    };
    var valor = Number(l.valor || 0);

    var ehCredito = resumoEhCredito(l.tipo);
    var ehDebito = resumoEhDebito(l.tipo);

    if (ehCredito) bucket.creditos += valor;
    else bucket.debitos += valor;

    if ((ehCredito && classe !== 'receita') || (ehDebito && classe === 'receita')) {
      l.ehAbatimentoResumo = true;
    }

    categoriasMap.set(cat, bucket);
  });

  var receitas = [];
  var despesas = [];

  categoriasMap.forEach(function(item) {
    var saldoLiquido = Number(item.creditos || 0) - Number(item.debitos || 0);
    if (saldoLiquido > 0) {
      receitas.push({
        cat: item.cat,
        valor: saldoLiquido
      });
      return;
    }

    if (saldoLiquido < 0) {
      despesas.push({
        cat: item.cat,
        valor: Math.abs(saldoLiquido),
        classe: item.classe === 'receita' ? 'variavel' : item.classe
      });
    }
  });

  receitas = receitas
    .filter(function(entry) { return entry.valor > 0; })
    .sort(function(a, b) { return b.valor - a.valor; });

  despesas = despesas
    .filter(function(entry) { return entry.valor > 0; })
    .sort(function(a, b) { return b.valor - a.valor; });

  return {
    movContas: movContas,
    analiticas: analiticasClassificadas,
    receitas: receitas,
    despesas: despesas,
    totalReceitas: receitas.reduce(function(s, entry) { return s + entry.valor; }, 0),
    totalDespesas: despesas.reduce(function(s, entry) { return s + entry.valor; }, 0)
  };
}

function isAbatimentoDespesaResumo(l) {
  return !!(l && l.ehAbatimentoResumo);
}

function formatPeriodoLabel(m) {
  var parts = String(m || '').split('-');
  return parts.length === 2 ? parts[1] + '/' + parts[0] : m;
}

function lerPeriodosSelecionados(id, meses, atual) {
  var sel = document.getElementById(id);
  if (sel) {
    var valores = Array.from(sel.selectedOptions).map(function(opt) { return opt.value; }).filter(Boolean);
    return valores.length ? valores : (atual && atual.length ? atual : (meses[0] ? [meses[0]] : []));
  }
  return atual && atual.length ? atual : (meses[0] ? [meses[0]] : []);
}

function buildPeriodoMultiSelect(id, meses, selecionados, onChange) {
  var selectedMap = new Set(selecionados || []);
  var label = (selecionados || []).length ? selecionados.map(formatPeriodoLabel).join(', ') : 'Selecionar periodo';
  var checks = meses.map(function(m) {
    return '<label class="period-option"><input type="checkbox" value="' + m + '"' + (selectedMap.has(m) ? ' checked' : '') + '/><span>' + formatPeriodoLabel(m) + '</span></label>';
  }).join('');

  return '<div class="period-picker" data-period-picker="' + id + '">'
    + '<button type="button" class="period-picker-btn" onclick="togglePeriodoPicker(\'' + id + '\')">' + esc(label) + '</button>'
    + '<div class="period-picker-menu">' + checks
    + '<div class="period-picker-actions"><button type="button" class="btn-sm" onclick="aplicarPeriodoPicker(\'' + id + '\',\'' + onChange.replace('()', '') + '\')">Aplicar</button></div>'
    + '</div></div>';
}

function togglePeriodoPicker(id) {
  document.querySelectorAll('.period-picker').forEach(function(el) {
    if (el.getAttribute('data-period-picker') !== id) el.classList.remove('open');
  });
  var picker = document.querySelector('[data-period-picker="' + id + '"]');
  if (picker) picker.classList.toggle('open');
}

function aplicarPeriodoPicker(id, renderFn) {
  var picker = document.querySelector('[data-period-picker="' + id + '"]');
  if (!picker) return;

  var valores = Array.from(picker.querySelectorAll('input[type="checkbox"]:checked')).map(function(input) { return input.value; });
  if (id === 'resumo-periodos-sel') _resumoPeriodos = valores;
  if (id === 'graficos-periodos-sel') _graficosPeriodos = valores;

  picker.classList.remove('open');
  if (typeof window[renderFn] === 'function') window[renderFn]();
}

function renderResumo() {
  var todas = getTransacoes(activeClient);
  var meses = Array.from(new Set(todas.map(function(l) { return (l.data || '').slice(0, 7); }).filter(Boolean))).sort().reverse();
  var periodos = lerPeriodosSelecionados('resumo-periodos-sel', meses, _resumoPeriodos);
  _resumoPeriodos = periodos;

  var periodoSet = new Set(periodos);
  var filtered = periodos.length ? todas.filter(function(l) { return periodoSet.has((l.data || '').slice(0, 7)); }) : [];
  var consolidado = consolidarTransacoesAnaliticas(filtered);
  var movContas = consolidado.movContas;
  var receitas = consolidado.receitas;
  var despesas = consolidado.despesas;
  var tR = consolidado.totalReceitas;
  var tD = consolidado.totalDespesas;
  var resultado = tR - tD;

  var movEntradas = movContas.filter(function(l) { return resumoEhCredito(l.tipo); }).reduce(function(s, l) { return s + l.valor; }, 0);
  var movSaidas = movContas.filter(function(l) { return resumoEhDebito(l.tipo); }).reduce(function(s, l) { return s + l.valor; }, 0);

  var periodoTexto = periodos.length ? periodos.map(formatPeriodoLabel).join(', ') : 'Selecione um periodo';

  var barR = receitas.map(function(entry) {
    var cat = entry.cat, val = entry.valor;
    return '<div class="cat-row"><span class="cat-name">' + esc(cat) + '</span>'
      + '<div class="cat-bar-wrap"><div class="cat-bar-fill income" style="width:' + (tR > 0 ? Math.round((val / tR) * 100) : 0) + '%"></div></div>'
      + '<span class="cat-val val-pos">' + fmt(val) + '</span></div>';
  }).join('') || '<p style="color:var(--muted);font-size:.82rem;padding:6px 0">Nenhuma receita.</p>';

  var barD = despesas.map(function(entry) {
    var cat = entry.cat, val = entry.valor;
    return '<div class="cat-row"><span class="cat-name">' + esc(cat) + '</span>'
      + '<div class="cat-bar-wrap"><div class="cat-bar-fill expense" style="width:' + (tD > 0 ? Math.round((val / tD) * 100) : 0) + '%"></div></div>'
      + '<span class="cat-val val-neg">' + fmt(val) + '</span></div>';
  }).join('') || '<p style="color:var(--muted);font-size:.82rem;padding:6px 0">Nenhuma despesa.</p>';

  var transacoesTabela = movContas.concat(consolidado.analiticas);
  var tabela = transacoesTabela.length === 0
    ? '<div class="empty-state" style="padding:26px"><div class="icon">&#128202;</div>Nenhum lançamento no período.</div>'
    : '<table class="data-table"><thead><tr><th>Data</th><th>Origem</th><th>Descricao</th><th>Categoria</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>'
      + transacoesTabela.slice().sort(function(a, b) { return (b.data || '').localeCompare(a.data || ''); }).map(function(l) {
          var ehCredito = resumoEhCredito(l.tipo);
          var tipoLabel = ehCredito ? 'Receita' : 'Despesa';
          var tipoColor = ehCredito ? 'var(--success)' : 'var(--danger)';
          var valorClass = ehCredito ? 'val-pos' : 'val-neg';
          var valorPrefixo = ehCredito ? '+' : '-';
          return '<tr class="row-' + resumoTipoNormalizado(l.tipo) + '">'
            + '<td style="color:var(--muted);font-size:.78rem">' + (l.data ? l.data.split('-').reverse().join('/') : '-') + '</td>'
            + '<td><span style="font-size:.75rem;color:var(--muted)">' + esc(l.fonte || '') + '</span></td>'
            + '<td>' + esc(l.desc) + '</td>'
            + '<td><span class="badge badge-cat">' + esc(l.cat || '-') + '</span></td>'
            + '<td><span style="font-size:.79rem;color:' + tipoColor + '">' + tipoLabel + '</span></td>'
            + '<td><span class="val ' + valorClass + '">' + valorPrefixo + ' ' + fmt(l.valor) + '</span></td>'
            + '</tr>';
        }).join('')
      + '</tbody></table>';

  var observacoes = movContas.length
    ? '<div class="form-card" style="margin-top:18px"><h3>Observacoes do periodo</h3>'
      + '<p style="color:var(--muted);font-size:.82rem;line-height:1.5">A categoria <strong style="color:var(--text)">Mov. Contas</strong> representa transferencia interna entre contas. Por isso ela nao entra como receita nem como despesa nos totais.</p>'
      + '<div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:10px;font-size:.84rem">'
      + '<span>Entradas internas: <strong style="color:var(--success)">' + fmt(movEntradas) + '</strong></span>'
      + '<span>Saidas internas: <strong style="color:var(--danger)">' + fmt(movSaidas) + '</strong></span>'
      + '<span>Movimentacoes: <strong style="color:var(--text)">' + movContas.length + '</strong></span>'
      + '</div></div>'
    : '';

  if (_resumoView === 'observacoes' && !movContas.length) _resumoView = 'geral';

  var resumoHeader =
    '<div class="resumo-workbench-hero">'
      + '<div class="resumo-workbench-head">'
        + '<div><h3>Resumo</h3><p class="cartao-helper-text">Consolide receitas, despesas, resultado e movimentos do periodo selecionado.</p></div>'
        + '<div class="resumo-period-control">'
          + '<span class="period-label">Periodo</span>'
          + buildPeriodoMultiSelect('resumo-periodos-sel', meses, periodos, 'renderResumo()')
        + '</div>'
      + '</div>'
      + '<div class="resumo-period-note">' + esc(periodoTexto) + ' - escolha um ou mais meses.</div>'
    + '</div>';
  var resumoCards =
    '<div class="summary-grid">'
      + '<div class="summary-card"><div class="s-label">Total receitas</div><div class="s-val green">' + fmt(tR) + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Total despesas</div><div class="s-val red">' + fmt(tD) + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Resultado</div><div class="s-val ' + (resultado >= 0 ? 'green' : 'red') + '">' + fmt(resultado) + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Transacoes</div><div class="s-val blue">' + filtered.length + '</div></div>'
    + '</div>';
  var tabs =
    '<div class="resumo-workbench-tabs">'
      + '<button type="button" class="resumo-workbench-tab' + (_resumoView === 'geral' ? ' active' : '') + '" onclick="setResumoView(\'geral\')"><span>Visao geral</span><strong>' + periodos.length + '</strong></button>'
      + '<button type="button" class="resumo-workbench-tab' + (_resumoView === 'categorias' ? ' active' : '') + '" onclick="setResumoView(\'categorias\')"><span>Categorias</span><strong>' + (receitas.length + despesas.length) + '</strong></button>'
      + '<button type="button" class="resumo-workbench-tab' + (_resumoView === 'lancamentos' ? ' active' : '') + '" onclick="setResumoView(\'lancamentos\')"><span>Lancamentos</span><strong>' + transacoesTabela.length + '</strong></button>'
      + (movContas.length ? '<button type="button" class="resumo-workbench-tab' + (_resumoView === 'observacoes' ? ' active' : '') + '" onclick="setResumoView(\'observacoes\')"><span>Observacoes</span><strong>' + movContas.length + '</strong></button>' : '')
    + '</div>';
  var categoriasView =
    '<div class="cat-breakdown resumo-cat-breakdown">'
      + '<div class="cat-block"><h4>Receitas por categoria</h4>' + barR + '</div>'
      + '<div class="cat-block"><h4>Despesas por categoria</h4>' + barD + '</div>'
    + '</div>';
  var geralView =
    '<div class="resumo-panel-grid">'
      + '<div class="form-card resumo-insight-card"><h3>Resultado do periodo</h3><strong class="' + (resultado >= 0 ? 'val-pos' : 'val-neg') + '">' + fmt(resultado) + '</strong><p class="cartao-helper-text">Receitas menos despesas no periodo selecionado.</p></div>'
      + '<div class="form-card resumo-insight-card"><h3>Margem</h3><strong class="' + (resultado >= 0 ? 'val-pos' : 'val-neg') + '">' + (tR > 0 ? Math.round((resultado / tR) * 1000) / 10 : 0).toLocaleString('pt-BR') + '%</strong><p class="cartao-helper-text">Quanto do faturamento virou resultado.</p></div>'
      + '<div class="form-card resumo-insight-card"><h3>Maior receita</h3><strong class="val-pos">' + (receitas[0] ? fmt(receitas[0].valor) : fmt(0)) + '</strong><p class="cartao-helper-text">' + esc(receitas[0] ? receitas[0].cat : 'Sem receitas') + '</p></div>'
      + '<div class="form-card resumo-insight-card"><h3>Maior despesa</h3><strong class="val-neg">' + (despesas[0] ? fmt(despesas[0].valor) : fmt(0)) + '</strong><p class="cartao-helper-text">' + esc(despesas[0] ? despesas[0].cat : 'Sem despesas') + '</p></div>'
    + '</div>'
    + categoriasView;
  var activeView = geralView;
  if (_resumoView === 'categorias') activeView = categoriasView;
  if (_resumoView === 'lancamentos') activeView = '<div class="form-card resumo-table-card"><div class="resumo-section-head"><div><h3>Lancamentos do periodo</h3><p class="cartao-helper-text">Movimentos considerados no resumo consolidado.</p></div></div>' + tabela + '</div>';
  if (_resumoView === 'observacoes') activeView = observacoes || '';

  document.getElementById('resumo-content').innerHTML = resumoHeader + resumoCards + tabs + '<div class="resumo-workbench-view">' + activeView + '</div>';
}
