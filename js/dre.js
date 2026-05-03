function renderDRE() {
  var todasBase = getTransacoes(activeClient);
  var meses = Array.from(new Set(todasBase.map(function(l) { return (l.data || '').slice(0, 7); }).filter(Boolean))).sort().reverse();

  var selEl = document.getElementById('dre-mes-sel');
  var mesAtual = selEl ? selEl.value : (meses[0] || '');

  var filtradas = mesAtual ? todasBase.filter(function(l) { return (l.data || '').startsWith(mesAtual); }) : todasBase;
  var consolidado = consolidarTransacoesAnaliticas(filtradas);
  var movContas = consolidado.movContas;
  var receitas = consolidado.receitas;
  var despesas = consolidado.despesas;

  var fixas = despesas.filter(function(entry) { return entry.classe === 'fixa'; });
  var variaveis = despesas.filter(function(entry) { return entry.classe !== 'fixa'; });

  var tReceita = consolidado.totalReceitas;
  var tFixas = fixas.reduce(function(s, entry) { return s + entry.valor; }, 0);
  var tVariavel = variaveis.reduce(function(s, entry) { return s + entry.valor; }, 0);
  var tDesp = tFixas + tVariavel;
  var resultado = tReceita - tDesp;
  var txPoupanca = tReceita > 0 ? (resultado / tReceita * 100) : 0;

  var mesOpts = meses.map(function(m) {
    var parts = m.split('-');
    return '<option value="' + m + '"' + (m === mesAtual ? ' selected' : '') + '>' + parts[1] + '/' + parts[0] + '</option>';
  }).join('');

  function dreRow(label, valor, cls, indent) {
    var pad = indent ? 'padding-left:20px' : '';
    return '<tr>'
      + '<td style="' + pad + ';font-size:.84rem;color:' + (indent ? 'var(--text)' : 'var(--muted)') + ';font-weight:' + (indent ? '400' : '600') + '">' + esc(label) + '</td>'
      + '<td style="text-align:right;font-size:.84rem" class="' + cls + '">' + (indent ? '(' + fmt(valor) + ')' : fmt(valor)) + '</td>'
      + '</tr>';
  }

  function dreTotal(label, valor, cls, border) {
    var borderStyle = border ? 'border-top:2px solid var(--border);border-bottom:2px solid var(--border)' : 'border-top:1px solid var(--border)';
    return '<tr style="' + borderStyle + '">'
      + '<td style="font-size:.86rem;font-weight:700;padding:10px 12px">' + esc(label) + '</td>'
      + '<td style="text-align:right;font-size:.86rem;font-weight:700;padding:10px 12px" class="' + cls + '">' + fmt(valor) + '</td>'
      + '</tr>';
  }

  var recRows = receitas.map(function(entry) { return dreRow(entry.cat, entry.valor, 'val-pos', true); }).join('');
  var fixRows = fixas.map(function(entry) { return dreRow(entry.cat, entry.valor, 'val-neg', true); }).join('');
  var varRows = variaveis.map(function(entry) { return dreRow(entry.cat, entry.valor, 'val-neg', true); }).join('');
  var resClass = resultado >= 0 ? 'val-pos' : 'val-neg';
  var movTotal = movContas.reduce(function(s, l) { return s + l.valor; }, 0);

  var html = ''
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap">'
    + '<span style="font-size:.7rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.8px">Periodo:</span>'
    + '<select id="dre-mes-sel" style="background:var(--card);border:1px solid var(--border);color:var(--text);font-family:\'DM Sans\',sans-serif;font-size:.83rem;padding:6px 10px;border-radius:7px;outline:none" onchange="renderDRE()">'
    + '<option value=""' + (mesAtual === '' ? ' selected' : '') + '>Todos os meses</option>' + mesOpts
    + '</select></div>'
    + '<div class="summary-grid" style="margin-bottom:24px">'
    + '<div class="summary-card"><div class="s-label">Receita total</div><div class="s-val green">' + fmt(tReceita) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Despesas fixas</div><div class="s-val red">' + fmt(tFixas) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Despesas variaveis</div><div class="s-val red">' + fmt(tVariavel) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Resultado liquido</div><div class="s-val ' + resClass + '">' + fmt(resultado) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Mov. internas</div><div class="s-val blue">' + fmt(movTotal) + '</div></div>'
    + '</div>'
    + '<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:24px">'
    + '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--surface)">'
    + '<th style="padding:10px 12px;text-align:left;font-size:.69rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--border)">Descricao</th>'
    + '<th style="padding:10px 12px;text-align:right;font-size:.69rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--border)">Valor</th>'
    + '</tr></thead><tbody>'
    + '<tr style="background:rgba(62,207,176,.06)"><td colspan="2" style="padding:8px 12px;font-size:.72rem;font-weight:700;color:var(--success);text-transform:uppercase;letter-spacing:.8px">Receitas</td></tr>'
    + (recRows || '<tr><td colspan="2" style="padding:8px 12px 8px 20px;font-size:.82rem;color:var(--muted)">Nenhuma receita no periodo.</td></tr>')
    + dreTotal('(=) Total de Receitas', tReceita, 'val-pos', false)
    + '<tr style="background:rgba(255,107,107,.05)"><td colspan="2" style="padding:8px 12px;font-size:.72rem;font-weight:700;color:var(--danger);text-transform:uppercase;letter-spacing:.8px">Despesas Fixas</td></tr>'
    + (fixRows || '<tr><td colspan="2" style="padding:8px 12px 8px 20px;font-size:.82rem;color:var(--muted)">Nenhuma despesa fixa no periodo.</td></tr>')
    + dreTotal('(-) Total de Despesas Fixas', tFixas, 'val-neg', false)
    + '<tr style="background:rgba(255,198,107,.05)"><td colspan="2" style="padding:8px 12px;font-size:.72rem;font-weight:700;color:var(--warning);text-transform:uppercase;letter-spacing:.8px">Despesas Variaveis</td></tr>'
    + (varRows || '<tr><td colspan="2" style="padding:8px 12px 8px 20px;font-size:.82rem;color:var(--muted)">Nenhuma despesa variavel no periodo.</td></tr>')
    + dreTotal('(-) Total de Despesas Variaveis', tVariavel, 'val-neg', false)
    + dreTotal('(=) Resultado Liquido', resultado, resClass, true)
    + '<tr><td style="padding:8px 12px;font-size:.82rem;color:var(--muted)">Taxa de poupanca</td><td style="text-align:right;padding:8px 12px;font-size:.84rem;font-weight:600" class="' + (txPoupanca >= 0 ? 'val-pos' : 'val-neg') + '">' + txPoupanca.toFixed(1) + '%</td></tr>'
    + '</tbody></table></div>'
    + '<div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;font-size:.8rem;color:var(--muted)">'
    + '<strong style="color:var(--text)">Observacao:</strong> a categoria Mov. Contas e tratada como transferencia interna. Ela nao entra como receita nem como despesa no DRE. Total do periodo: <strong style="color:var(--text)">' + fmt(movTotal) + '</strong>.'
    + '</div>';

  document.getElementById('dre-content').innerHTML = html;
}
