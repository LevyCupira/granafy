// ════════════════════════════════════════════════════
// CARTAO.JS — Aba Cartão de Crédito
// ════════════════════════════════════════════════════

var COLS_CARTAO = [
  { key:'data',   label:'Data',      render: it => '<span style="color:var(--muted);font-size:.78rem">' + (it.data ? it.data.split('-').reverse().join('/') : '—') + '</span>' },
  { key:'cartao', label:'Cartão',    render: it => { var cc = getCartaoById(it.cartaoId); return cc ? '<span class="badge badge-card">' + esc(cc.nome) + '</span>' : '<span style="color:var(--muted);font-size:.76rem">—</span>'; } },
  { key:'tipo',   label:'Tipo',      render: it => it.tipo === 'estorno' ? '<span class="badge badge-estorno">↩ Estorno</span>' : '<span style="font-size:.75rem;color:var(--muted)">Lançamento</span>' },
  { key:'desc',   label:'Descrição', render: it => esc(it.desc) },
  { key:'cat',    label:'Categoria', render: it => '<span class="badge badge-cat">' + esc(it.cat || '—') + '</span>' },
  { key:'valor',  label:'Valor',     render: it => it.tipo === 'estorno' ? '<span class="val val-pos">+ ' + fmt(it.valor) + '</span>' : '<span class="val val-neg">- ' + fmt(it.valor) + '</span>' },
  { key:'_del',   label:'',          render: (it, i) => '<button class="btn-delete" onclick="deleteCartaoItem(' + i + ')">🗑</button>' },
];

function getCartaoById(id) {
  return (data.clients[activeClient] && data.clients[activeClient].cartoes || []).find(c => c.id === id);
}

var _ccTipo = 'lancamento';

function setTipoCartao(tipo) {
  _ccTipo = tipo;
  var lanc = document.getElementById('tc-lanc');
  var est  = document.getElementById('tc-estorno');
  if (lanc) lanc.classList.toggle('active', tipo === 'lancamento');
  if (est)  est.classList.toggle('active',  tipo === 'estorno');
}

function toggleFiltroCartao(id) {
  if (id === '__todos') { _ccFiltro.clear(); }
  else { if (_ccFiltro.has(id)) _ccFiltro.delete(id); else _ccFiltro.add(id); }
  _renderCartaoFiltroETabela();
}

function renderCartao() {
  var c = data.clients[activeClient];
  _ccFiltro.forEach(id => { if (!c.cartoes.find(cc => cc.id === id)) _ccFiltro.delete(id); });

  var cols = getColOrder('cartao', COLS_CARTAO);
  var cats = loadCatsCartao();
  var cardsHtml = c.cartoes.length === 0
    ? '<p style="color:var(--muted);font-size:.82rem;margin-bottom:12px">Nenhum cartão cadastrado.</p>'
    : '<div class="cards-grid">' + c.cartoes.map(cc =>
        '<div class="card-chip">'
        + '<div class="cc-name">💳 ' + esc(cc.nome) + (cc.digits ? ' <span style="color:var(--muted);font-size:.72rem">•••• ' + esc(cc.digits) + '</span>' : '') + '</div>'
        + '<div class="cc-limit">Limite: ' + fmt(cc.limite || 0) + (cc.venc ? ' · Vence dia <strong>' + cc.venc + '</strong>' : '') + '</div>'
        + '<div class="cc-footer"><span class="cc-brand">' + esc(cc.bandeira || '') + '</span>'
        + '<button class="btn-sm red" onclick="deleteCartaoCard(\'' + cc.id + '\')">Remover</button></div>'
        + '</div>'
      ).join('') + '</div>';

  var cartaoOpts = c.cartoes.map(cc => '<option value="' + cc.id + '">' + esc(cc.nome) + '</option>').join('');
  var catOpts    = cats.map(cat => '<option>' + esc(cat) + '</option>').join('');

  var html = '<div id="cc-summary-area"></div>'
    + '<div class="form-card"><h3>💳 Cartões cadastrados</h3>' + cardsHtml
    + '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:2px">'
    + '<p style="font-size:.7rem;color:var(--muted);margin-bottom:9px;font-weight:600;text-transform:uppercase;letter-spacing:.8px">Cadastrar novo cartão</p>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Nome</label><input type="text" id="cc-nome" placeholder="Ex: Nubank, Inter…"/></div>'
    + '<div class="form-group" style="max-width:95px"><label>Últimos 4 dígitos</label><input type="text" id="cc-digits" placeholder="1234" maxlength="4" inputmode="numeric"/></div>'
    + '<div class="form-group" style="max-width:140px"><label>Bandeira</label><select id="cc-bandeira"><option>Visa</option><option>Mastercard</option><option>Elo</option><option>Amex</option><option>Hipercard</option><option>Outro</option></select></div>'
    + '<div class="form-group" style="max-width:140px"><label>Limite (R$)</label><input type="text" id="cc-limite" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '<div class="form-group" style="max-width:110px"><label>Dia vencimento</label><input type="number" id="cc-venc" placeholder="Ex: 10" min="1" max="31"/></div>'
    + '</div><button class="btn-add" onclick="addCartaoCard()">Cadastrar cartão</button>'
    + '</div></div>'
    + '<div class="form-card"><h3>📄 Importar fatura via planilha</h3>'
    + '<p style="font-size:.81rem;color:var(--muted);margin-bottom:12px">Baixe o modelo, preencha e importe.</p>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
    + '<button class="btn-sm" onclick="exportCsvTemplate()">⬇ Baixar modelo (.xlsx)</button>'
    + '<button class="btn-sm" onclick="document.getElementById(\'importXlsxInput\').click()">⬆ Importar planilha</button>'
    + '</div></div>'
    + '<div class="form-card"><h3>+ Novo lançamento / estorno</h3>'
    + '<div class="tipo-toggle" style="margin-bottom:12px">'
    + '<button class="tipo-btn debito active" id="tc-lanc" onclick="setTipoCartao(\'lancamento\')">− Lançamento</button>'
    + '<button class="tipo-btn credito" id="tc-estorno" onclick="setTipoCartao(\'estorno\')">↩ Estorno</button>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:132px"><label>Data</label><input type="date" id="cc-data"/></div>'
    + '<div class="form-group" style="max-width:172px"><label>Cartão</label><select id="cc-cartao-sel">' + (c.cartoes.length === 0 ? '<option value="">— sem cartão —</option>' : cartaoOpts) + '</select></div>'
    + '<div class="form-group"><label>Descrição</label><input type="text" id="cc-desc" placeholder="Ex: Supermercado…"/></div>'
    + '<div class="form-group" style="max-width:165px"><label>Categoria <span style="color:var(--accent);cursor:pointer;font-size:.68rem" onclick="openModal(\'settings\',\'cats_cartao\')">(+ gerir)</span></label><select id="cc-cat">' + catOpts + '</select></div>'
    + '<div class="form-group" style="max-width:138px"><label>Valor (R$)</label><input type="text" id="cc-valor" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '</div><button class="btn-add" onclick="addCartaoItem()">Adicionar</button></div>'
    + '<div id="cc-filter-table-area"></div>';

  document.getElementById('cartao-content').innerHTML = html;
  var di = document.getElementById('cc-data'); if (di) di.value = new Date().toISOString().slice(0, 10);
  setTipoCartao(_ccTipo);
  initMoneyInputs(document.getElementById('cartao-content'));
  _renderCartaoFiltroETabela();
}

