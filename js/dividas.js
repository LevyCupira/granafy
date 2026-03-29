// ════════════════════════════════════════════════════
// DIVIDAS.JS — Aba Empréstimo e Renegociação
// ════════════════════════════════════════════════════

var DV_TIPOS = ['Empréstimo','Financiamento','Cartão de crédito','Cheque especial','Consignado','Outros'];

function calcPrice(pv, iMensal, n) {
  if (!pv || !n) return null;
  if (!iMensal || iMensal === 0) {
    var pmt0 = pv / n;
    return { pmt: pmt0, totalPago: pmt0*n, totalJuros: 0, cet: 0, tabela: Array.from({length:n},(_,k) => ({n:k+1,pmt:pmt0,juros:0,amort:pmt0,saldo:pv-(pmt0*(k+1))})) };
  }
  var i = iMensal / 100;
  var pmt = pv * (i * Math.pow(1+i,n)) / (Math.pow(1+i,n) - 1);
  var saldo = pv, tabela = [];
  for (var k = 1; k <= n; k++) {
    var juros = saldo * i, amort = pmt - juros;
    saldo = saldo - amort;
    tabela.push({ n: k, pmt, juros, amort, saldo: Math.max(0, saldo) });
  }
  return { pmt, totalPago: pmt*n, totalJuros: pmt*n - pv, cet: (Math.pow(1+i,12)-1)*100, tabela };
}

function getDvStatus(d) {
  var pago = Number(d.pago) || 0, total = Number(d.total) || 0;
  if (pago >= total && total > 0) return 'quitada';
  if (!d.dataInicio) return 'em-dia';
  var inicio = new Date(d.dataInicio + 'T00:00:00');
  var hoje   = new Date(); hoje.setHours(0,0,0,0);
  var mesesDecorridos = Math.floor((hoje - inicio) / (1000*60*60*24*30.44));
  var parcelasPagas   = Math.round(pago / (Number(d.valorParcela) || 1));
  if (parcelasPagas < mesesDecorridos && mesesDecorridos > 0) return 'atrasada';
  return 'em-dia';
}

var DV_STATUS_LABEL = { quitada: '✅ Quitada', atrasada: '⚠️ Atrasada', 'em-dia': '✔ Em dia' };
var _lastCalc = null;

