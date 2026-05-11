// Cartao: logica da aba, filtros, importacao e pagamentos.

var COLS_CARTAO = [
  { key:'data',   label:'Data',      render: it => '<span style="color:var(--muted);font-size:.78rem">' + (it.data ? it.data.split('-').reverse().join('/') : '-') + '</span>' },
  { key:'cartao', label:'Cartao',    render: it => { var cc = getCartaoById(it.cartaoId); return cc ? '<span class="badge badge-card">' + esc(cc.nome) + '</span>' : '<span style="color:var(--muted);font-size:.76rem">-</span>'; } },
  { key:'tipo',   label:'Tipo',      render: it => it.tipo === 'estorno' ? '<span class="badge badge-estorno">Estorno</span>' : '<span style="font-size:.75rem;color:var(--muted)">Lancamento</span>' },
  { key:'desc',   label:'Descricao', render: it => esc(it.desc) },
  { key:'cat',    label:'Categoria', render: it => '<span class="badge badge-cat">' + esc(it.cat || '-') + '</span>' },
  { key:'valor',  label:'Valor',     render: it => it.tipo === 'estorno' ? '<span class="val val-pos">+ ' + fmt(it.valor) + '</span>' : '<span class="val val-neg">- ' + fmt(it.valor) + '</span>' },
  { key:'_del',   label:'',          render: () => '' },
];

var CARTAO_READONLY_MSG = 'Este cliente pertence a outro login e esta disponivel apenas para visualizacao.';

function canEditCartaoClient() {
  if (canEditActiveClient()) return true;
  alert(CARTAO_READONLY_MSG);
  return false;
}

function getCartaoById(id) {
  return (data.clients[activeClient] && data.clients[activeClient].cartoes || []).find(c => c.id === id);
}

function cartaoOptionsHtml(selectedId) {
  var cliente = data.clients[activeClient];
  var cartoes = cliente && Array.isArray(cliente.cartoes) ? cliente.cartoes : [];
  if (cartoes.length === 0) return '<option value="">- sem cartao -</option>';
  return cartoes.map(function(cc) {
    return '<option value="' + esc(cc.id) + '"' + (cc.id === selectedId ? ' selected' : '') + '>' + esc(cc.nome) + '</option>';
  }).join('');
}

function categoriaCartaoOptionsHtml(selectedCat) {
  return loadCatsCartao().map(function(cat) {
    return '<option value="' + esc(cat) + '"' + (cat === selectedCat ? ' selected' : '') + '>' + esc(cat) + '</option>';
  }).join('');
}

function cartaoImportGuideHtml() {
  return '<div class="import-guide">'
    + '<div class="import-guide-head">Formato da planilha</div>'
    + '<div class="import-guide-grid">'
    + '<span class="import-guide-chip required">data</span>'
    + '<span class="import-guide-chip required">descricao</span>'
    + '<span class="import-guide-chip required">valor</span>'
    + '<span class="import-guide-chip">categoria</span>'
    + '</div>'
    + '<ul class="import-guide-list">'
    + '<li>Valor positivo vira <strong>lancamento</strong> na fatura.</li>'
    + '<li>Valor negativo vira <strong>estorno</strong>.</li>'
    + '<li>A coluna <strong>tipo</strong> nao e mais necessaria.</li>'
    + '</ul>'
    + '</div>';
}

var _ccTipo = 'lancamento';
var _ccFiltro = new Set();
var _ccFiltroMes = '';
var _ccFiltroTipo = 'todos';
var _ccFiltroCat = '';
var _ccFiltroBusca = '';
var _ccFiltroMulti = loadCartaoFilterMultiState();
var _ccPanels = {
  cadastrados: false,
  importar: false,
  novo: false,
  pagar: false
};

function loadCartaoFilterMultiState() {
  try {
    return localStorage.getItem('granafy_cartao_filter_multi') === '1';
  } catch (e) {
    return false;
  }
}

function saveCartaoFilterMultiState(enabled) {
  try {
    localStorage.setItem('granafy_cartao_filter_multi', enabled ? '1' : '0');
  } catch (e) {}
}

