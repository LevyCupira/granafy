// ════════════════════════════════════════════════════
// RESUMO.JS — Aba Receita & Despesas
// Inclui getTransacoes() usado por DRE e Gráficos
// ════════════════════════════════════════════════════

// Consolida Conta Corrente + Cartão (lancamento→despesa)
// Usado por: resumo, dre, graficos, pdf
var _resumoPeriodos = null;

function getTransacoes(clienteId) {
  var c = data.clients[clienteId];
  var result = [];
  var extratoBase = (c.extrato || []).filter(l => !isCategoriaCartaoCreditoResumo(l.cat));
  var extrato = typeof chaveDuplicidadeExtrato === 'function'
    ? filtrarExtratoResumoDuplicados(extratoBase)
    : extratoBase;

  extrato.forEach(l => result.push({ data: l.data, desc: l.desc, cat: l.cat, valor: Number(l.valor), tipo: l.tipo, fonte: 'Conta Corrente' }));
  (c.cartao  || []).filter(l => l.tipo !== 'estorno').forEach(l => {
    var cc    = (c.cartoes || []).find(x => x.id === l.cartaoId);
    var fonte = cc ? 'Cartão ' + cc.nome : 'Cartão de Crédito';
    result.push({ data: l.data, desc: l.desc, cat: l.cat, valor: Number(l.valor), tipo: 'debito', fonte });
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

  (lancamentos || []).forEach(l => {
    var chave = chaveDuplicidadeExtrato(l);
    var resolvido = typeof duplicadoResolvidoExtrato === 'function' && duplicadoResolvidoExtrato(chave);

    if (resolvido || !vistos.has(chave)) {
      filtrados.push(l);
      vistos.set(chave, true);
    }
  });

  return filtrados;
}

function formatPeriodoLabel(m) {
  var parts = String(m || '').split('-');
  return parts.length === 2 ? parts[1] + '/' + parts[0] : m;
}

function lerPeriodosSelecionados(id, meses, atual) {
  var sel = document.getElementById(id);
  if (sel) {
    var valores = Array.from(sel.selectedOptions).map(opt => opt.value).filter(Boolean);
    return valores.length ? valores : (atual && atual.length ? atual : (meses[0] ? [meses[0]] : []));
  }
  return atual && atual.length ? atual : (meses[0] ? [meses[0]] : []);
}

function buildPeriodoMultiSelect(id, meses, selecionados, onChange) {
  var selectedMap = new Set(selecionados || []);
  var label = (selecionados || []).length ? selecionados.map(formatPeriodoLabel).join(', ') : 'Selecionar periodo';
  var checks = meses.map(m =>
    '<label class="period-option"><input type="checkbox" value="' + m + '"' + (selectedMap.has(m) ? ' checked' : '') + '/><span>' + formatPeriodoLabel(m) + '</span></label>'
  ).join('');

  return '<div class="period-picker" data-period-picker="' + id + '">'
    + '<button type="button" class="period-picker-btn" onclick="togglePeriodoPicker(\'' + id + '\')">' + esc(label) + '</button>'
    + '<div class="period-picker-menu">' + checks
    + '<div class="period-picker-actions"><button type="button" class="btn-sm" onclick="aplicarPeriodoPicker(\'' + id + '\',\'' + onChange.replace('()', '') + '\')">Aplicar</button></div>'
    + '</div></div>';
}

function togglePeriodoPicker(id) {
  document.querySelectorAll('.period-picker').forEach(el => {
    if (el.getAttribute('data-period-picker') !== id) el.classList.remove('open');
  });
  var picker = document.querySelector('[data-period-picker="' + id + '"]');
  if (picker) picker.classList.toggle('open');
}

function aplicarPeriodoPicker(id, renderFn) {
  var picker = document.querySelector('[data-period-picker="' + id + '"]');
  if (!picker) return;

  var valores = Array.from(picker.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
  if (id === 'resumo-periodos-sel') _resumoPeriodos = valores;
  if (id === 'graficos-periodos-sel') _graficosPeriodos = valores;

  picker.classList.remove('open');
  if (typeof window[renderFn] === 'function') window[renderFn]();
}

function renderResumo() {
  var todas = getTransacoes(activeClient);
  var meses = [...new Set(todas.map(l => (l.data || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  var periodos = lerPeriodosSelecionados('resumo-periodos-sel', meses, _resumoPeriodos);
  _resumoPeriodos = periodos;
  var periodoSet = new Set(periodos);
  var filtered = periodos.length ? todas.filter(l => periodoSet.has((l.data || '').slice(0, 7))) : [];

  var receitas = filtered.filter(l => l.tipo === 'credito');
  var despesas = filtered.filter(l => l.tipo === 'debito');
  var tR = receitas.reduce((s, l) => s + l.valor, 0);
  var tD = despesas.reduce((s, l) => s + l.valor, 0);
  var resultado = tR - tD;

  function groupBy(arr) {
    var m = {};
    arr.forEach(l => { m[l.cat || 'Outros'] = (m[l.cat || 'Outros'] || 0) + l.valor; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }

  var grR = groupBy(receitas), grD = groupBy(despesas);
  var periodoTexto = periodos.length ? periodos.map(formatPeriodoLabel).join(', ') : 'Selecione um periodo';

  var barR = grR.map(([cat, val]) =>
    '<div class="cat-row"><span class="cat-name">' + esc(cat) + '</span>'
    + '<div class="cat-bar-wrap"><div class="cat-bar-fill income" style="width:' + (tR > 0 ? Math.round((val / tR) * 100) : 0) + '%"></div></div>'
    + '<span class="cat-val val-pos">' + fmt(val) + '</span></div>'
  ).join('') || '<p style="color:var(--muted);font-size:.82rem;padding:6px 0">Nenhuma receita.</p>';

  var barD = grD.map(([cat, val]) =>
    '<div class="cat-row"><span class="cat-name">' + esc(cat) + '</span>'
    + '<div class="cat-bar-wrap"><div class="cat-bar-fill expense" style="width:' + (tD > 0 ? Math.round((val / tD) * 100) : 0) + '%"></div></div>'
    + '<span class="cat-val val-neg">' + fmt(val) + '</span></div>'
  ).join('') || '<p style="color:var(--muted);font-size:.82rem;padding:6px 0">Nenhuma despesa.</p>';

  var tabela = filtered.length === 0
    ? '<div class="empty-state" style="padding:26px"><div class="icon">📊</div>Nenhum lançamento no período.</div>'
    : '<table class="data-table"><thead><tr><th>Data</th><th>Origem</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>'
      + [...filtered].sort((a, b) => (b.data || '').localeCompare(a.data || '')).map(l =>
          '<tr class="row-' + l.tipo + '">'
          + '<td style="color:var(--muted);font-size:.78rem">' + (l.data ? l.data.split('-').reverse().join('/') : '—') + '</td>'
          + '<td><span style="font-size:.75rem;color:var(--muted)">' + esc(l.fonte || '') + '</span></td>'
          + '<td>' + esc(l.desc) + '</td>'
          + '<td><span class="badge badge-cat">' + esc(l.cat || '—') + '</span></td>'
          + '<td><span style="font-size:.79rem;color:' + (l.tipo === 'credito' ? 'var(--success)' : 'var(--danger)') + '">' + (l.tipo === 'credito' ? 'Receita' : 'Despesa') + '</span></td>'
          + '<td><span class="val ' + (l.tipo === 'credito' ? 'val-pos' : 'val-neg') + '">' + (l.tipo === 'credito' ? '+' : '-') + ' ' + fmt(l.valor) + '</span></td>'
          + '</tr>'
        ).join('')
      + '</tbody></table>';

  document.getElementById('resumo-content').innerHTML =
    '<div class="period-filter-row">'
    + '<span class="period-label">Selecionar periodo:</span>'
    + buildPeriodoMultiSelect('resumo-periodos-sel', meses, periodos, 'renderResumo()')
    + '<span class="period-help">' + esc(periodoTexto) + ' &bull; escolha um ou mais meses.</span></div>'
    + '<div class="summary-grid">'
    + '<div class="summary-card"><div class="s-label">Total receitas</div><div class="s-val green">' + fmt(tR) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Total despesas</div><div class="s-val red">' + fmt(tD) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Resultado</div><div class="s-val ' + (resultado >= 0 ? 'green' : 'red') + '">' + fmt(resultado) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Transações</div><div class="s-val blue">' + filtered.length + '</div></div>'
    + '</div>'
    + '<div class="cat-breakdown">'
    + '<div class="cat-block"><h4>📈 Receitas por categoria</h4>' + barR + '</div>'
    + '<div class="cat-block"><h4>📉 Despesas por categoria</h4>' + barD + '</div>'
    + '</div>'
    + '<p class="section-title" style="margin-top:22px">Lançamentos do período</p>' + tabela;
}