function renderDividas() {
  var c    = data.clients[activeClient];
  var divs = c.dividas || [];
  var tTotal = divs.reduce((s,d) => s + Number(d.total), 0);
  var tPago  = divs.reduce((s,d) => s + Number(d.pago),  0);
  var nQuit  = divs.filter(d => getDvStatus(d) === 'quitada').length;
  var nAtr   = divs.filter(d => getDvStatus(d) === 'atrasada').length;

  var dvCards = divs.length === 0
    ? '<div class="empty-state" style="padding:26px"><div class="icon">📋</div>Nenhuma dívida cadastrada.</div>'
    : divs.map(function(d, i) {
        var status = getDvStatus(d);
        var pago   = Number(d.pago) || 0, total = Number(d.total) || 0;
        var pct    = total > 0 ? Math.min(100, Math.round((pago/total)*100)) : 0;
        var parcelasPagas = d.valorParcela && Number(d.valorParcela) > 0 ? Math.round(pago/Number(d.valorParcela)) : 0;
        var hist   = d.pagamentos || [];
        var fillClass = status === 'quitada' ? 'done' : status === 'atrasada' ? 'late' : '';
        var histHtml = hist.map((p,pi) =>
          '<div class="dv-hist-item">'
          + '<span class="dh-data">' + (p.data ? p.data.split('-').reverse().join('/') : '—') + '</span>'
          + '<span style="flex:1;font-size:.8rem;color:var(--muted)">' + esc(p.obs || 'Pagamento') + '</span>'
          + '<span class="dh-val">+ ' + fmt(p.valor) + '</span>'
          + '<button class="dh-del" onclick="deletePagamentoDivida(' + i + ',' + pi + ')" title="Remover">✕</button>'
          + '</div>'
        ).join('');
        return '<div class="dv-card ' + status + '" id="dv-card-' + i + '">'
          + '<div class="dv-header"><div class="dv-header-left">'
          + '<span class="dv-title">' + esc(d.org) + '</span>'
          + (d.tipo ? '<span class="dv-tipo-badge">' + esc(d.tipo) + '</span>' : '')
          + '<span class="dv-status-badge ' + status + '">' + DV_STATUS_LABEL[status] + '</span>'
          + '</div><button class="btn-delete" onclick="deleteDivida(' + i + ')" title="Excluir">🗑</button></div>'
          + '<div class="dv-meta">'
          + '<span>Total: <strong>' + fmt(total) + '</strong></span>'
          + '<span>Pago: <strong style="color:var(--success)">' + fmt(pago) + '</strong></span>'
          + '<span>Restante: <strong style="color:var(--warning)">' + fmt(total-pago) + '</strong></span>'
          + (d.valorParcela && Number(d.valorParcela) > 0 ? '<span>Parcela: <strong>' + fmt(d.valorParcela) + '</strong></span>' : '')
          + (d.parcelas ? '<span>Parcelas: <strong>' + parcelasPagas + '/' + d.parcelas + '</strong></span>' : '')
          + (d.taxa ? '<span>Juros: <strong>' + d.taxa + '% a.m.</strong></span>' : '')
          + (d.dataInicio ? '<span>Início: <strong>' + d.dataInicio.split('-').reverse().join('/') + '</strong></span>' : '')
          + '</div>'
          + '<div class="dv-progress-wrap">'
          + '<div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--muted)"><span>Progresso</span><span><strong>' + pct + '%</strong></span></div>'
          + '<div class="dv-progress-bar"><div class="dv-progress-fill ' + fillClass + '" style="width:' + pct + '%"></div></div>'
          + '<div class="dv-progress-labels"><span>' + fmt(pago) + ' pago</span><span>' + fmt(total) + ' total</span></div>'
          + '</div>'
          + '<div class="dv-actions">'
          + '<input type="date" id="dv-pag-data-' + i + '" style="background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:\'DM Sans\',sans-serif;font-size:.82rem;padding:6px 9px;border-radius:7px;outline:none"/>'
          + '<input type="text" class="dv-pag-input money-input" id="dv-pag-inp-' + i + '" placeholder="Valor pago"'
          + (d.valorParcela && Number(d.valorParcela) > 0 ? ' data-cents="' + Math.round(Number(d.valorParcela)*100) + '" value="' + Number(d.valorParcela).toLocaleString('pt-BR',{minimumFractionDigits:2}) + '"' : '') + '/>'
          + '<select id="dv-pag-conta-' + i + '" style="background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:\'DM Sans\',sans-serif;font-size:.82rem;padding:6px 10px;border-radius:7px;outline:none">'
          + (c.contas && c.contas.length > 0
              ? c.contas.map(ct => '<option value="cc:' + ct.id + '">🏦 ' + esc(ct.banco) + '</option>').join('')
              : '<option value="cc:">🏦 Conta Corrente</option>')
          + c.cartoes.map(cc => '<option value="cartao:' + cc.id + '">💳 ' + esc(cc.nome) + (cc.digits ? ' ••••'+esc(cc.digits) : '') + '</option>').join('')
          + '<option value="nenhuma">— Não lançar na conta —</option>'
          + '</select>'
          + '<button class="btn-pagar" onclick="registrarPagamentoDivida(' + i + ')">💰 Registrar pagamento</button>'
          + (hist.length > 0 ? '<button class="btn-hist" onclick="toggleDvHist(' + i + ')" id="btn-hist-' + i + '">📄 Histórico (' + hist.length + ')</button>' : '')
          + '</div>'
          + '<div class="dv-hist-wrap" id="dv-hist-' + i + '">'
          + '<p style="font-size:.68rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px">Histórico de pagamentos</p>'
          + (histHtml || '<p style="color:var(--muted);font-size:.8rem">Nenhum pagamento registrado.</p>')
          + '</div></div>';
      }).join('');

  document.getElementById('dividas-content').innerHTML =
    '<div class="calc-bc">'
    + '<h3>🧮 Calculadora de Empréstimo</h3>'
    + '<p class="calc-sub">Sistema Price (tabela francesa) — equivalente à Calculadora do Cidadão do Banco Central</p>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:160px"><label>Valor do empréstimo (R$)</label><input type="text" id="calc-pv" class="money-input" placeholder="0,00" inputmode="numeric" oninput="calcularBC()"/></div>'
    + '<div class="form-group" style="max-width:130px"><label>Taxa de juros (% a.m.)</label><input type="number" id="calc-taxa" placeholder="Ex: 2,5" step="0.01" min="0" oninput="calcularBC()"/></div>'
    + '<div class="form-group" style="max-width:110px"><label>Nº de parcelas</label><input type="number" id="calc-n" placeholder="Ex: 12" min="1" max="360" oninput="calcularBC()"/></div>'
    + '<div class="form-group" style="max-width:120px;justify-content:flex-end"><label>&nbsp;</label><button class="btn-add" style="margin-top:0" onclick="usarCalcNaDivida()">+ Usar nos dados</button></div>'
    + '</div>'
    + '<div id="calc-results" style="display:none">'
    + '<div class="calc-result-grid">'
    + '<div class="calc-result-item"><div class="cr-label">Valor da parcela</div><div class="cr-val blue" id="cr-pmt">—</div></div>'
    + '<div class="calc-result-item"><div class="cr-label">Total a pagar</div><div class="cr-val red" id="cr-total">—</div></div>'
    + '<div class="calc-result-item"><div class="cr-label">Total de juros</div><div class="cr-val yellow" id="cr-juros">—</div></div>'
    + '<div class="calc-result-item"><div class="cr-label">Juros sobre capital</div><div class="cr-val yellow" id="cr-pct">—</div></div>'
    + '<div class="calc-result-item"><div class="cr-label">CET anual (aprox.)</div><div class="cr-val red" id="cr-cet">—</div></div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">'
    + '<span style="font-size:.72rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.7px">Tabela de amortização</span>'
    + '<button class="btn-hist" id="btn-toggle-amort" onclick="toggleAmortTable()">Ver tabela ▼</button>'
    + '</div>'
    + '<div id="calc-amort-wrap" style="display:none"><div class="calc-amort-table" id="calc-amort-table"></div></div>'
    + '</div></div>'
    + '<div class="summary-grid">'
    + '<div class="summary-card"><div class="s-label">Total dívidas</div><div class="s-val red">' + fmt(tTotal) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Total pago</div><div class="s-val green">' + fmt(tPago) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Saldo restante</div><div class="s-val yellow">' + fmt(tTotal-tPago) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Quitadas / Atrasadas</div><div class="s-val blue">' + nQuit + ' / <span style="color:var(--danger)">' + nAtr + '</span></div></div>'
    + '</div>'
    + '<div class="form-card"><h3>+ Registrar dívida</h3>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Órgão / Credor</label><input type="text" id="dv-org" placeholder="Ex: Banco Itaú…"/></div>'
    + '<div class="form-group" style="max-width:160px"><label>Tipo</label><select id="dv-tipo">' + DV_TIPOS.map(t => '<option>' + t + '</option>').join('') + '</select></div>'
    + '<div class="form-group" style="max-width:130px"><label>Data início</label><input type="date" id="dv-inicio"/></div>'
    + '</div><div class="form-row" style="margin-top:8px">'
    + '<div class="form-group" style="max-width:150px"><label>Valor total (R$)</label><input type="text" id="dv-total" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '<div class="form-group" style="max-width:110px"><label>Nº parcelas</label><input type="number" id="dv-parcelas" placeholder="12" min="1" oninput="autoParcela()"/></div>'
    + '<div class="form-group" style="max-width:150px"><label>Valor parcela (R$)</label><input type="text" id="dv-vparcela" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '<div class="form-group" style="max-width:130px"><label>Taxa juros (% a.m.)</label><input type="number" id="dv-taxa" placeholder="Ex: 2,5" step="0.01" min="0" oninput="autoParcela()"/></div>'
    + '<div class="form-group" style="max-width:150px"><label>Já pago (R$)</label><input type="text" id="dv-pago" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '</div><button class="btn-add" onclick="addDivida()">Registrar dívida</button></div>'
    + '<p class="section-title">Dívidas cadastradas</p>'
    + '<div id="dv-lista">' + dvCards + '</div>';

  var di = document.getElementById('dv-inicio'); if (di) di.value = new Date().toISOString().slice(0,10);
  var hoje = new Date().toISOString().slice(0,10);
  divs.forEach((_, i) => { var el = document.getElementById('dv-pag-data-'+i); if (el) el.value = hoje; });
  _dvHistOpen.forEach(i => {
    var el = document.getElementById('dv-hist-'+i), btn = document.getElementById('btn-hist-'+i);
    if (el) el.classList.add('open');
    if (btn) btn.textContent = '📄 Fechar histórico';
  });
  initMoneyInputs(document.getElementById('dividas-content'));
}