function toggleCartaoPanel(key) {
  _ccPanels[key] = !_ccPanels[key];
  renderCartao();
}

function cartaoPanel(key, title, body) {
  var open = !!_ccPanels[key];
  return '<div class="form-card collapsible-card cartao-collapsible-card' + (open ? ' open' : '') + '">'
    + '<button type="button" class="collapse-head" onclick="toggleCartaoPanel(\'' + key + '\')" aria-expanded="' + open + '">'
    + '<span>' + title + '</span>'
    + '<span class="collapse-chevron" aria-hidden="true">&#9662;</span>'
    + '</button>'
    + (open ? '<div class="collapse-body">' + body + '</div>' : '')
    + '</div>';
}

function setTipoCartao(tipo) {
  _ccTipo = tipo;
  var lanc = document.getElementById('tc-lanc');
  var est  = document.getElementById('tc-estorno');
  if (lanc) lanc.classList.toggle('active', tipo === 'lancamento');
  if (est)  est.classList.toggle('active', tipo === 'estorno');
}

function toggleFiltroCartao(id) {
  if (id === '__todos') {
    _ccFiltro.clear();
  } else {
    if (_ccFiltroMulti) {
      if (_ccFiltro.has(id)) _ccFiltro.delete(id);
      else _ccFiltro.add(id);
    } else {
      if (_ccFiltro.has(id) && _ccFiltro.size === 1) {
        return _renderCartaoFiltroETabela();
      }
      _ccFiltro.clear();
      _ccFiltro.add(id);
    }
  }
  _renderCartaoFiltroETabela();
}

function toggleFiltroCartaoMulti(enabled) {
  _ccFiltroMulti = !!enabled;
  saveCartaoFilterMultiState(_ccFiltroMulti);
  _renderCartaoFiltroETabela();
}

function aplicarFiltrosCartao() {
  var mes = document.getElementById('cc-filtro-mes');
  var tipo = document.getElementById('cc-filtro-tipo');
  var cat = document.getElementById('cc-filtro-cat');
  var busca = document.getElementById('cc-filtro-busca');

  _ccFiltroMes = mes ? mes.value : '';
  _ccFiltroTipo = tipo ? tipo.value : 'todos';
  _ccFiltroCat = cat ? cat.value : '';
  _ccFiltroBusca = busca ? busca.value.trim().toLowerCase() : '';

  _renderCartaoFiltroETabela();
}

function limparFiltrosCartao() {
  _ccFiltro.clear();
  _ccFiltroMes = '';
  _ccFiltroTipo = 'todos';
  _ccFiltroCat = '';
  _ccFiltroBusca = '';
  _renderCartaoFiltroETabela();
}

