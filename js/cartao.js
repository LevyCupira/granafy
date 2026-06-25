// Cartao: logica da aba, filtros, importacao e pagamentos.

var COLS_CARTAO = [
  { key:'data',   label:'Data',      render: it => '<span style="color:var(--muted);font-size:.78rem">' + (it.data ? it.data.split('-').reverse().join('/') : '-') + '</span>' },
  { key:'cartao', label:'Cartão',    render: it => { var cc = getCartaoById(it.cartaoId); return cc ? '<span class="badge badge-card">' + esc(cc.nome) + '</span>' : '<span style="color:var(--muted);font-size:.76rem">-</span>'; } },
  { key:'tipo',   label:'Tipo',      render: it => it.tipo === 'estorno'
      ? '<span class="badge badge-estorno">Estorno</span>'
      : (it.tipo === 'pagamento'
        ? '<span class="badge badge-payment">Pagamento</span>'
        : '<span style="font-size:.75rem;color:var(--muted)">Lançamento</span>') },
  { key:'desc',   label:'Descrição', render: it => {
      var info = parseCartaoInstallmentInfo(it.desc || '');
      if (!info || info.total < 2) return esc(it.desc);
      return esc(it.desc) + '<div class="installment-note">Compra parcelada ' + info.atual + '/' + info.total + '</div>';
    } },
  { key:'cat',    label:'Categoria', render: it => '<span class="badge badge-cat">' + esc(it.cat || '-') + '</span>' },
  { key:'valor',  label:'Valor',     render: it => it.tipo === 'estorno'
      ? '<span class="val val-pos">+ ' + fmt(it.valor) + '</span>'
      : '<span class="val val-neg">- ' + fmt(it.valor) + '</span>' },
  { key:'_del',   label:'',          render: () => '' },
];

var CARTAO_READONLY_MSG = 'Este cliente pertence a outro login e está disponível apenas para visualização.';

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
  if (cartoes.length === 0) return '<option value="">- sem cartão -</option>';
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
    + '<span class="import-guide-chip required">descrição</span>'
    + '<span class="import-guide-chip required">valor</span>'
    + '<span class="import-guide-chip">categoria</span>'
    + '</div>'
    + '<ul class="import-guide-list">'
    + '<li>Valor positivo vira <strong>lançamento</strong> na fatura.</li>'
    + '<li>Valor negativo vira <strong>estorno</strong>.</li>'
    + '<li>A coluna <strong>tipo</strong> não é mais necessária.</li>'
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
var _ccLastDateMemory = '';
var _ccView = 'lancamentos';
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

function parseCartaoInstallmentInfo(desc) {
  var texto = String(desc || '').trim();
  var match = texto.match(/(?:^|\s)(\d{1,3})\s*\/\s*(\d{1,3})(?:\s*$)/);
  if (!match) return null;
  var atual = Number(match[1]);
  var total = Number(match[2]);
  if (!atual || !total || atual > total) return null;
  return { atual: atual, total: total };
}

function isDeferredCartaoInstallment(item) {
  if (!item || item.tipo === 'estorno' || item.tipo === 'pagamento') return false;
  var info = parseCartaoInstallmentInfo(item.desc || '');
  return !!(info && info.atual > 1);
}

function cartaoInstallmentBaseDesc(desc) {
  return String(desc || '').replace(/\s+\d{1,3}\s*\/\s*\d{1,3}\s*$/, '').trim();
}