function calcularBC() {
  var pv   = parseMoney(document.getElementById('calc-pv'));
  var taxa = parseFloat(document.getElementById('calc-taxa').value) || 0;
  var n    = parseInt(document.getElementById('calc-n').value)      || 0;
  if (!pv || !n) { document.getElementById('calc-results').style.display = 'none'; return; }
  var r = calcPrice(pv, taxa, n);
  document.getElementById('calc-results').style.display = 'block';
  document.getElementById('cr-pmt').textContent   = fmt(r.pmt);
  document.getElementById('cr-total').textContent = fmt(r.totalPago);
  document.getElementById('cr-juros').textContent = fmt(r.totalJuros);
  document.getElementById('cr-pct').textContent   = pv > 0 ? (r.totalJuros/pv*100).toFixed(2)+'%' : '0%';
  document.getElementById('cr-cet').textContent   = taxa > 0 ? r.cet.toFixed(2)+'% a.a.' : '—';
  var rows = r.tabela.map(row => '<tr><td>' + row.n + '</td><td>' + fmt(row.pmt) + '</td><td style="color:var(--warning)">' + fmt(row.juros) + '</td><td style="color:var(--accent)">' + fmt(row.amort) + '</td><td>' + fmt(row.saldo) + '</td></tr>').join('');
  document.getElementById('calc-amort-table').innerHTML = '<table><thead><tr><th>Parcela</th><th>Prestação</th><th>Juros</th><th>Amortização</th><th>Saldo</th></tr></thead><tbody>' + rows + '</tbody></table>';
  _lastCalc = { pv, taxa, n, pmt: r.pmt, totalPago: r.totalPago };
}