function renderCartao() {
  var c = data.clients[activeClient];
  if (!c) {
    document.getElementById('cartao-content').innerHTML =
      '<div class="empty-state"><div class="icon">&#128073;</div>Selecione um cliente.</div>';
    return;
  }

  if (!Array.isArray(c.cartoes)) c.cartoes = [];
  if (!Array.isArray(c.cartao)) c.cartao = [];

  _ccFiltro.forEach(id => {
    if (!c.cartoes.find(cc => cc.id === id)) _ccFiltro.delete(id);
  });

  var cats = loadCatsCartao();
  var cardsHtml = c.cartoes.length === 0
    ? '<p style="color:var(--muted);font-size:.82rem;margin-bottom:12px">Nenhum cartao cadastrado.</p>'
    : '<div class="cards-grid">' + c.cartoes.map(cc =>
        '<div class="card-chip">'
        + '<div class="cc-name">' + esc(cc.nome) + (cc.digits ? ' <span style="color:var(--muted);font-size:.72rem">- Final ' + esc(cc.digits) + '</span>' : '') + '</div>'
        + '<div class="cc-limit">Limite: ' + fmt(cc.limite || 0) + (cc.venc ? ' - Vence dia <strong>' + cc.venc + '</strong>' : '') + '</div>'
        + '<div class="cc-footer"><span class="cc-brand">' + esc(cc.bandeira || '') + '</span>'
        + '<button class="btn-sm red" onclick="deleteCartaoCard(\'' + cc.id + '\')">Remover</button></div>'
        + '</div>'
      ).join('') + '</div>';

  var cartaoOpts = c.cartoes.map(cc => '<option value="' + cc.id + '">' + esc(cc.nome) + '</option>').join('');
  var catOpts = cats.map(cat => '<option>' + esc(cat) + '</option>').join('');

  var cardsPanelBody = cardsHtml
    + '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:2px">'
    + '<p style="font-size:.7rem;color:var(--muted);margin-bottom:9px;font-weight:600;text-transform:uppercase;letter-spacing:.8px">Cadastrar novo cartao</p>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Nome</label><input type="text" id="cc-nome" placeholder="Ex: Nubank, Inter..."/></div>'
    + '<div class="form-group" style="max-width:95px"><label>Ultimos 4 digitos</label><input type="text" id="cc-digits" placeholder="1234" maxlength="4" inputmode="numeric"/></div>'
    + '<div class="form-group" style="max-width:140px"><label>Bandeira</label><select id="cc-bandeira"><option>Visa</option><option>Mastercard</option><option>Elo</option><option>Amex</option><option>Hipercard</option><option>Outro</option></select></div>'
    + '<div class="form-group" style="max-width:140px"><label>Limite (R$)</label><input type="text" id="cc-limite" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '<div class="form-group" style="max-width:110px"><label>Dia vencimento</label><input type="number" id="cc-venc" placeholder="Ex: 10" min="1" max="31"/></div>'
    + '</div><button class="btn-add" onclick="addCartaoCard()">Cadastrar cartao</button>'
    + '</div>';

  var importPanelBody = '<p style="font-size:.81rem;color:var(--muted);margin-bottom:12px">Baixe o modelo, preencha e importe.</p>'
    + cartaoImportGuideHtml()
    + '<div class="form-row" style="margin-bottom:12px">'
    + '<div class="form-group" style="max-width:220px"><label>Cartao da fatura</label><select id="cc-import-cartao">' + (c.cartoes.length === 0 ? '<option value="">-- cadastre um cartao --</option>' : cartaoOpts) + '</select></div>'
    + '</div>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
    + '<button class="btn-sm" onclick="exportCsvTemplate()">Baixar modelo (.xlsx)</button>'
    + '<button class="btn-sm" onclick="abrirImportacaoCartao()">Importar planilha</button>'
    + '</div>';

  var novoPanelBody = '<div class="tipo-toggle" style="margin-bottom:12px">'
    + '<button class="tipo-btn debito active" id="tc-lanc" onclick="setTipoCartao(\'lancamento\')">- Lancamento</button>'
    + '<button class="tipo-btn credito" id="tc-estorno" onclick="setTipoCartao(\'estorno\')">Estorno</button>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:132px"><label>Data</label><input type="date" id="cc-data"/></div>'
    + '<div class="form-group" style="max-width:172px"><label>Cartao</label><select id="cc-cartao-sel">' + (c.cartoes.length === 0 ? '<option value="">- sem cartao -</option>' : cartaoOpts) + '</select></div>'
    + '<div class="form-group"><label>Descricao</label><input type="text" id="cc-desc" placeholder="Ex: Supermercado..."/></div>'
    + '<div class="form-group" style="max-width:165px"><label>Categoria <span style="color:var(--accent);cursor:pointer;font-size:.68rem" onclick="openModal(\'settings\',\'cats_cartao\')">(+ gerir)</span></label><select id="cc-cat">' + catOpts + '</select></div>'
    + '<div class="form-group" style="max-width:138px"><label>Valor (R$)</label><input type="text" id="cc-valor" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '</div><button class="btn-add" onclick="addCartaoItem()">Adicionar</button>';

  var pagarPanelBody = '<div class="form-row">'
    + '<div class="form-group" style="max-width:180px"><label>Cartao</label><select id="pg-cartao">' + (c.cartoes.length === 0 ? '<option value="">- sem cartao -</option>' : cartaoOpts) + '</select></div>'
    + '<div class="form-group" style="max-width:150px"><label>Valor (R$)</label><input type="text" id="pg-valor" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '<div class="form-group" style="max-width:160px"><label>Data</label><input type="date" id="pg-data"/></div>'
    + '</div>'
    + '<button class="btn-add" onclick="pagarFaturaCartao()">Pagar fatura</button>';

  var html = '<div id="cc-summary-area"></div>'
    + '<div class="cartao-panels-grid">'
    + cartaoPanel('cadastrados', 'Cartoes cadastrados', cardsPanelBody)
    + cartaoPanel('importar', 'Importar fatura via planilha', importPanelBody)
    + cartaoPanel('novo', '+ Novo lancamento / estorno', novoPanelBody)
    + cartaoPanel('pagar', 'Pagar fatura', pagarPanelBody)
    + '</div>'
    + '<div id="cc-filter-table-area"></div>';

  document.getElementById('cartao-content').innerHTML = html;
  var di = document.getElementById('cc-data');
  if (di) di.value = new Date().toISOString().slice(0, 10);

  var pgData = document.getElementById('pg-data');
  if (pgData) pgData.value = new Date().toISOString().slice(0, 10);

  setTipoCartao(_ccTipo);
  initMoneyInputs(document.getElementById('cartao-content'));
  _renderCartaoFiltroETabela();
}

