// ════════════════════════════════════════════════════
// EXTRATO.JS — Aba Conta Corrente
// ════════════════════════════════════════════════════

var _exTipo = 'credito';

var COLS_EXTRATO = [
  { key:'data',    label:'Data',      render: l => '<span style="color:var(--muted);font-size:.78rem">' + (l.data ? l.data.split('-').reverse().join('/') : '—') + '</span>' },
  { key:'desc',    label:'Descrição', render: l => esc(l.desc) },
  { key:'cat',     label:'Categoria', render: l => '<span class="badge badge-cat">' + esc(l.cat || '—') + '</span>' },
  { key:'credito', label:'Crédito',   render: l => l.tipo === 'credito' ? '<span class="val val-pos">+ ' + fmt(l.valor) + '</span>' : '<span style="color:var(--border)">—</span>' },
  { key:'debito',  label:'Débito',    render: l => l.tipo === 'debito'  ? '<span class="val val-neg">- ' + fmt(l.valor) + '</span>' : '<span style="color:var(--border)">—</span>' },
  { key:'saldo',   label:'Saldo',     render: l => { var sd = l._saldo; return '<span class="val ' + (sd >= 0 ? 'val-pos' : 'val-neg') + '">' + fmt(sd) + '</span>'; } },
  { key:'_del',    label:'',          render: l => '<button class="btn-delete" onclick="deleteExtrato(' + l._i + ')">🗑</button>' },
];

function setTipoExtrato(t) {
  _exTipo = t;
  var tc = document.getElementById('ex-tc'), td = document.getElementById('ex-td');
  if (tc) tc.classList.toggle('active', t === 'credito');
  if (td) td.classList.toggle('active', t === 'debito');
}

