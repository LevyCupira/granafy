// ════════════════════════════════════════════════════
// DATA.JS — Estado global e bootstrap via Supabase
// ════════════════════════════════════════════════════

var data = { clients: {} };
var activeClient = null;
var activeTab = 'cartao';

async function loadData() {
  data = { clients: {} };

  const [
    { data: clientesRows, error: clientesError },
    { data: dividasRows, error: dividasError },
    { data: lancRows, error: lancError },
    { data: cartoesRows, error: cartoesError },
    { data: lancCartaoRows, error: lancCartaoError }
  ] = await Promise.all([
    supabaseClient.from('clientes').select('*').order('nome', { ascending: true }),
    supabaseClient.from('dividas').select('*'),
    supabaseClient.from('lancamentos').select('*'),
    supabaseClient.from('cartoes').select('*'),
    supabaseClient.from('lancamentos_cartao').select('*')
  ]);

  if (clientesError) {
    console.error('Erro ao carregar clientes do Supabase:', clientesError);
    return;
  }
  if (dividasError) console.error('Erro ao carregar dívidas do Supabase:', dividasError);
  if (lancError) console.error('Erro ao carregar lançamentos do Supabase:', lancError);
  if (cartoesError) console.error('Erro ao carregar cartões do Supabase:', cartoesError);
  if (lancCartaoError) console.error('Erro ao carregar lançamentos de cartão do Supabase:', lancCartaoError);

  const dividasPorCliente = {};
  for (const d of (dividasRows || [])) {
    const clienteId = d.cliente_id;
    if (!dividasPorCliente[clienteId]) dividasPorCliente[clienteId] = [];
    dividasPorCliente[clienteId].push({
      id: d.id,
      org: d.credor || '',
      tipo: d.tipo_divida || '',
      dataInicio: d.data_inicio || null,
      total: Number(d.valor_total || 0),
      parcelas: Number(d.parcelas_total || 0),
      valorParcela: Number(d.valor_parcela || 0),
      taxa: Number(d.taxa || 0),
      pago: Number(d.valor_pago || 0),
      restantes: Number(d.parcelas_restantes || 0),
      pagamentos: []
    });
  }

  const lancamentosPorCliente = {};
  for (const l of (lancRows || [])) {
    const clienteId = l.cliente_id;
    if (!lancamentosPorCliente[clienteId]) lancamentosPorCliente[clienteId] = [];
    lancamentosPorCliente[clienteId].push({
      id: l.id,
      data: l.data_lancamento || l.data || null,
      desc: l.descricao || '',
      cat: l.categoria || '',
      tipo: l.tipo || '',
      valor: Number(l.valor || 0)
    });
  }

  const cartoesPorCliente = {};
  for (const cc of (cartoesRows || [])) {
    const clienteId = cc.cliente_id;
    if (!cartoesPorCliente[clienteId]) cartoesPorCliente[clienteId] = [];
    cartoesPorCliente[clienteId].push({
      id: cc.id,
      nome: cc.nome || '',
      digits: cc.digits || '',
      bandeira: cc.bandeira || '',
      limite: Number(cc.limite || 0),
      venc: Number(cc.venc || 0)
    });
  }

  const lancamentosCartaoPorCliente = {};
  for (const it of (lancCartaoRows || [])) {
    const clienteId = it.cliente_id;
    if (!lancamentosCartaoPorCliente[clienteId]) lancamentosCartaoPorCliente[clienteId] = [];
    lancamentosCartaoPorCliente[clienteId].push({
      id: it.id,
      cartaoId: it.cartao_id || null,
      data: it.data || null,
      desc: it.descricao || '',
      cat: it.categoria || '',
      tipo: it.tipo || '',
      valor: Number(it.valor || 0)
    });
  }

  for (const c of (clientesRows || [])) {
    data.clients[c.id] = {
      id: c.id,
      name: c.nome || '',
      cpf: c.cpf || '',
      telefone: c.telefone || '',
      email: c.email || '',
      observacoes: c.observacoes || '',
      cartoes: cartoesPorCliente[c.id] || [],
      cartao: lancamentosCartaoPorCliente[c.id] || [],
      contas: [],
      dividas: dividasPorCliente[c.id] || [],
      extrato: lancamentosPorCliente[c.id] || []
    };
  }

  localStorage.setItem('fb_data_cache', JSON.stringify(data));
}

