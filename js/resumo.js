var _resumoPeriodos = null;

function getTransacoes(clienteId) {
  var c = data.clients[clienteId];
  if (!c) return [];

  var result = [];
  var extratoBase = (c.extrato || []).filter(function(l) { return !isCategoriaCartaoCreditoResumo(l.cat); });
  var extrato = typeof chaveDuplicidadeExtrato === 'function'
    ? filtrarExtratoResumoDuplicados(extratoBase)
    : extratoBase;

  extrato.forEach(function(l, idx) {
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
  var debitosPorCategoria = new Map();
  var analiticasClassificadas = analiticas.map(function(l) {
    return Object.assign({}, l, {
      resumoClasse: typeof tipoCat === 'function' ? tipoCat(l.cat) : 'variavel',
      ehAbatimentoResumo: false
    });
  });
  var receitasMap = new Map();
  var despesasMap = new Map();

  function normalizarDescricaoResumo(desc) {
    return String(desc || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+\d+\/\d+\s*$/, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  analiticasClassificadas.forEach(function(l) {
    if (l.tipo !== 'debito') return;
    var cat = l.cat || 'Outros';
    var bucket = debitosPorCategoria.get(cat) || [];
    bucket.push({
      desc: normalizarDescricaoResumo(l.desc),
      valor: Number(l.valor || 0)
    });
    debitosPorCategoria.set(cat, bucket);
  });

  analiticasClassificadas.forEach(function(l) {
    var cat = l.cat || 'Outros';
    var classe = l.resumoClasse;

    if (l.tipo === 'credito' && classe !== 'receita') {
      var descNorm = normalizarDescricaoResumo(l.desc);
      var valorAbs = Math.abs(Number(l.valor || 0));
      var debitos = debitosPorCategoria.get(cat) || [];
      l.ehAbatimentoResumo = debitos.some(function(item) {
        if (!item.valor) return false;
        var mesmaDescricao = descNorm && item.desc && descNorm === item.desc;
        var mesmoValor = Math.abs(Number(item.valor || 0) - valorAbs) < 0.005;
        return mesmaDescricao || mesmoValor;
      });
    }

    if (classe === 'receita' || (l.tipo === 'credito' && !l.ehAbatimentoResumo)) {
      receitasMap.set(cat, (receitasMap.get(cat) || 0) + (l.tipo === 'credito' ? Number(l.valor || 0) : -Number(l.valor || 0)));
      return;
    }

    despesasMap.set(cat, (despesasMap.get(cat) || 0) + (l.tipo === 'debito' ? Number(l.valor || 0) : -Number(l.valor || 0)));
  });

  var receitas = Array.from(receitasMap.entries())
    .map(function(entry) { return { cat: entry[0], valor: entry[1] }; })
    .filter(function(entry) { return entry.valor > 0; })
    .sort(function(a, b) { return b.valor - a.valor; });

  var despesas = Array.from(despesasMap.entries())
    .map(function(entry) { return { cat: entry[0], valor: entry[1], classe: typeof tipoCat === 'function' ? tipoCat(entry[0]) : 'variavel' }; })
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

  var movEntradas = movContas.filter(function(l) { return l.tipo === 'credito'; }).reduce(function(s, l) { return s + l.valor; }, 0);
  var movSaidas = movContas.filter(function(l) { return l.tipo === 'debito'; }).reduce(function(s, l) { return s + l.valor; }, 0);

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
    ? '<div class="empty-state" style="padding:26px"><div class="icon">&#128202;</div>Nenhum lancamento no periodo.</div>'
    : '<table class="data-table"><thead><tr><th>Data</th><th>Origem</th><th>Descricao</th><th>Categoria</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>'
      + transacoesTabela.slice().sort(function(a, b) { return (b.data || '').localeCompare(a.data || ''); }).map(function(l) {
          var abatimento = isAbatimentoDespesaResumo(l);
          var tipoLabel = abatimento ? 'Abatimento' : (l.tipo === 'credito' ? 'Receita' : 'Despesa');
          var tipoColor = abatimento ? 'var(--warning)' : (l.tipo === 'credito' ? 'var(--success)' : 'var(--danger)');
          var valorClass = abatimento ? 'val-pos' : (l.tipo === 'credito' ? 'val-pos' : 'val-neg');
          var valorPrefixo = abatimento ? '&#8722; despesa ' : (l.tipo === 'credito' ? '+' : '-');
          var descExtra = abatimento
            ? '<div style="font-size:.72rem;color:var(--warning);margin-top:2px">Credito tratado como abatimento da despesa da categoria.</div>'
            : '';
          return '<tr class="row-' + l.tipo + '">'
            + '<td style="color:var(--muted);font-size:.78rem">' + (l.data ? l.data.split('-').reverse().join('/') : '-') + '</td>'
            + '<td><span style="font-size:.75rem;color:var(--muted)">' + esc(l.fonte || '') + '</span></td>'
            + '<td>' + esc(l.desc) + descExtra + '</td>'
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

  document.getElementById('resumo-content').innerHTML =
    '<div class="period-filter-row">'
    + '<span class="period-label">Selecionar periodo:</span>'
    + buildPeriodoMultiSelect('resumo-periodos-sel', meses, periodos, 'renderResumo()')
    + '<span class="period-help">' + esc(periodoTexto) + ' &bull; escolha um ou mais meses.</span></div>'
    + '<div class="summary-grid">'
    + '<div class="summary-card"><div class="s-label">Total receitas</div><div class="s-val green">' + fmt(tR) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Total despesas</div><div class="s-val red">' + fmt(tD) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Resultado</div><div class="s-val ' + (resultado >= 0 ? 'green' : 'red') + '">' + fmt(resultado) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Transacoes</div><div class="s-val blue">' + filtered.length + '</div></div>'
    + '</div>'
    + observacoes
    + '<div class="cat-breakdown">'
    + '<div class="cat-block"><h4>&#128200; Receitas por categoria</h4>' + barR + '</div>'
    + '<div class="cat-block"><h4>&#128201; Despesas por categoria</h4>' + barD + '</div>'
    + '</div>'
    + '<p class="section-title" style="margin-top:22px">Lancamentos do periodo</p>' + tabela;
}