function _renderCartaoFiltroETabela() {
  var c = data.clients[activeClient]; if (!c) return;
  var cols  = getColOrder('cartao', COLS_CARTAO);
  var itens = _ccFiltro.size === 0 ? c.cartao : c.cartao.filter(it => _ccFiltro.has(it.cartaoId));

  var lancs = itens.filter(i => i.tipo !== 'estorno');
  var ests  = itens.filter(i => i.tipo === 'estorno');
  var tL = lancs.reduce((s, i) => s + Number(i.valor), 0);
  var tE = ests.reduce((s,  i) => s + Number(i.valor), 0);

  var sumEl = document.getElementById('cc-summary-area');
  if (sumEl) sumEl.innerHTML = '<div class="summary-grid">'
    + '<div class="summary-card"><div class="s-label">Total fatura' + (_ccFiltro.size ? ' <span style="color:var(--accent);font-size:.6rem">(filtrado)</span>' : '') + '</div><div class="s-val red">' + fmt(tL - tE) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Lançamentos</div><div class="s-val blue">' + fmt(tL) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Estornos</div><div class="s-val green">' + fmt(tE) + '</div></div>'
    + '<div class="summary-card"><div class="s-label">Qtd. itens</div><div class="s-val blue">' + itens.length + '</div></div>'
    + '</div>';

  var todoAtivo = _ccFiltro.size === 0;
  var filterHtml = '<div class="cc-filter-row"><span class="cc-filter-label">🔍 Filtrar por cartão:</span>'
    + '<span class="cc-chip todos' + (todoAtivo ? ' active' : '') + '" onclick="toggleFiltroCartao(\'__todos\')">Todos</span>';
  c.cartoes.forEach(cc => {
    var ativo = _ccFiltro.has(cc.id);
    filterHtml += '<span class="cc-chip' + (ativo ? ' active' : '') + '" onclick="toggleFiltroCartao(\'' + cc.id + '\')">💳 ' + esc(cc.nome) + (cc.digits ? ' ••' + esc(cc.digits) : '') + '</span>';
  });
  if (_ccFiltro.size > 0) filterHtml += '<span style="font-size:.72rem;color:var(--muted);margin-left:4px">' + _ccFiltro.size + ' selecionado(s)</span>';
  filterHtml += '</div>';

  var area = document.getElementById('cc-filter-table-area'); if (!area) return;
  area.innerHTML = filterHtml + '<p class="section-title">Histórico de lançamentos</p>'
    + buildTable('cartao', cols, itens, function(item) {
        var realIdx = c.cartao.indexOf(item);
        return cols.map(col => col.key === '_del'
          ? '<td><button class="btn-delete" onclick="deleteCartaoItem(' + realIdx + ')">🗑</button></td>'
          : '<td>' + col.render(item, realIdx) + '</td>'
        ).join('');
      }, r => r.tipo === 'estorno' ? 'row-estorno' : '');
  initDrag('cartao', COLS_CARTAO, () => _renderCartaoFiltroETabela());
}