function renderExtrato() {
  var c = data.clients[activeClient];
  if (!Array.isArray(c.contas)) c.contas = [];
  var lncs = c.extrato;
  var cats = nomesCC();
  var tCr  = lncs.filter(l => l.tipo === 'credito').reduce((s, l) => s + Number(l.valor), 0);
  var tDb  = lncs.filter(l => l.tipo === 'debito').reduce((s, l)  => s + Number(l.valor), 0);
  var saldo = tCr - tDb;
  var cols  = getColOrder('extrato', COLS_EXTRATO);
  var catOpts   = cats.map(c => '<option>' + esc(c) + '</option>').join('');
  var contaOpts = c.contas.length === 0
    ? '<option value="">— sem conta vinculada —</option>'
    : c.contas.map(ct => '<option value="' + ct.id + '">' + esc(ct.banco) + (ct.agencia ? ' | Ag: ' + esc(ct.agencia) : '') + (ct.numero ? ' | CC: ' + esc(ct.numero) : '') + '</option>').join('');

  var contasHtml = c.contas.length === 0
    ? '<p style="color:var(--muted);font-size:.82rem;margin-bottom:12px">Nenhuma conta cadastrada.</p>'
    : '<div class="cards-grid">' + c.contas.map(ct =>
        '<div class="conta-chip">'
        + '<div class="co-banco">🏦 ' + esc(ct.banco) + '</div>'
        + '<div class="co-info">' + (ct.agencia ? 'Ag: <strong>' + esc(ct.agencia) + '</strong>&nbsp;&nbsp;' : '') + (ct.numero ? 'CC: <strong>' + esc(ct.numero) + '</strong>' : '') + '</div>'
        + '<div class="co-footer"><span style="font-size:.68rem;color:var(--accent3)">' + esc(ct.tipo || 'Conta Corrente') + '</span>'
        + '<button class="btn-sm red" onclick="deleteContaCC(\'' + ct.id + '\')">Remover</button></div>'
        + '</div>'
      ).join('') + '</div>';

  // Alertas de fatura
  function buildBillCard(cc) {
    var fatura = (c.cartao || []).reduce(function(s, it) {
      if (it.cartaoId !== cc.id) return s;
      return it.tipo === 'estorno' ? s - Number(it.valor) : s + Number(it.valor);
    }, 0);
    var today = new Date(); today.setHours(0,0,0,0);
    var y = today.getFullYear(), m = today.getMonth();
    var due = new Date(y, m, cc.venc);
    if (due < today) due = new Date(y, m+1, cc.venc);
    var diffDays = Math.round((due - today) / (1000*60*60*24));
    var dueFmt   = due.toLocaleDateString('pt-BR');
    var urgClass = diffDays <= 3 ? 'urgent' : diffDays <= 7 ? 'soon' : '';
    var dueText  = diffDays < 0  ? '<span class="urgent-label">VENCIDA</span>'
                 : diffDays === 0 ? '<span class="urgent-label">Vence HOJE (' + dueFmt + ')</span>'
                 : diffDays <= 3  ? '<span class="urgent-label">Vence em ' + diffDays + ' dias (' + dueFmt + ')</span>'
                 : diffDays <= 7  ? '<span class="soon-label">Vence em ' + diffDays + ' dias (' + dueFmt + ')</span>'
                 : 'Vence em ' + diffDays + ' dias (' + dueFmt + ')';
    var digStr = cc.digits ? ' <span style="color:var(--muted);font-size:.72rem">•••• ' + esc(cc.digits) + '</span>' : '';
    return '<div class="bill-card ' + urgClass + '">'
      + '<div class="bill-info"><div class="b-card-name">💳 ' + esc(cc.nome) + digStr + '</div><div class="b-due">' + dueText + '</div></div>'
      + '<div class="bill-total"><div class="b-label">Total fatura</div><div class="b-val">' + fmt(fatura) + '</div></div>'
      + '<div class="bill-pay-area">'
      + '<input type="text" class="money-input" id="bill-pay-' + cc.id + '" placeholder="Valor a pagar"/>'
      + '<button class="bill-pay-btn" onclick="registrarPagamentoCartao(\'' + cc.id + '\')">Registrar pagamento</button>'
      + '</div></div>';
  }

  var cartoesVenc = (c.cartoes || []).filter(cc => cc.venc > 0);
  var billsHtml   = cartoesVenc.length > 0
    ? '<p class="section-title" style="margin-bottom:10px">💳 Faturas para pagamento</p><div class="bill-alerts">' + cartoesVenc.map(buildBillCard).join('') + '</div>'
    : '';

  var html = billsHtml
    + '<div class="form-card"><h3>🏦 Contas cadastradas</h3>' + contasHtml
    + '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:2px">'
    + '<p style="font-size:.7rem;color:var(--muted);margin-bottom:9px;font-weight:600;text-transform:uppercase;letter-spacing:.8px">Cadastrar nova conta</p>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Banco / Instituição</label><input type="text" id="co-banco" placeholder="Ex: Nubank, Itaú…"/></div>'
    + '<div class="form-group" style="max-width:160px"><label>Tipo</label><select id="co-tipo"><option>Conta Corrente</option><option>Conta Poupança</option><option>Conta Salário</option><option>Conta Digital</option><option>Outro</option></select></div>'
    + '<div class="form-group" style="max-width:120px"><label>Agência</label><input type="text" id="co-agencia" placeholder="Ex: 0001"/></div>'
    + '<div class="form-group" style="max-width:160px"><label>Nº da conta</label><input type="text" id="co-numero" placeholder="Ex: 12345-6"/></div>'
    + '</div><button class="btn-add" onclick="addContaCC()">Cadastrar conta</button></div></div>'
    + '<div class="summary-grid">'
    + '<div class="summary-card"><div class="s-label">Saldo atual</div><div class="s-val ' + (saldo >= 0 ? 'green' : 'red') + '">' + fmt(saldo) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Total créditos</div><div class="s-val green">' + fmt(tCr) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Total débitos</div><div class="s-val red">' + fmt(tDb) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Lançamentos</div><div class="s-val blue">' + lncs.length + '</div></div>'
    + '</div>'
    + '<div class="form-card"><h3>+ Novo lançamento</h3>'
    + '<div class="tipo-toggle" id="exTipoToggle">'
    + '<button class="tipo-btn credito active" id="ex-tc" onclick="setTipoExtrato(\'credito\')">↑ Crédito</button>'
    + '<button class="tipo-btn debito" id="ex-td" onclick="setTipoExtrato(\'debito\')">↓ Débito</button>'
    + '</div>'
    + '<div class="form-row" style="margin-top:12px">'
    + '<div class="form-group" style="max-width:132px"><label>Data</label><input type="date" id="ex-data"/></div>'
    + (c.contas.length > 0 ? '<div class="form-group" style="max-width:220px"><label>Conta</label><select id="ex-conta">' + contaOpts + '</select></div>' : '')
    + '<div class="form-group"><label>Descrição</label><input type="text" id="ex-desc" placeholder="Ex: Salário…"/></div>'
    + '<div class="form-group" style="max-width:200px"><label>Categoria <span style="color:var(--accent);cursor:pointer;font-size:.68rem" onclick="openModal(\'settings\',\'cats_cc\')">(+ gerir)</span></label><select id="ex-cat">' + catOpts + '</select></div>'
    + '<div class="form-group" style="max-width:138px"><label>Valor (R$)</label><input type="text" id="ex-valor" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '</div><button class="btn-add" onclick="addExtrato()">Adicionar lançamento</button></div>'
    + '<p class="section-title">Extrato da conta corrente</p>';

  if (lncs.length === 0) {
    html += '<div class="empty-state" style="padding:26px"><div class="icon">🏦</div>Nenhum lançamento.</div>';
  } else {
    var sorted = lncs.map((l, i) => Object.assign({}, l, { _i: i })).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    var acc = 0, sm = {};
    sorted.slice().reverse().forEach(l => { acc += l.tipo === 'credito' ? Number(l.valor) : -Number(l.valor); sm[l._i] = acc; });
    html += buildTable('extrato', cols, sorted.map(l => Object.assign({}, l, { _saldo: sm[l._i] })),
      (item) => cols.map(col => '<td>' + col.render(item) + '</td>').join(''),
      item => 'row-' + item.tipo);
  }

  document.getElementById('extrato-content').innerHTML = html;
  var di = document.getElementById('ex-data'); if (di) di.value = new Date().toISOString().slice(0, 10);
  setTipoExtrato(_exTipo);
  initMoneyInputs(document.getElementById('extrato-content'));
  (c.cartoes || []).filter(cc => cc.venc > 0).forEach(cc => {
    var inp = document.getElementById('bill-pay-' + cc.id); if (!inp) return;
    var fatura = (c.cartao || []).filter(it => it.cartaoId === cc.id && it.tipo !== 'estorno').reduce((s, it) => s + Number(it.valor), 0)
      - (c.cartao || []).filter(it => it.cartaoId === cc.id && it.tipo === 'estorno').reduce((s, it) => s + Number(it.valor), 0);
    var cents = Math.round(fatura * 100);
    inp.dataset.cents = String(cents);
    inp.value = fatura.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });
  initDrag('extrato', COLS_EXTRATO, renderExtrato);
}

