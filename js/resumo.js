// ════════════════════════════════════════════════════
// RESUMO.JS — Aba Receita & Despesas
// Inclui getTransacoes() usado por DRE e Gráficos
// ════════════════════════════════════════════════════

// Consolida Conta Corrente + Cartão (lancamento→despesa)
// Usado por: resumo, dre, graficos, pdf
function getTransacoes(clienteId) {
  var c = data.clients[clienteId];
  var result = [];
  (c.extrato || []).forEach(l => result.push({ data: l.data, desc: l.desc, cat: l.cat, valor: Number(l.valor), tipo: l.tipo, fonte: 'Conta Corrente' }));
  (c.cartao  || []).filter(l => l.tipo !== 'estorno').forEach(l => {
    var cc    = (c.cartoes || []).find(x => x.id === l.cartaoId);
    var fonte = cc ? 'Cartão ' + cc.nome : 'Cartão de Crédito';
    result.push({ data: l.data, desc: l.desc, cat: l.cat, valor: Number(l.valor), tipo: 'debito', fonte });
  });
  return result;
}

function renderResumo() {
  var todas = getTransacoes(activeClient);
  var meses = [...new Set(todas.map(l => (l.data || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  var selEl    = document.getElementById('resumo-mes-sel');
  var mesAtual = selEl ? selEl.value : (meses[0] || '');
  var filtered = mesAtual ? todas.filter(l => (l.data || '').startsWith(mesAtual)) : todas;

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
  var mesOpts = meses.map(m => { var [y, mo] = m.split('-'); return '<option value="' + m + '"' + (m === mesAtual ? ' selected' : '') + '>' + mo + '/' + y + '</option>'; }).join('');

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
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap">'
    + '<span style="font-size:.7rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.8px">Período:</span>'
    + '<select id="resumo-mes-sel" style="background:var(--card);border:1px solid var(--border);color:var(--text);font-family:\'DM Sans\',sans-serif;font-size:.83rem;padding:6px 10px;border-radius:7px;outline:none" onchange="renderResumo()">'
    + '<option value=""' + (mesAtual === '' ? ' selected' : '') + '>Todos os meses</option>' + mesOpts + '</select>'
    + '<span style="font-size:.73rem;color:var(--muted)">• Consolida Conta Corrente + Cartão</span></div>'
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