function toggleAmortTable() {
  var w = document.getElementById('calc-amort-wrap'), btn = document.getElementById('btn-toggle-amort');
  var open = w.style.display === 'none';
  w.style.display = open ? 'block' : 'none';
  if (btn) btn.textContent = open ? 'Ocultar tabela ▲' : 'Ver tabela ▼';
}

function usarCalcNaDivida() {
  if (!_lastCalc) return alert('Faça uma simulação primeiro.');
  var pvEl = document.getElementById('dv-total'), nEl = document.getElementById('dv-parcelas');
  var taxaEl = document.getElementById('dv-taxa'), vpEl = document.getElementById('dv-vparcela');
  if (pvEl)   { var c1 = Math.round(_lastCalc.totalPago*100); pvEl.dataset.cents  = String(c1); pvEl.value  = _lastCalc.totalPago.toLocaleString('pt-BR',{minimumFractionDigits:2}); }
  if (nEl)    nEl.value = _lastCalc.n;
  if (taxaEl) taxaEl.value = _lastCalc.taxa;
  if (vpEl)   { var c2 = Math.round(_lastCalc.pmt*100); vpEl.dataset.cents = String(c2); vpEl.value = _lastCalc.pmt.toLocaleString('pt-BR',{minimumFractionDigits:2}); }
}

function autoParcela() {
  var pv   = parseMoney(document.getElementById('dv-total'));
  var taxa = parseFloat(document.getElementById('dv-taxa').value)     || 0;
  var n    = parseInt(document.getElementById('dv-parcelas').value)   || 0;
  if (!pv || !n) return;
  var r = calcPrice(pv, taxa, n); if (!r) return;
  var vpEl = document.getElementById('dv-vparcela');
  if (vpEl) { var cents = Math.round(r.pmt*100); vpEl.dataset.cents = String(cents); vpEl.value = r.pmt.toLocaleString('pt-BR',{minimumFractionDigits:2}); }
}