function saveData() {
  localStorage.setItem('fb_data_cache', JSON.stringify(data));
}

// ── Motor de abas móveis ──
var TAB_DEFS = [
  { key: 'cartao',   label: '💳 Cartão de Crédito' },
  { key: 'dividas',  label: '📋 Empréstimo e Renegociação' },
  { key: 'extrato',  label: '🏦 Conta Corrente' },
  { key: 'resumo',   label: '📊 Receita & Despesas' },
  { key: 'dre',      label: '📑 DRE' },
  { key: 'graficos', label: '📈 Gráficos' }
];

function getTabOrder() {
  try {
    const sv = JSON.parse(localStorage.getItem('fb_tab_order'));
    if (!sv) return TAB_DEFS;
    const map = Object.fromEntries(TAB_DEFS.map(t => [t.key, t]));
    const ord = sv.filter(k => map[k]).map(k => map[k]);
    TAB_DEFS.forEach(t => { if (!sv.includes(t.key)) ord.push(t); });
    return ord;
  } catch {
    return TAB_DEFS;
  }
}

function renderTabs() {
  const box = document.getElementById('tabsContainer');
  box.innerHTML = '';
  let src = null;

  getTabOrder().forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (tab.key === activeTab ? ' active' : '');
    btn.textContent = tab.label;
    btn.draggable = true;
    btn.dataset.tabKey = tab.key;

    btn.addEventListener('click', () => switchTab(tab.key));
    btn.addEventListener('dragstart', e => {
      src = tab.key;
      btn.classList.add('tab-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    btn.addEventListener('dragend', () => {
      btn.classList.remove('tab-dragging');
      box.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-drag-over'));
    });
    btn.addEventListener('dragover', e => {
      e.preventDefault();
      box.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-drag-over'));
      if (tab.key !== src) btn.classList.add('tab-drag-over');
    });
    btn.addEventListener('dragleave', () => btn.classList.remove('tab-drag-over'));
    btn.addEventListener('drop', e => {
      e.preventDefault();
      btn.classList.remove('tab-drag-over');
      if (!src || src === tab.key) return;
      const ord = getTabOrder().map(t => t.key);
      const fi = ord.indexOf(src);
      const ti = ord.indexOf(tab.key);
      if (fi < 0 || ti < 0) return;
      ord.splice(fi, 1);
      ord.splice(ti, 0, src);
      localStorage.setItem('fb_tab_order', JSON.stringify(ord));
      renderTabs();
    });

    box.appendChild(btn);
  });
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('#tabsContainer .tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tabKey === tab)
  );
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  renderTab(tab);
}

function renderTab(tab) {
  if (!activeClient) return;
  if (tab === 'cartao')   renderCartao();
  if (tab === 'dividas')  renderDividas();
  if (tab === 'extrato')  renderExtrato();
  if (tab === 'resumo')   renderResumo();
  if (tab === 'dre')      renderDRE();
  if (tab === 'graficos') renderGraficos();
}

// ── Inicialização ──
(async function init() {
  const savedTheme = localStorage.getItem('fb_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  await loadData();
  renderTabs();
  renderClientList();

  const saved = localStorage.getItem('fb_activeClient');
  if (saved && data.clients[saved]) {
    selectClient(saved);
  }

  document.addEventListener('click', e => {
    const wrap = document.getElementById('clientDropdownWrap');
    if (wrap && !wrap.contains(e.target)) {
      document.getElementById('clientDropdownMenu').classList.remove('open');
      document.getElementById('clientDropdownToggle').classList.remove('open');
    }
  });

  document.getElementById('newClientName').addEventListener('keydown', e => {
    if (e.key === 'Enter') addClient();
  });
})();