function _renderCartaoFiltroETabela() {
  var c = data.clients[activeClient];
  if (!c) return;

  if (!Array.isArray(c.cartoes)) c.cartoes = [];
  if (!Array.isArray(c.cartao)) c.cartao = [];

  var cols = getColOrder('cartao', COLS_CARTAO);
  var meses = [...new Set(c.cartao.map(it => (it.data || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  var cats = [...new Set(c.cartao.map(it => it.cat || '').filter(Boolean))].sort(compararCategoriaNome);
  var itensBase = _ccFiltro.size === 0 ? c.cartao : c.cartao.filter(it => _ccFiltro.has(it.cartaoId));
  var itens = itensBase.filter(it => {
    var texto = ((it.desc || '') + ' ' + (it.cat || '')).toLowerCase();
    if (_ccFiltroMes && !(it.data || '').startsWith(_ccFiltroMes)) return false;
    if (_ccFiltroTipo !== 'todos' && it.tipo !== _ccFiltroTipo) return false;
    if (_ccFiltroCat && it.cat !== _ccFiltroCat) return false;
    if (_ccFiltroBusca && !texto.includes(_ccFiltroBusca)) return false;
    return true;
  });

  var lancs = itens.filter(i => i.tipo !== 'estorno');
  var ests  = itens.filter(i => i.tipo === 'estorno');
  var tL = lancs.reduce((s, i) => s + Number(i.valor), 0);
  var tE = ests.reduce((s, i) => s + Number(i.valor), 0);

  var sumEl = document.getElementById('cc-summary-area');
  if (sumEl) {
    sumEl.innerHTML = '<div class="summary-grid">'
      + '<div class="summary-card"><div class="s-label">Total fatura' + (_ccFiltro.size ? ' <span style="color:var(--accent);font-size:.6rem">(filtrado)</span>' : '') + '</div><div class="s-val red">' + fmt(tL - tE) + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Lancamentos</div><div class="s-val blue">' + fmt(tL) + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Estornos</div><div class="s-val green">' + fmt(tE) + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Qtd. itens</div><div class="s-val blue">' + itens.length + '</div></div>'
      + '</div>';
  }

  var todoAtivo = _ccFiltro.size === 0;
  var filtroMesOpts = meses.map(m => {
    var parts = m.split('-');
    return '<option value="' + m + '"' + (_ccFiltroMes === m ? ' selected' : '') + '>' + parts[1] + '/' + parts[0] + '</option>';
  }).join('');
  var filtroCatOpts = cats.map(cat => '<option value="' + esc(cat) + '"' + (_ccFiltroCat === cat ? ' selected' : '') + '>' + esc(cat) + '</option>').join('');

  var filterHtml = '<div class="cc-filter-row"><span class="cc-filter-label">Filtrar por cartao:</span>'
    + '<span class="cc-chip todos' + (todoAtivo ? ' active' : '') + '" onclick="toggleFiltroCartao(\'__todos\')">Todos</span>';

  c.cartoes.forEach(cc => {
    var ativo = _ccFiltro.has(cc.id);
    filterHtml += '<span class="cc-chip' + (ativo ? ' active' : '') + '" onclick="toggleFiltroCartao(\'' + cc.id + '\')">' + esc(cc.nome) + (cc.digits ? ' ..' + esc(cc.digits) : '') + '</span>';
  });

  filterHtml += '<div class="cc-filter-tools">';
  if (_ccFiltro.size > 0) {
    filterHtml += '<span class="cc-filter-count">' + _ccFiltro.size + ' selecionado(s)</span>';
  }
  filterHtml += '<label class="cc-filter-toggle" title="Selecionar varios cartoes">'
    + '<span>Selecionar varios</span>'
    + '<span class="toggle-switch cc-toggle-switch">'
    + '<input type="checkbox" ' + (_ccFiltroMulti ? 'checked' : '') + ' onchange="toggleFiltroCartaoMulti(this.checked)"/>'
    + '<span class="toggle-track"></span>'
    + '</span>'
    + '</label>'
    + '</div></div>';
  filterHtml += '<div class="form-card"><h3>Filtros</h3>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:150px"><label>Periodo</label><select id="cc-filtro-mes"><option value="">Todos</option>' + filtroMesOpts + '</select></div>'
    + '<div class="form-group" style="max-width:160px"><label>Tipo</label><select id="cc-filtro-tipo"><option value="todos"' + (_ccFiltroTipo === 'todos' ? ' selected' : '') + '>Todos</option><option value="lancamento"' + (_ccFiltroTipo === 'lancamento' ? ' selected' : '') + '>Lancamento</option><option value="estorno"' + (_ccFiltroTipo === 'estorno' ? ' selected' : '') + '>Estorno</option></select></div>'
    + '<div class="form-group" style="max-width:190px"><label>Categoria</label><select id="cc-filtro-cat"><option value="">Todas</option>' + filtroCatOpts + '</select></div>'
    + '<div class="form-group"><label>Busca</label><input type="text" id="cc-filtro-busca" value="' + esc(_ccFiltroBusca) + '" placeholder="Descricao ou categoria" onkeydown="if(event.key===\'Enter\')aplicarFiltrosCartao()"/></div>'
    + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn-sm" onclick="aplicarFiltrosCartao()">Aplicar filtros</button><button class="btn-sm red" onclick="limparFiltrosCartao()">Limpar</button></div>'
    + '</div>';

  var area = document.getElementById('cc-filter-table-area');
  if (!area) return;

  area.innerHTML = filterHtml
    + '<p class="section-title">Historico de lancamentos</p>'
    + buildTable('cartao', cols, itens, function(item) {
        var realIdx = c.cartao.indexOf(item);
        return cols.map(col => col.key === '_del'
          ? '<td><div class="row-actions"><button class="btn-icon" onclick="editCartaoItem(' + realIdx + ')" title="Editar">&#9998;</button><button class="btn-icon danger" onclick="deleteCartaoItem(' + realIdx + ')" title="Excluir">&#128465;</button></div></td>'
          : '<td>' + col.render(item, realIdx) + '</td>'
        ).join('');
      }, r => r.tipo === 'estorno' ? 'row-estorno' : '');

  initDrag('cartao', COLS_CARTAO, () => _renderCartaoFiltroETabela());
}

async function addCartaoCard() {
  if (!canEditCartaoClient()) return;
  var nome = document.getElementById('cc-nome').value.trim();
  var digits = document.getElementById('cc-digits').value.replace(/\D/g, '').slice(0, 4);
  var bandeira = document.getElementById('cc-bandeira').value;
  var limite = parseMoney(document.getElementById('cc-limite'));
  var venc = parseInt(document.getElementById('cc-venc').value) || 0;

  if (!nome) return alert('Informe o nome do cartao.');

  const { error } = await supabaseClient
    .from('cartoes')
    .insert([Object.assign({
      cliente_id: activeClient,
      nome,
      digits,
      bandeira,
      limite: Number(limite || 0),
      venc: Number(venc || 0)
    }, getUserScopePayload())]);

  if (error) {
    console.error('Erro ao cadastrar cartao:', error);
    alert('Nao foi possivel cadastrar o cartao.');
    return;
  }

  await loadData();
  renderCartao();
}

async function deleteCartaoCard(id) {
  if (!canEditCartaoClient()) return;
  if (!(await appConfirm('Remover cartao?', { title: 'Excluir cartao', confirmText: 'Excluir' }))) return;

  const { error } = await applyUserScope(
    supabaseClient
      .from('cartoes')
      .delete()
      .eq('id', id)
  );

  if (error) {
    console.error('Erro ao excluir cartao:', error);
    alert('Nao foi possivel excluir o cartao.');
    return;
  }

  await loadData();
  renderCartao();
}

async function addCartaoItem() {
  if (!canEditCartaoClient()) return;
  var d_ = document.getElementById('cc-data').value;
  var cartaoId = (document.getElementById('cc-cartao-sel') && document.getElementById('cc-cartao-sel').value) || '';
  var desc = document.getElementById('cc-desc').value.trim();
  var cat = document.getElementById('cc-cat').value;
  var valor = parseMoney(document.getElementById('cc-valor'));

  if (!cartaoId) return alert('Selecione um cartao para o lancamento.');
  if (!desc || !valor) return alert('Preencha descricao e valor.');

  var duplicado = (data.clients[activeClient].cartao || []).find(it =>
    it.cartaoId === cartaoId
    && (it.data || '') === (d_ || '')
    && Number(it.valor || 0) === Number(valor || 0)
    && (it.tipo || 'lancamento') === _ccTipo
  );

  if (duplicado && !(await appConfirm('Ja existe um lancamento no mesmo cartao, data, valor e tipo. Deseja lancar novamente?', { title: 'Lancamento duplicado', confirmText: 'Lancar novamente' }))) {
    return;
  }

  const { error } = await supabaseClient
    .from('lancamentos_cartao')
    .insert([Object.assign({
      cliente_id: activeClient,
      cartao_id: cartaoId,
      data: d_ || null,
      descricao: desc,
      categoria: cat || null,
      tipo: _ccTipo,
      valor: Number(valor || 0)
    }, getUserScopePayload())]);

  if (error) {
    console.error('Erro ao cadastrar lancamento do cartao:', error);
    alert('Nao foi possivel cadastrar o item do cartao: ' + (error.message || 'erro desconhecido'));
    return;
  }

  await loadData();
  renderCartao();
}

async function deleteCartaoItem(i) {
  if (!canEditCartaoClient()) return;
  if (!(await appConfirm('Remover item?', { title: 'Excluir lancamento', confirmText: 'Excluir' }))) return;

  var c = data.clients[activeClient];
  var item = c.cartao[i];
  if (!item || !item.id) return;

  const { error } = await applyUserScope(
    supabaseClient
      .from('lancamentos_cartao')
      .delete()
      .eq('id', item.id)
  );

  if (error) {
    console.error('Erro ao excluir item do cartao:', error);
    alert('Nao foi possivel excluir o item.');
    return;
  }

  await loadData();
  renderCartao();
}

function exportCsvTemplate() {
  var rows = [
    ['data','descricao','valor','categoria'],
    ['15/06/2025','Supermercado Extra',250.00,'Alimentacao'],
    ['16/06/2025','Netflix',55.90,'Streaming'],
    ['17/06/2025','Estorno Supermercado',-50.00,'Alimentacao'],
  ];
  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:12},{wch:32},{wch:10},{wch:20}];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fatura');
  XLSX.writeFile(wb, 'modelo_fatura_granafy.xlsx');
}

async function editCartaoItem(i) {
  if (!canEditCartaoClient()) return;
  var c = data.clients[activeClient];
  var item = c.cartao[i];
  if (!item || !item.id) return;

  document.getElementById('modalTitle').textContent = 'Editar lancamento do cartao';
  document.getElementById('modalBody').innerHTML =
    '<div class="form-row">'
    + '<div class="form-group" style="max-width:170px"><label>Data</label><input type="date" id="cc-edit-data" value="' + esc(item.data || '') + '"/></div>'
    + '<div class="form-group" style="max-width:220px"><label>Cartao</label><select id="cc-edit-cartao">' + cartaoOptionsHtml(item.cartaoId || '') + '</select></div>'
    + '<div class="form-group" style="max-width:190px"><label>Tipo</label><select id="cc-edit-tipo"><option value="lancamento"' + ((item.tipo || 'lancamento') === 'lancamento' ? ' selected' : '') + '>Lancamento</option><option value="estorno"' + ((item.tipo || '') === 'estorno' ? ' selected' : '') + '>Estorno</option></select></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Descricao</label><input type="text" id="cc-edit-desc" value="' + esc(item.desc || '') + '" placeholder="Ex: supermercado, streaming..."/></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:220px"><label>Categoria</label><select id="cc-edit-cat">' + categoriaCartaoOptionsHtml(item.cat || '') + '</select></div>'
    + '<div class="form-group" style="max-width:160px"><label>Valor (R$)</label><input type="text" id="cc-edit-valor" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '</div>'
    + '<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:18px">'
    + '<button class="btn-sm red" type="button" onclick="closeModal()">Cancelar</button>'
    + '<button class="btn-add" type="button" style="margin-top:0" onclick="saveCartaoEditModal(' + i + ')">Salvar alteracoes</button>'
    + '</div>';

  document.getElementById('modalOverlay').classList.add('open');
  initMoneyInputs(document.getElementById('modalBody'));

  var valorInput = document.getElementById('cc-edit-valor');
  if (valorInput) {
    var cents = Math.round(Number(item.valor || 0) * 100);
    valorInput.dataset.cents = String(cents);
    valorInput.value = Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

async function saveCartaoEditModal(i) {
  if (!canEditCartaoClient()) return;
  var c = data.clients[activeClient];
  var item = c && c.cartao ? c.cartao[i] : null;
  if (!item || !item.id) return;

  var novaData = document.getElementById('cc-edit-data').value;
  var novoCartaoId = document.getElementById('cc-edit-cartao').value || null;
  var novoTipo = document.getElementById('cc-edit-tipo').value === 'estorno' ? 'estorno' : 'lancamento';
  var novoDesc = document.getElementById('cc-edit-desc').value.trim();
  var novaCat = document.getElementById('cc-edit-cat').value;
  var novoValor = parseMoney(document.getElementById('cc-edit-valor'));

  if (!novoCartaoId) return alert('Selecione um cartao.');
  if (!novoDesc || !novoValor) return alert('Descricao e valor sao obrigatorios.');

  const { error } = await applyUserScope(
    supabaseClient
      .from('lancamentos_cartao')
      .update({
        cartao_id: novoCartaoId,
        data: novaData || null,
        descricao: novoDesc,
        categoria: novaCat || null,
        tipo: novoTipo,
        valor: Number(novoValor || 0)
      })
      .eq('id', item.id)
  );

  if (error) {
    console.error('Erro ao editar item do cartao:', error);
    alert('Nao foi possivel editar o item: ' + (error.message || 'erro desconhecido'));
    return;
  }

  await loadData();
  closeModal();
  renderCartao();
}

function abrirImportacaoCartao() {
  if (!canEditCartaoClient()) return;
  var sel = document.getElementById('cc-import-cartao');
  if (!sel || !sel.value) {
    alert('Selecione ou cadastre um cartao antes de importar a fatura.');
    return;
  }
  document.getElementById('importXlsxInput').click();
}

async function importXlsx(event) {
  var file = event.target.files[0];
  if (!file) return;
  if (!activeClient) return alert('Selecione um cliente primeiro.');
  var importCartaoId = (document.getElementById('cc-import-cartao') && document.getElementById('cc-import-cartao').value) || '';
  if (!importCartaoId) {
    event.target.value = '';
    return alert('Selecione o cartao da fatura antes de importar.');
  }

  var reader = new FileReader();
  reader.onload = async function(e) {
    var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
    var ws = wb.Sheets[wb.SheetNames[0]];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    var header = (rows[0] || []).map(h => String(h).toLowerCase().trim());
    var iDate = header.findIndex(h => h.includes('data') || h.includes('date'));
    var iDesc = header.findIndex(h => h.includes('desc'));
    var iVal  = header.findIndex(h => h.includes('valor') || h.includes('value') || h.includes('amount'));
    var iCat  = header.findIndex(h => h.includes('cat'));

    if (iDate < 0 || iDesc < 0 || iVal < 0) {
      return alert('Planilha invalida. Colunas obrigatorias: data, descricao, valor.');
    }

    let count = 0;
    let erros = 0;

    for (const row of rows.slice(1)) {
      var rawDate = String(row[iDate] || '').trim();
      var desc = String(row[iDesc] || '').trim();
      var valorBruto = 0;
      var rawVal = row[iVal];

      if (typeof rawVal === 'number') valorBruto = rawVal;
      else valorBruto = parseFloat(String(rawVal).replace(/[^0-9,.-]/g, '').replace(',', '.')) || 0;

      if (!desc || !valorBruto) continue;

      var cat = iCat >= 0 ? String(row[iCat] || 'Outros').trim() : 'Outros';
      var tipo = Number(valorBruto || 0) < 0 ? 'estorno' : 'lancamento';
      var valor = Math.abs(Number(valorBruto || 0));

      var dataFmt = '';
      if (typeof rawDate === 'string') {
        var dm = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dm) dataFmt = dm[3] + '-' + dm[2].padStart(2, '0') + '-' + dm[1].padStart(2, '0');
      } else if (typeof rawDate === 'number') {
        var d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        dataFmt = d.toISOString().slice(0, 10);
      }

      var duplicado = (data.clients[activeClient].cartao || []).find(it =>
        it.cartaoId === importCartaoId
        && (it.data || '') === (dataFmt || '')
        && Number(it.valor || 0) === Number(valor || 0)
        && (it.tipo || 'lancamento') === tipo
      );

      if (duplicado && !(await appConfirm('Ja existe um lancamento no mesmo cartao, data, valor e tipo: "' + desc + '". Deseja importar novamente?', { title: 'Lancamento duplicado', confirmText: 'Importar novamente' }))) {
        continue;
      }

      const { error } = await supabaseClient
        .from('lancamentos_cartao')
        .insert([Object.assign({
          cliente_id: activeClient,
          cartao_id: importCartaoId,
          data: dataFmt || null,
          descricao: desc,
          categoria: cat,
          tipo: tipo,
          valor: Number(valor || 0)
        }, getUserScopePayload())]);

      if (error) {
        console.error('Erro ao importar item da planilha:', row, error);
        erros++;
      } else {
        count++;
      }
    }

    await loadData();
    renderCartao();
    alert(count + ' lancamento(s) importado(s) com sucesso!' + (erros ? ' ' + erros + ' falharam.' : ''));
  };

  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

async function pagarFaturaCartao() {
  if (!canEditCartaoClient()) return;
  var cartaoId = document.getElementById('pg-cartao').value;
  var valor = parseMoney(document.getElementById('pg-valor'));
  var dataPg = document.getElementById('pg-data').value;

  if (!cartaoId || !valor) {
    return alert('Informe o cartao e o valor.');
  }

  var cartao = getCartaoById(cartaoId);
  var nomeCartao = cartao ? cartao.nome : 'Cartao';

  const payload = {
    cliente_id: activeClient,
    tipo: 'debito',
    descricao: 'Pagamento fatura - ' + nomeCartao,
    categoria: 'Cartao de Credito',
    valor: Number(valor || 0),
    data_lancamento: dataPg || new Date().toISOString().slice(0, 10)
  };

  const { error } = await supabaseClient
    .from('lancamentos')
    .insert([Object.assign(payload, getUserScopePayload())]);

  if (error) {
    console.error(error);
    alert('Erro ao registrar pagamento.');
    return;
  }

  alert('Fatura paga com sucesso!');
  await loadData();
  renderCartao();
}