function addDivida() {
  var org          = document.getElementById('dv-org').value.trim();
  var tipo         = document.getElementById('dv-tipo').value;
  var dataInicio   = document.getElementById('dv-inicio').value;
  var total        = parseMoney(document.getElementById('dv-total'));
  var parcelas     = parseInt(document.getElementById('dv-parcelas').value) || 0;
  var valorParcela = parseMoney(document.getElementById('dv-vparcela'));
  var taxa         = parseFloat(document.getElementById('dv-taxa').value) || 0;
  var pago         = parseMoney(document.getElementById('dv-pago'));
  if (!org || !total) return alert('Preencha pelo menos Órgão/Credor e Valor total.');
  if (!data.clients[activeClient].dividas) data.clients[activeClient].dividas = [];
  data.clients[activeClient].dividas.push({ id: uid(), org, tipo, dataInicio, total, parcelas, valorParcela, taxa, pago, pagamentos: [] });
  saveData(); renderDividas();
}

function deleteDivida(i) {
  if (!confirm('Remover esta dívida e todo o histórico de pagamentos?')) return;
  data.clients[activeClient].dividas.splice(i, 1);
  saveData(); renderDividas();
}

function registrarPagamentoDivida(i) {
  var inp     = document.getElementById('dv-pag-inp-' + i);
  var dataEl  = document.getElementById('dv-pag-data-' + i);
  var contaEl = document.getElementById('dv-pag-conta-' + i);
  var valor   = parseMoney(inp);
  var data_   = dataEl ? dataEl.value : new Date().toISOString().slice(0,10);
  var conta   = contaEl ? contaEl.value : 'cc:';
  if (!valor || valor <= 0) return alert('Informe o valor pago.');
  var c = data.clients[activeClient], d = c.dividas[i];
  if (!d.pagamentos) d.pagamentos = [];
  var lancamentoId = uid();
  d.pagamentos.push({ id: uid(), data: data_, valor, obs: 'Pagamento', conta, lancamentoId });
  d.pago = (Number(d.pago) || 0) + valor;
  if (conta.startsWith('cc:')) {
    if (!Array.isArray(c.extrato)) c.extrato = [];
    c.extrato.push({ id: lancamentoId, data: data_, desc: 'Parcela — ' + d.org + (d.tipo ? ' (' + d.tipo + ')' : ''), cat: 'Empréstimo / Financiamento', tipo: 'debito', valor });
  } else if (conta.startsWith('cartao:')) {
    var cartaoId = conta.split(':')[1];
    if (!Array.isArray(c.cartao)) c.cartao = [];
    c.cartao.push({ id: lancamentoId, cartaoId, data: data_, desc: 'Parcela — ' + d.org, cat: 'Empréstimo / Financiamento', tipo: 'lancamento', valor });
  }
  saveData(); renderDividas();
}

function deletePagamentoDivida(di, pi) {
  if (!confirm('Remover este pagamento? O lançamento correspondente também será excluído.')) return;
  var c = data.clients[activeClient], d = c.dividas[di], pg = d.pagamentos[pi];
  if (pg.lancamentoId) {
    if (pg.conta && pg.conta.startsWith('cc:'))      c.extrato = (c.extrato || []).filter(l => l.id !== pg.lancamentoId);
    if (pg.conta && pg.conta.startsWith('cartao:'))  c.cartao  = (c.cartao  || []).filter(l => l.id !== pg.lancamentoId);
  }
  d.pago = Math.max(0, (Number(d.pago) || 0) - Number(pg.valor));
  d.pagamentos.splice(pi, 1);
  saveData(); _dvHistOpen.add(di); renderDividas();
}

function toggleDvHist(i) {
  var el = document.getElementById('dv-hist-' + i); if (!el) return;
  var isOpen = el.classList.toggle('open');
  isOpen ? _dvHistOpen.add(i) : _dvHistOpen.delete(i);
  var btn = document.getElementById('btn-hist-' + i);
  if (btn) btn.textContent = isOpen ? '📄 Fechar histórico' : '📄 Histórico (' + (data.clients[activeClient].dividas[i].pagamentos || []).length + ')';
}