function normalizeCartaoSeriesKey(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cartaoInstallmentSeriesKey(item) {
  var info = parseCartaoInstallmentInfo(item && item.desc || '');
  if (!info || info.total < 2) return null;
  return [
    item.cartaoId || '',
    item.tipo || 'lancamento',
    normalizeCartaoSeriesKey(cartaoInstallmentBaseDesc(item.desc || '')),
    Number(item.valor || 0).toFixed(2),
    info.total
  ].join('|');
}

function getCartaoInstallmentSeriesItems(item, cartaoItems) {
  var key = cartaoInstallmentSeriesKey(item);
  if (!key) return [];
  return (cartaoItems || []).filter(function(entry) {
    return cartaoInstallmentSeriesKey(entry) === key;
  }).slice().sort(function(a, b) {
    var infoA = parseCartaoInstallmentInfo(a.desc || '');
    var infoB = parseCartaoInstallmentInfo(b.desc || '');
    return (infoA ? infoA.atual : 0) - (infoB ? infoB.atual : 0);
  });
}

function cartaoLastDateStorageKey() {
  return 'granafy_cartao_last_date_' + String(activeClient || 'global');
}

function loadCartaoLastDate() {
  try {
    var saved = localStorage.getItem(cartaoLastDateStorageKey());
    if (saved) return saved;
  } catch (e) {}
  return _ccLastDateMemory || new Date().toISOString().slice(0, 10);
}

function saveCartaoLastDate(value) {
  var iso = String(value || '').trim();
  if (!iso) return;
  _ccLastDateMemory = iso;
  try {
    localStorage.setItem(cartaoLastDateStorageKey(), iso);
  } catch (e) {}
}

function addMonthsClampedIso(dateIso, monthsToAdd) {
  var match = String(dateIso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateIso || '';
  var year = Number(match[1]);
  var month = Number(match[2]) - 1;
  var day = Number(match[3]);
  var targetMonthIndex = month + Number(monthsToAdd || 0);
  var targetYear = year + Math.floor(targetMonthIndex / 12);
  var normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  var lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  var clampedDay = Math.min(day, lastDay);
  var result = new Date(targetYear, normalizedMonth, clampedDay);
  return result.toISOString().slice(0, 10);
}

function updateParcelasCartaoState() {
  var input = document.getElementById('cc-parcelas');
  if (!input) return;
  var isEstorno = _ccTipo === 'estorno';
  if (isEstorno) {
    input.value = '1';
  }
  input.disabled = isEstorno;
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
  updateParcelasCartaoState();
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


function setCartaoView(view) {
  _ccView = view || 'lancamentos';
  renderCartao();
}

function cartaoFilteredItems(cliente) {
  if (!cliente) return [];
  var itensBase = _ccFiltro.size === 0 ? (cliente.cartao || []) : (cliente.cartao || []).filter(function(it) { return _ccFiltro.has(it.cartaoId); });
  return itensBase.filter(function(it) {
    var texto = ((it.desc || '') + ' ' + (it.cat || '')).toLowerCase();
    if (_ccFiltroMes && !(it.data || '').startsWith(_ccFiltroMes)) return false;
    if (_ccFiltroTipo !== 'todos' && it.tipo !== _ccFiltroTipo) return false;
    if (_ccFiltroCat && it.cat !== _ccFiltroCat) return false;
    if (_ccFiltroBusca && !texto.includes(_ccFiltroBusca)) return false;
    return true;
  }).slice().sort(function(a, b) {
    var deferredA = isDeferredCartaoInstallment(a);
    var deferredB = isDeferredCartaoInstallment(b);
    if (deferredA !== deferredB) return deferredA ? 1 : -1;

    var dataA = String(a && a.data || '');
    var dataB = String(b && b.data || '');
    if (dataA !== dataB) return dataB.localeCompare(dataA);

    var parcA = parseCartaoInstallmentInfo(a && a.desc || '');
    var parcB = parseCartaoInstallmentInfo(b && b.desc || '');
    if (deferredA && deferredB && parcA && parcB) {
      if (parcA.atual !== parcB.atual) return parcA.atual - parcB.atual;
      if (parcA.total !== parcB.total) return parcA.total - parcB.total;
    }

    return String(a && a.desc || '').localeCompare(String(b && b.desc || ''), 'pt-BR');
  });
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

  _ccFiltro.forEach(function(id) {
    if (!c.cartoes.find(function(cc) { return cc.id === id; })) _ccFiltro.delete(id);
  });

  var cats = loadCatsCartao();
  var itensFiltrados = cartaoFilteredItems(c);
  var totalLancamentos = itensFiltrados.filter(function(i) { return i.tipo !== 'estorno' && i.tipo !== 'pagamento'; }).reduce(function(s, i) { return s + Number(i.valor || 0); }, 0);
  var totalEstornos = itensFiltrados.filter(function(i) { return i.tipo === 'estorno'; }).reduce(function(s, i) { return s + Number(i.valor || 0); }, 0);
  var totalPagamentos = itensFiltrados.filter(function(i) { return i.tipo === 'pagamento'; }).reduce(function(s, i) { return s + Number(i.valor || 0); }, 0);
  var totalFatura = totalLancamentos - totalEstornos;
  var cartaoOpts = c.cartoes.map(function(cc) { return '<option value="' + cc.id + '">' + esc(cc.nome) + '</option>'; }).join('');
  var catOpts = cats.map(function(cat) { return '<option>' + esc(cat) + '</option>'; }).join('');

  var cardsHtml = c.cartoes.length === 0
    ? '<div class="empty-state cc-empty-inline">Nenhum cartão cadastrado.</div>'
    : '<div class="cards-grid">' + c.cartoes.map(function(cc) {
        return '<div class="card-chip">'
        + '<div class="cc-name">' + esc(cc.nome) + (cc.digits ? ' <span style="color:var(--muted);font-size:.72rem">- Final ' + esc(cc.digits) + '</span>' : '') + '</div>'
        + '<div class="cc-limit">Limite: ' + fmt(cc.limite || 0) + (cc.venc ? ' - Vence dia <strong>' + cc.venc + '</strong>' : '') + '</div>'
        + '<div class="cc-footer"><span class="cc-brand">' + esc(cc.bandeira || '') + '</span>'
        + '<button class="btn-sm red" onclick="deleteCartaoCard(\'' + cc.id + '\')">Remover</button></div>'
        + '</div>';
      }).join('') + '</div>';

  var cardsPanelBody = cardsHtml
    + '<div class="cc-inline-form">'
    + '<p>Cadastrar novo cartão</p>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Nome</label><input type="text" id="cc-nome" placeholder="Ex: Nubank, Inter..."/></div>'
    + '<div class="form-group" style="max-width:110px"><label>Últimos 4 dígitos</label><input type="text" id="cc-digits" placeholder="1234" maxlength="4" inputmode="numeric"/></div>'
    + '<div class="form-group" style="max-width:140px"><label>Bandeira</label><select id="cc-bandeira"><option>Visa</option><option>Mastercard</option><option>Elo</option><option>Amex</option><option>Hipercard</option><option>Outro</option></select></div>'
    + '<div class="form-group" style="max-width:140px"><label>Limite (R$)</label><input type="text" id="cc-limite" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '<div class="form-group" style="max-width:110px"><label>Dia vencimento</label><input type="number" id="cc-venc" placeholder="Ex: 10" min="1" max="31"/></div>'
    + '</div><button class="btn-add" onclick="addCartaoCard()">Cadastrar cartão</button>'
    + '</div>';

  var importPanelBody = '<div class="cc-section-head"><div><h3>Importar fatura via planilha</h3><p class="cartao-helper-text">Baixe o modelo, selecione o cartão e importe os lançamentos em lote.</p></div></div>'
    + cartaoImportGuideHtml()
    + '<div class="form-row" style="margin-bottom:12px">'
    + '<div class="form-group" style="max-width:260px"><label>Cartão da fatura</label><select id="cc-import-cartao">' + (c.cartoes.length === 0 ? '<option value="">-- cadastre um cartão --</option>' : cartaoOpts) + '</select></div>'
    + '</div>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
    + '<button class="btn-sm" onclick="exportCsvTemplate()">Baixar modelo (.xlsx)</button>'
    + '<button class="btn-sm" onclick="abrirImportacaoCartao()">Importar planilha</button>'
    + '</div>';

  var novoPanelBody = '<div class="tipo-toggle" style="margin-bottom:12px">'
    + '<button class="tipo-btn debito active" id="tc-lanc" onclick="setTipoCartao(\'lancamento\')">- Lançamento</button>'
    + '<button class="tipo-btn credito" id="tc-estorno" onclick="setTipoCartao(\'estorno\')">Estorno</button>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:132px"><label>Data</label><input type="date" id="cc-data"/></div>'
    + '<div class="form-group" style="max-width:172px"><label>Cartão</label><select id="cc-cartao-sel">' + (c.cartoes.length === 0 ? '<option value="">- sem cartão -</option>' : cartaoOpts) + '</select></div>'
    + '<div class="form-group"><label>Descrição</label><input type="text" id="cc-desc" placeholder="Ex: Supermercado..." onblur="this.value=formatDescriptionTitleCase(this.value)"/></div>'
    + '<div class="form-group" style="max-width:165px"><label>Categoria <span style="color:var(--accent);cursor:pointer;font-size:.68rem" onclick="openModal(\'settings\',\'cats_cartao\')">(+ gerir)</span></label><select id="cc-cat">' + catOpts + '</select></div>'
    + '<div class="form-group" style="max-width:118px"><label>Parcelas</label><input type="number" id="cc-parcelas" value="1" min="1" max="120"/></div>'
    + '<div class="form-group" style="max-width:138px"><label>Valor (R$)</label><input type="text" id="cc-valor" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '</div>'
    + '<div class="cartao-helper-text">A partir de 2 parcelas, o sistema cria as próximas competências automaticamente.</div>'
    + '<button class="btn-add" onclick="addCartaoItem()">Adicionar</button>';

  var pagarPanelBody = '<div class="form-row">'
    + '<div class="form-group" style="max-width:180px"><label>Cartão</label><select id="pg-cartao">' + (c.cartoes.length === 0 ? '<option value="">- sem cartão -</option>' : cartaoOpts) + '</select></div>'
    + '<div class="form-group" style="max-width:150px"><label>Valor (R$)</label><input type="text" id="pg-valor" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '<div class="form-group" style="max-width:160px"><label>Data</label><input type="date" id="pg-data"/></div>'
    + '</div>'
    + '<div class="cartao-helper-text">Registra a saída no extrato e também entra no histórico do cartão como pagamento.</div>'
    + '<button class="btn-add" onclick="pagarFaturaCartao()">Pagar fatura</button>';

  var viewHtml = '';
  if (_ccView === 'cartoes') {
    viewHtml = '<div class="form-card cc-view-card"><div class="cc-section-head"><div><h3>Cartões cadastrados</h3><p class="cartao-helper-text">Gerencie cartões, limite, bandeira e vencimento da fatura.</p></div></div>' + cardsPanelBody + '</div>';
  } else if (_ccView === 'importar') {
    viewHtml = '<div class="form-card cc-view-card">' + importPanelBody + '</div>';
  } else if (_ccView === 'pagar') {
    viewHtml = '<div class="form-card cc-view-card"><div class="cc-section-head"><div><h3>Pagar fatura</h3><p class="cartao-helper-text">Registre o pagamento no Extrato e no histórico do cartão.</p></div></div>' + pagarPanelBody + '</div>';
  } else {
    viewHtml = '<div id="cc-filter-table-area"></div>';
  }

  var html = '<div class="cc-workbench-hero">'
    + '<div class="cc-workbench-head"><div><h3>Cartão</h3><p class="cartao-helper-text">Controle faturas, compras parceladas, estornos e pagamentos por cartão.</p></div>'
    + '<div class="cc-workbench-actions"><button class="btn-sm" onclick="setCartaoView(\'lancamentos\');_ccPanels.novo=!_ccPanels.novo;renderCartao()">Novo lançamento</button><button class="btn-sm" onclick="setCartaoView(\'importar\')">Importar</button><button class="btn-sm" onclick="setCartaoView(\'pagar\')">Pagar fatura</button></div></div>'
    + (_ccPanels.novo ? '<div class="cc-quick-entry"><div class="cc-section-head"><div><h3>Novo lançamento / estorno</h3><p class="cartao-helper-text">Inclua compras, ajustes e estornos da fatura.</p></div><button class="btn-sm red" onclick="_ccPanels.novo=false;renderCartao()">Fechar</button></div>' + novoPanelBody + '</div>' : '')
    + '</div>'
    + '<div id="cc-summary-area"></div>'
    + '<div class="cc-workbench-tabs">'
    + '<button type="button" class="cc-workbench-tab' + (_ccView === 'lancamentos' ? ' active' : '') + '" onclick="setCartaoView(\'lancamentos\')"><span>Lançamentos</span><strong>' + itensFiltrados.length + '</strong></button>'
    + '<button type="button" class="cc-workbench-tab' + (_ccView === 'cartoes' ? ' active' : '') + '" onclick="setCartaoView(\'cartoes\')"><span>Cartões</span><strong>' + c.cartoes.length + '</strong></button>'
    + '<button type="button" class="cc-workbench-tab' + (_ccView === 'importar' ? ' active' : '') + '" onclick="setCartaoView(\'importar\')"><span>Importar</span><strong>XLSX</strong></button>'
    + '<button type="button" class="cc-workbench-tab' + (_ccView === 'pagar' ? ' active' : '') + '" onclick="setCartaoView(\'pagar\')"><span>Pagar fatura</span><strong>' + fmt(totalPagamentos).replace('R$ ', '') + '</strong></button>'
    + '</div>'
    + viewHtml;

  document.getElementById('cartao-content').innerHTML = html;
  var di = document.getElementById('cc-data');
  if (di) di.value = loadCartaoLastDate();

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
  var meses = [...new Set(c.cartao.map(function(it) { return (it.data || '').slice(0, 7); }).filter(Boolean))].sort();
  var cats = [...new Set(c.cartao.map(function(it) { return it.cat || ''; }).filter(Boolean))].sort(compararCategoriaNome);
  var itens = cartaoFilteredItems(c);

  var lancs = itens.filter(function(i) { return i.tipo !== 'estorno' && i.tipo !== 'pagamento'; });
  var ests  = itens.filter(function(i) { return i.tipo === 'estorno'; });
  var pags  = itens.filter(function(i) { return i.tipo === 'pagamento'; });
  var tL = lancs.reduce(function(s, i) { return s + Number(i.valor || 0); }, 0);
  var tE = ests.reduce(function(s, i) { return s + Number(i.valor || 0); }, 0);
  var tP = pags.reduce(function(s, i) { return s + Number(i.valor || 0); }, 0);

  var sumEl = document.getElementById('cc-summary-area');
  if (sumEl) {
    sumEl.innerHTML = '<div class="summary-grid cc-summary-grid">'
      + '<div class="summary-card"><div class="s-label">Total fatura' + (_ccFiltro.size ? ' <span style="color:var(--accent);font-size:.6rem">(filtrado)</span>' : '') + '</div><div class="s-val red">' + fmt(tL - tE) + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Lançamentos</div><div class="s-val blue">' + fmt(tL) + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Estornos</div><div class="s-val green">' + fmt(tE) + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Pagamentos</div><div class="s-val blue">' + fmt(tP) + '</div></div>'
      + '<div class="summary-card"><div class="s-label">Qtd. itens</div><div class="s-val blue">' + itens.length + '</div></div>'
      + '</div>';
  }

  var todoAtivo = _ccFiltro.size === 0;
  var filtroMesOpts = meses.map(function(m) {
    var parts = m.split('-');
    return '<option value="' + m + '"' + (_ccFiltroMes === m ? ' selected' : '') + '>' + parts[1] + '/' + parts[0] + '</option>';
  }).join('');
  var filtroCatOpts = cats.map(function(cat) { return '<option value="' + esc(cat) + '"' + (_ccFiltroCat === cat ? ' selected' : '') + '>' + esc(cat) + '</option>'; }).join('');

  var filterHtml = '<div class="cc-filter-row"><span class="cc-filter-label">Filtrar por cartão:</span>'
    + '<span class="cc-chip todos' + (todoAtivo ? ' active' : '') + '" onclick="toggleFiltroCartao(\'__todos\')">Todos</span>';

  c.cartoes.forEach(function(cc) {
    var ativo = _ccFiltro.has(cc.id);
    filterHtml += '<span class="cc-chip' + (ativo ? ' active' : '') + '" onclick="toggleFiltroCartao(\'' + cc.id + '\')">' + esc(cc.nome) + (cc.digits ? ' ..' + esc(cc.digits) : '') + '</span>';
  });

  filterHtml += '<div class="cc-filter-tools">';
  if (_ccFiltro.size > 0) filterHtml += '<span class="cc-filter-count">' + _ccFiltro.size + ' selecionado(s)</span>';
  filterHtml += '<label class="cc-filter-toggle" title="Selecionar vários cartões">'
    + '<span>Selecionar vários</span>'
    + '<span class="toggle-switch cc-toggle-switch">'
    + '<input type="checkbox" ' + (_ccFiltroMulti ? 'checked' : '') + ' onchange="toggleFiltroCartaoMulti(this.checked)"/>'
    + '<span class="toggle-track"></span>'
    + '</span>'
    + '</label>'
    + '</div></div>';

  filterHtml += '<div class="form-card cc-filter-strip"><div class="cc-section-head"><div><h3>Filtros</h3><p class="cartao-helper-text">Filtre por cartão, período, tipo, categoria e busca textual.</p></div></div>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:150px"><label>Período</label><select id="cc-filtro-mes"><option value="">Todos</option>' + filtroMesOpts + '</select></div>'
    + '<div class="form-group" style="max-width:160px"><label>Tipo</label><select id="cc-filtro-tipo"><option value="todos"' + (_ccFiltroTipo === 'todos' ? ' selected' : '') + '>Todos</option><option value="lancamento"' + (_ccFiltroTipo === 'lancamento' ? ' selected' : '') + '>Lançamento</option><option value="estorno"' + (_ccFiltroTipo === 'estorno' ? ' selected' : '') + '>Estorno</option><option value="pagamento"' + (_ccFiltroTipo === 'pagamento' ? ' selected' : '') + '>Pagamento</option></select></div>'
    + '<div class="form-group" style="max-width:190px"><label>Categoria</label><select id="cc-filtro-cat"><option value="">Todas</option>' + filtroCatOpts + '</select></div>'
    + '<div class="form-group"><label>Busca</label><input type="text" id="cc-filtro-busca" value="' + esc(_ccFiltroBusca) + '" placeholder="Descrição ou categoria" onkeydown="if(event.key===\'Enter\')aplicarFiltrosCartao()"/></div>'
    + '</div>'
    + '<div class="cc-filter-actions"><button class="btn-sm" onclick="aplicarFiltrosCartao()">Aplicar filtros</button><button class="btn-sm red" onclick="limparFiltrosCartao()">Limpar</button></div>'
    + '</div>';

  var area = document.getElementById('cc-filter-table-area');
  if (!area) return;

  area.innerHTML = filterHtml
    + '<div class="cc-list-head"><div><h3>Histórico de lançamentos</h3><p class="cartao-helper-text">' + itens.length + ' item(ns) com os filtros atuais.</p></div></div>'
    + buildTable('cartao', cols, itens, function(item) {
        var realIdx = c.cartao.indexOf(item);
        return cols.map(function(col) { return col.key === '_del'
          ? '<td><div class="row-actions"><button class="btn-icon" onclick="editCartaoItem(' + realIdx + ')" title="Editar">&#9998;</button><button class="btn-icon danger" onclick="deleteCartaoItem(' + realIdx + ')" title="Excluir">&#128465;</button></div></td>'
          : '<td>' + col.render(item, realIdx) + '</td>';
        }).join('');
      }, function(r) {
        if (r.tipo === 'estorno') return 'row-estorno';
        if (r.tipo === 'pagamento') return 'row-payment';
        return '';
      });

  initDrag('cartao', COLS_CARTAO, function() { return _renderCartaoFiltroETabela(); });
}

async function addCartaoCard() {
  if (!canEditCartaoClient()) return;
  var nome = document.getElementById('cc-nome').value.trim();
  var digits = document.getElementById('cc-digits').value.replace(/\D/g, '').slice(0, 4);
  var bandeira = document.getElementById('cc-bandeira').value;
  var limite = parseMoney(document.getElementById('cc-limite'));
  var venc = parseInt(document.getElementById('cc-venc').value) || 0;

  if (!nome) return alert('Informe o nome do cartão.');

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
    console.error('Erro ao cadastrar cartão:', error);
    alert('Não foi possível cadastrar o cartão.');
    return;
  }

  await loadData();
  renderCartao();
}

async function deleteCartaoCard(id) {
  if (!canEditCartaoClient()) return;
  if (!(await appConfirm('Remover cartão?', { title: 'Excluir cartão', confirmText: 'Excluir' }))) return;

  const { error } = await applyUserScope(
    supabaseClient
      .from('cartoes')
      .delete()
      .eq('id', id)
  );

  if (error) {
    console.error('Erro ao excluir cartão:', error);
    alert('Não foi possível excluir o cartão.');
    return;
  }

  await loadData();
  renderCartao();
}

async function addCartaoItem() {
  if (!canEditCartaoClient()) return;
  var d_ = document.getElementById('cc-data').value;
  var cartaoId = (document.getElementById('cc-cartao-sel') && document.getElementById('cc-cartao-sel').value) || '';
  var desc = formatDescriptionTitleCase(document.getElementById('cc-desc').value);
  var cat = document.getElementById('cc-cat').value;
  var parcelas = Math.max(1, parseInt(document.getElementById('cc-parcelas').value, 10) || 1);
  var valor = parseMoney(document.getElementById('cc-valor'));

  if (!cartaoId) return alert('Selecione um cartão para o lançamento.');
  if (!desc || !valor) return alert('Preencha descrição e valor.');

  var lancamentosParaInserir = Array.from({ length: parcelas }, function(_, idx) {
    var dataParcela = _ccTipo === 'estorno' ? d_ : addMonthsClampedIso(d_, idx);
    var descricaoParcela = parcelas > 1 && _ccTipo !== 'estorno'
      ? (desc + ' ' + (idx + 1) + '/' + parcelas)
      : desc;
    return Object.assign({
      cliente_id: activeClient,
      cartao_id: cartaoId,
      data: dataParcela || null,
      descricao: descricaoParcela,
      categoria: cat || null,
      tipo: _ccTipo,
      valor: Number(valor || 0)
    }, getUserScopePayload());
  });

  var duplicado = lancamentosParaInserir.find(function(payload) {
    return (data.clients[activeClient].cartao || []).find(function(it) {
      return it.cartaoId === cartaoId
        && (it.data || '') === String(payload.data || '')
        && Number(it.valor || 0) === Number(valor || 0)
        && (it.tipo || 'lancamento') === _ccTipo;
    });
  });

  if (duplicado && !(await appConfirm('Já existe pelo menos um lançamento no mesmo cartão, data, valor e tipo. Deseja lançar novamente?', { title: 'Lançamento duplicado', confirmText: 'Lançar novamente' }))) {
    return;
  }

  const { error } = await supabaseClient
    .from('lancamentos_cartao')
    .insert(lancamentosParaInserir);

  if (error) {
    console.error('Erro ao cadastrar lançamento do cartão:', error);
    alert('Não foi possível cadastrar o item do cartão: ' + (error.message || 'erro desconhecido'));
    return;
  }

  saveCartaoLastDate(d_);
  await loadData();
  renderCartao();
}

async function deleteCartaoItem(i) {
  if (!canEditCartaoClient()) return;
  var c = data.clients[activeClient];
  var item = c.cartao[i];
  if (!item || !item.id) return;
  var serie = getCartaoInstallmentSeriesItems(item, c.cartao || []);
  var idsParaExcluir = [item.id];

  if (serie.length > 1) {
    var excluirTodas = await appConfirm(
      'Esta compra tem ' + serie.length + ' parcelas. Deseja excluir todas as parcelas? Se escolher "' + 'Apenas esta' + '", removeremos só a parcela atual.',
      { title: 'Excluir compra parcelada', confirmText: 'Excluir todas', cancelText: 'Apenas esta' }
    );
    if (excluirTodas) {
      idsParaExcluir = serie.map(function(entry) { return entry.id; }).filter(Boolean);
    }
  } else {
    if (!(await appConfirm('Remover item?', { title: 'Excluir lançamento', confirmText: 'Excluir' }))) return;
  }

  const { error } = await applyUserScope(
    supabaseClient
      .from('lancamentos_cartao')
      .delete()
      .in('id', idsParaExcluir)
  );

  if (error) {
    console.error('Erro ao excluir item do cartão:', error);
    alert('Não foi possível excluir o item.');
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
  var infoParcela = parseCartaoInstallmentInfo(item.desc || '');
  var serie = getCartaoInstallmentSeriesItems(item, c.cartao || []);
  var baseDesc = cartaoInstallmentBaseDesc(item.desc || '');

  document.getElementById('modalTitle').textContent = 'Editar lançamento do cartão';
  document.getElementById('modalBody').innerHTML =
    '<div class="form-row">'
    + '<div class="form-group" style="max-width:170px"><label>Data</label><input type="date" id="cc-edit-data" value="' + esc(item.data || '') + '"/></div>'
    + '<div class="form-group" style="max-width:220px"><label>Cartão</label><select id="cc-edit-cartao">' + cartaoOptionsHtml(item.cartaoId || '') + '</select></div>'
    + '<div class="form-group" style="max-width:190px"><label>Tipo</label><select id="cc-edit-tipo"><option value="lancamento"' + ((item.tipo || 'lancamento') === 'lancamento' ? ' selected' : '') + '>Lançamento</option><option value="estorno"' + ((item.tipo || '') === 'estorno' ? ' selected' : '') + '>Estorno</option><option value="pagamento"' + ((item.tipo || '') === 'pagamento' ? ' selected' : '') + '>Pagamento</option></select></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label>Descrição</label><input type="text" id="cc-edit-desc" value="' + esc(infoParcela ? baseDesc : (item.desc || '')) + '" placeholder="Ex: supermercado, streaming..." onblur="this.value=formatDescriptionTitleCase(this.value)"/></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group" style="max-width:220px"><label>Categoria</label><select id="cc-edit-cat">' + categoriaCartaoOptionsHtml(item.cat || '') + '</select></div>'
    + '<div class="form-group" style="max-width:160px"><label>Valor (R$)</label><input type="text" id="cc-edit-valor" class="money-input" placeholder="0,00" inputmode="numeric"/></div>'
    + '</div>'
    + (serie.length > 1
      ? '<div class="parcel-series-box"><label class="parcel-series-check"><input type="checkbox" id="cc-edit-serie" checked/> <span>Aplicar em todas as ' + serie.length + ' parcelas desta compra</span></label><p class="cartao-helper-text">Mantemos o número de cada parcela e reajustamos as datas em sequência a partir da data informada.</p></div>'
      : '')
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
  var tipoSelecionado = document.getElementById('cc-edit-tipo').value;
  var novoTipo = tipoSelecionado === 'estorno' ? 'estorno' : (tipoSelecionado === 'pagamento' ? 'pagamento' : 'lancamento');
  var novoDesc = formatDescriptionTitleCase(document.getElementById('cc-edit-desc').value);
  var novaCat = document.getElementById('cc-edit-cat').value;
  var novoValor = parseMoney(document.getElementById('cc-edit-valor'));
  var serie = getCartaoInstallmentSeriesItems(item, c.cartao || []);
  var aplicarSerie = serie.length > 1 && !!(document.getElementById('cc-edit-serie') && document.getElementById('cc-edit-serie').checked);
  var infoItemAtual = parseCartaoInstallmentInfo(item.desc || '');

  if (!novoCartaoId) return alert('Selecione um cartão.');
  if (!novoDesc || !novoValor) return alert('Descrição e valor são obrigatórios.');

  var error = null;
  if (aplicarSerie) {
    var infoAtual = parseCartaoInstallmentInfo(item.desc || '');
    var baseDate = novaData || item.data || null;
    for (var idx = 0; idx < serie.length; idx++) {
      var entry = serie[idx];
      var infoEntry = parseCartaoInstallmentInfo(entry.desc || '');
      var offset = infoEntry && infoAtual ? (infoEntry.atual - infoAtual.atual) : 0;
      var dataSerie = baseDate ? addMonthsClampedIso(baseDate, offset) : (entry.data || null);
      var descSerie = infoEntry ? (novoDesc + ' ' + infoEntry.atual + '/' + infoEntry.total) : novoDesc;
      var resposta = await applyUserScope(
        supabaseClient
          .from('lancamentos_cartao')
          .update({
            cartao_id: novoCartaoId,
            data: dataSerie || null,
            descricao: descSerie,
            categoria: novaCat || null,
            tipo: novoTipo,
            valor: Number(novoValor || 0)
          })
          .eq('id', entry.id)
      );
      if (resposta && resposta.error) {
        error = resposta.error;
        break;
      }
    }
  } else {
    var respostaUnica = await applyUserScope(
      supabaseClient
        .from('lancamentos_cartao')
        .update({
          cartao_id: novoCartaoId,
          data: novaData || null,
          descricao: infoItemAtual ? (novoDesc + ' ' + infoItemAtual.atual + '/' + infoItemAtual.total) : novoDesc,
          categoria: novaCat || null,
          tipo: novoTipo,
          valor: Number(novoValor || 0)
        })
        .eq('id', item.id)
    );
    error = respostaUnica && respostaUnica.error ? respostaUnica.error : null;
  }

  if (error) {
    console.error('Erro ao editar item do cartão:', error);
    alert('Não foi possível editar o item: ' + (error.message || 'erro desconhecido'));
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
    alert('Selecione ou cadastre um cartão antes de importar a fatura.');
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
    return alert('Selecione o cartão da fatura antes de importar.');
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
      return alert('Planilha inválida. Colunas obrigatórias: data, descrição, valor.');
    }

    let count = 0;
    let erros = 0;

    for (const row of rows.slice(1)) {
      var rawDate = String(row[iDate] || '').trim();
      var desc = formatDescriptionTitleCase(String(row[iDesc] || ''));
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

      if (duplicado && !(await appConfirm('Já existe um lançamento no mesmo cartão, data, valor e tipo: "' + desc + '". Deseja importar novamente?', { title: 'Lançamento duplicado', confirmText: 'Importar novamente' }))) {
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
    alert(count + ' lançamento(s) importado(s) com sucesso!' + (erros ? ' ' + erros + ' falharam.' : ''));
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
    return alert('Informe o cartão e o valor.');
  }

  var cartao = getCartaoById(cartaoId);
  var nomeCartao = cartao ? cartao.nome : 'Cartão';
  var dataPagamento = dataPg || new Date().toISOString().slice(0, 10);
  var descricaoPagamento = 'Pagamento fatura - ' + nomeCartao;

  const payload = {
    cliente_id: activeClient,
    tipo: 'debito',
    descricao: descricaoPagamento,
    categoria: 'Cartão de Crédito',
    valor: Number(valor || 0),
    data_lancamento: dataPagamento
  };

  const { error } = await supabaseClient
    .from('lancamentos')
    .insert([Object.assign(payload, getUserScopePayload())]);

  if (error) {
    console.error(error);
    alert('Erro ao registrar pagamento.');
    return;
  }

  const { error: cardError } = await supabaseClient
    .from('lancamentos_cartao')
    .insert([Object.assign({
      cliente_id: activeClient,
      cartao_id: cartaoId,
      data: dataPagamento,
      descricao: descricaoPagamento,
      categoria: 'Pagamento de Fatura',
      tipo: 'pagamento',
      valor: Number(valor || 0)
    }, getUserScopePayload())]);

  if (cardError) {
    console.error(cardError);
    alert('O pagamento entrou no extrato, mas não foi possível registrar no histórico do cartão.');
    await loadData();
    renderCartao();
    return;
  }

  alert('Fatura paga com sucesso!');
  await loadData();
  renderCartao();
}