function addCartaoCard() {
  var nome     = document.getElementById('cc-nome').value.trim();
  var digits   = document.getElementById('cc-digits').value.replace(/\D/g, '').slice(0, 4);
  var bandeira = document.getElementById('cc-bandeira').value;
  var limite   = parseMoney(document.getElementById('cc-limite'));
  var venc     = parseInt(document.getElementById('cc-venc').value) || 0;
  if (!nome) return alert('Informe o nome do cartão.');
  data.clients[activeClient].cartoes.push({ id: uid(), nome, digits, bandeira, limite, venc });
  saveData(); renderCartao();
}

function deleteCartaoCard(id) {
  if (!confirm('Remover cartão?')) return;
  var c = data.clients[activeClient];
  c.cartoes = c.cartoes.filter(cc => cc.id !== id);
  c.cartao  = c.cartao.map(it => it.cartaoId === id ? Object.assign({}, it, { cartaoId: '' }) : it);
  saveData(); renderCartao();
}

function addCartaoItem() {
  var d_      = document.getElementById('cc-data').value;
  var cartaoId = (document.getElementById('cc-cartao-sel') && document.getElementById('cc-cartao-sel').value) || '';
  var desc    = document.getElementById('cc-desc').value.trim();
  var cat     = document.getElementById('cc-cat').value;
  var valor   = parseMoney(document.getElementById('cc-valor'));
  if (!desc || !valor) return alert('Preencha descrição e valor.');
  data.clients[activeClient].cartao.push({ id: uid(), cartaoId, desc, cat, valor, data: d_, tipo: _ccTipo });
  saveData(); renderCartao();
}

function deleteCartaoItem(i) {
  if (!confirm('Remover item?')) return;
  data.clients[activeClient].cartao.splice(i, 1);
  saveData(); renderCartao();
}

function exportCsvTemplate() {
  var rows = [
    ['data','descricao','valor','categoria','tipo'],
    ['15/06/2025','Supermercado Extra',250.00,'Alimentação','lancamento'],
    ['16/06/2025','Netflix',55.90,'Streaming','lancamento'],
    ['17/06/2025','Estorno Supermercado',50.00,'Alimentação','estorno'],
  ];
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:12},{wch:32},{wch:10},{wch:20},{wch:12}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fatura');
  XLSX.writeFile(wb, 'modelo_fatura_granafy.xlsx');
}

function importXlsx(event) {
  var file = event.target.files[0]; if (!file) return;
  if (!activeClient) return alert('Selecione um cliente primeiro.');
  var reader = new FileReader();
  reader.onload = function(e) {
    var wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
    var ws   = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    var header = (rows[0] || []).map(h => String(h).toLowerCase().trim());
    var iDate = header.findIndex(h => h.includes('data') || h.includes('date'));
    var iDesc = header.findIndex(h => h.includes('desc'));
    var iVal  = header.findIndex(h => h.includes('valor') || h.includes('value') || h.includes('amount'));
    var iCat  = header.findIndex(h => h.includes('cat'));
    var iTipo = header.findIndex(h => h.includes('tipo') || h.includes('type'));
    if (iDate < 0 || iDesc < 0 || iVal < 0) return alert('Planilha inválida. Colunas obrigatórias: data, descricao, valor.');
    var count = 0;
    rows.slice(1).forEach(function(row) {
      var rawDate = String(row[iDate] || '').trim();
      var desc    = String(row[iDesc] || '').trim();
      var valor   = 0;
      var rawVal  = row[iVal];
      if (typeof rawVal === 'number') valor = rawVal;
      else valor = parseFloat(String(rawVal).replace(/[^0-9,.-]/g,'').replace(',','.')) || 0;
      if (!desc || valor <= 0) return;
      var cat     = iCat  >= 0 ? String(row[iCat]  || 'Outros').trim() : 'Outros';
      var tipoRaw = iTipo >= 0 ? String(row[iTipo] || '').toLowerCase().trim() : '';
      var tipo    = tipoRaw === 'estorno' ? 'estorno' : 'lancamento';
      var dataFmt = '';
      if (typeof rawDate === 'string') {
        var dm = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dm) dataFmt = dm[3] + '-' + dm[2].padStart(2,'0') + '-' + dm[1].padStart(2,'0');
      } else if (typeof rawDate === 'number') {
        var d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        dataFmt = d.toISOString().slice(0, 10);
      }
      data.clients[activeClient].cartao.push({ id: uid(), cartaoId: '', desc, cat, valor, data: dataFmt, tipo });
      count++;
    });
    saveData(); renderCartao(); alert(count + ' lançamento(s) importado(s) com sucesso!');
  };
  reader.readAsArrayBuffer(file); event.target.value = '';
}