function addContaCC() {
  var banco = document.getElementById('co-banco').value.trim();
  if (!banco) return alert('Informe o nome do banco/instituição.');
  var tipo    = document.getElementById('co-tipo').value;
  var agencia = document.getElementById('co-agencia').value.trim();
  var numero  = document.getElementById('co-numero').value.trim();
  var c = data.clients[activeClient];
  if (!Array.isArray(c.contas)) c.contas = [];
  c.contas.push({ id: uid(), banco, tipo, agencia, numero });
  saveData(); renderExtrato();
}

function deleteContaCC(id) {
  if (!confirm('Remover esta conta?')) return;
  var c = data.clients[activeClient];
  c.contas = (c.contas || []).filter(ct => ct.id !== id);
  saveData(); renderExtrato();
}

function addExtrato() {
  var d_     = document.getElementById('ex-data').value;
  var desc   = document.getElementById('ex-desc').value.trim();
  var cat    = document.getElementById('ex-cat').value;
  var valor  = parseMoney(document.getElementById('ex-valor'));
  var contaId = (document.getElementById('ex-conta') && document.getElementById('ex-conta').value) || '';
  if (!desc || !valor) return alert('Preencha descrição e valor.');
  data.clients[activeClient].extrato.push({ id: uid(), data: d_, desc, cat, tipo: _exTipo, valor, contaId });
  saveData(); renderExtrato();
}

function deleteExtrato(i) {
  if (!confirm('Remover lançamento?')) return;
  data.clients[activeClient].extrato.splice(i, 1);
  saveData(); renderExtrato();
}

function registrarPagamentoCartao(cartaoId) {
  var input = document.getElementById('bill-pay-' + cartaoId);
  var valor = parseMoney(input);
  if (!valor || valor <= 0) return alert('Informe o valor a pagar.');
  var cc  = (data.clients[activeClient].cartoes || []).find(c => c.id === cartaoId);
  var nome = cc ? cc.nome : 'Cartão';
  var hoje = new Date().toISOString().slice(0, 10);
  data.clients[activeClient].extrato.push({
    id: uid(), data: hoje,
    desc: 'Pagamento fatura — ' + nome + (cc && cc.digits ? ' (••••' + cc.digits + ')' : ''),
    cat: 'Cartão de Crédito', tipo: 'debito', valor
  });
  saveData(); renderExtrato();
}
